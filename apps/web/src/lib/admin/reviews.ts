/**
 * Admin reviews moderation (admin-reviews.md). A moderation queue over the
 * reviews table: the PDP only ever reads `status='approved'`, surfaced via the
 * DENORMALIZED `products.rating_avg` / `rating_count`. So on every moderation we
 * (1) set the review's status, (2) RECOMPUTE the product's rating aggregates
 * from its approved reviews, and (3) invalidate the 'products' cache tag — all in
 * one tx + audit — so the storefront reflects the decision. Business-agnostic.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { adminAuditLog, customers, db, products, reviews } from '@kakoa/db';
import type { ReviewStatus } from '@kakoa/core';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { withConstraintMapping } from './db-errors';
import { displayReviewerName, type ModerationValues } from './review-format';
import { isUuid } from './product-validation';

export const REVIEW_PAGE_SIZE = 20;

export type ReviewFilter = ReviewStatus | 'all';

export interface AdminReviewRow {
  id: string;
  productId: string;
  productName: string;
  reviewerName: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  moderationNote: string | null;
  createdAt: string;
  moderatedAt: string | null;
}

export interface AdminReviewList {
  rows: AdminReviewRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function clampPage(raw: number | undefined): number {
  const n = Math.floor(Number(raw ?? 1));
  return Number.isFinite(n) ? Math.min(1_000_000, Math.max(1, n)) : 1;
}

export async function listReviews(input: {
  status?: ReviewFilter;
  page?: number;
}): Promise<AdminReviewList> {
  const page = clampPage(input.page);
  const pageSize = REVIEW_PAGE_SIZE;
  const status: ReviewFilter = input.status ?? 'pending';

  const conds: SQL[] = [];
  if (status !== 'all') conds.push(eq(reviews.status, status));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reviews)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  // Pending is a FIFO queue (oldest first); other views show newest first.
  const orderBy = status === 'pending' ? asc(reviews.createdAt) : desc(reviews.createdAt);

  const rows = await db
    .select({
      id: reviews.id,
      productId: reviews.productId,
      productName: products.name,
      reviewerName: customers.name,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      status: reviews.status,
      moderationNote: reviews.moderationNote,
      createdAt: reviews.createdAt,
      moderatedAt: reviews.moderatedAt,
    })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .leftJoin(customers, eq(customers.id, reviews.customerId))
    .where(where)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.productName,
      reviewerName: displayReviewerName(r.reviewerName),
      rating: Number(r.rating),
      title: r.title,
      body: r.body,
      status: r.status,
      moderationNote: r.moderationNote,
      createdAt: new Date(r.createdAt).toISOString(),
      moderatedAt: r.moderatedAt ? new Date(r.moderatedAt).toISOString() : null,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type ModerateResult =
  | { ok: true; status: 'approved' | 'rejected'; productId: string }
  | { ok: false; code: 'NOT_FOUND' | 'VALIDATION_ERROR'; message: string };

/**
 * Approve / reject a review, then recompute the product's rating aggregates from
 * its approved reviews (the moderated status is already committed within this tx,
 * so the aggregate sees it). Audited in-tx; re-moderation is allowed. On success
 * the 'products' cache tag is purged so the PDP/PLP re-render with the new rating.
 */
export async function moderateReview(
  id: string,
  values: ModerationValues,
  adminUserId: string,
): Promise<ModerateResult> {
  if (!isUuid(id)) {
    return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that review." };
  }
  return withConstraintMapping(() =>
    db.transaction(async (tx) => {
      const [review] = await tx
        .select({ id: reviews.id, status: reviews.status, productId: reviews.productId })
        .from(reviews)
        .where(eq(reviews.id, id))
        .for('update')
        .limit(1);
      if (!review) {
        return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that review." };
      }

      // Lock the product row so two admins moderating DIFFERENT reviews of the same
      // product can't each read a stale approved-set and clobber the recompute with
      // a literal count/avg (a lost update). The second tx blocks here, then its
      // aggregate below sees the first's committed status. Same principle as
      // adjustStock locking the variant row that holds the stock counter.
      await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, review.productId))
        .for('update')
        .limit(1);

      await tx
        .update(reviews)
        .set({
          status: values.decision,
          moderatedBy: adminUserId,
          moderatedAt: sql`now()`,
          moderationNote: values.note,
          updatedAt: sql`now()`,
        })
        .where(eq(reviews.id, id));

      // Recompute the DENORMALIZED product rating from APPROVED reviews only.
      const [agg] = await tx
        .select({
          cnt: sql<number>`count(*)::int`,
          avg: sql<string>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)`,
        })
        .from(reviews)
        .where(and(eq(reviews.productId, review.productId), eq(reviews.status, 'approved')));
      await tx
        .update(products)
        .set({
          ratingCount: Number(agg?.cnt ?? 0),
          ratingAvg: String(agg?.avg ?? '0'), // numeric column ↔ string in drizzle
          updatedAt: sql`now()`,
        })
        .where(eq(products.id, review.productId));

      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'review.moderate',
        entityType: 'review',
        entityId: id,
        before: { status: review.status },
        after: { status: values.decision, decision: values.decision, note: values.note },
      });

      // PDP reads reviews through the product rating, cached under 'products'
      // (per-slug tags are covered by the blanket tag). 2-arg form required (Next 16).
      revalidateTag('products', 'max');
      return { ok: true, status: values.decision, productId: review.productId };
    }),
  );
}
