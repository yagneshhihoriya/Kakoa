/**
 * Storefront review submission — verified-purchase only. A review requires an
 * unreviewed `order_items` row for the product on one of the customer's real
 * (paid, non-cancelled) orders; `reviews.order_item_id` is unique, enforcing
 * one review per purchased line. Reviews from verified buyers publish
 * immediately — inserted as `approved`, with the product's denormalized rating
 * recomputed in the same tx (no admin moderation step). SERVER-ONLY: uses @kakoa/db.
 */
import { db, orderItems, orders, products, productVariants, reviews } from "@kakoa/db";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidateCatalog } from "@/lib/catalog/queries";
import { isUuid } from "@/lib/admin/product-validation";

/** Orders that count as a completed purchase for reviewing. */
const REVIEWABLE_ORDER_STATUSES = [
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
] as const;

export interface ReviewEligibility {
  /** True when there is an unreviewed purchased line to review. */
  canReview: boolean;
  /** True when the customer purchased but has already reviewed every line. */
  alreadyReviewed: boolean;
  hasPurchased: boolean;
}

/** Find the oldest unreviewed purchased order-item id for this customer+product. */
async function findReviewableItem(customerId: string, productId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(reviews, eq(reviews.orderItemId, orderItems.id))
    .where(
      and(
        eq(productVariants.productId, productId),
        eq(orders.customerId, customerId),
        inArray(orders.status, [...REVIEWABLE_ORDER_STATUSES]),
        isNull(reviews.orderItemId),
      ),
    )
    .orderBy(desc(orders.placedAt))
    .limit(1);
  return row?.id ?? null;
}

export async function getReviewEligibility(
  customerId: string,
  productId: string,
): Promise<ReviewEligibility> {
  if (!isUuid(productId)) return { canReview: false, alreadyReviewed: false, hasPurchased: false };
  const item = await findReviewableItem(customerId, productId);
  if (item !== null) return { canReview: true, alreadyReviewed: false, hasPurchased: true };

  // No unreviewed item — did they purchase at all (⇒ already reviewed)?
  const [purchased] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orderItems)
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(productVariants.productId, productId),
        eq(orders.customerId, customerId),
        inArray(orders.status, [...REVIEWABLE_ORDER_STATUSES]),
      ),
    );
  const hasPurchased = Number(purchased?.n ?? 0) > 0;
  return { canReview: false, alreadyReviewed: hasPurchased, hasPurchased };
}

export interface ReviewInput {
  rating: number;
  title: string | null;
  body: string;
}

export type ReviewInputResult =
  | { ok: true; value: ReviewInput }
  | { ok: false; message: string };

/** Validate a review payload against the reviews table's check constraints. */
export function validateReviewInput(raw: unknown): ReviewInputResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, message: "Invalid review." };
  const b = raw as Record<string, unknown>;
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, message: "Choose a rating from 1 to 5 stars." };
  }
  const body = typeof b.body === "string" ? b.body.trim() : "";
  if (body.length < 10 || body.length > 2000) {
    return { ok: false, message: "Your review must be between 10 and 2000 characters." };
  }
  let title: string | null = null;
  if (typeof b.title === "string" && b.title.trim() !== "") {
    const t = b.title.trim();
    if (t.length > 120) return { ok: false, message: "Title must be 120 characters or fewer." };
    title = t;
  }
  return { ok: true, value: { rating, title, body } };
}

export type SubmitReviewResult =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN" | "CONFLICT" | "VALIDATION_ERROR"; message: string };

export async function submitReview(
  customerId: string,
  productId: string,
  input: ReviewInput,
): Promise<SubmitReviewResult> {
  if (!isUuid(productId)) return { ok: false, code: "VALIDATION_ERROR", message: "Invalid product." };

  const orderItemId = await findReviewableItem(customerId, productId);
  if (orderItemId === null) {
    const elig = await getReviewEligibility(customerId, productId);
    return elig.alreadyReviewed
      ? { ok: false, code: "CONFLICT", message: "You've already reviewed this product." }
      : { ok: false, code: "FORBIDDEN", message: "Only verified buyers can review this product." };
  }

  try {
    // Verified-buyer reviews publish immediately (no admin moderation): insert
    // as 'approved' and recompute the product's denormalized rating from its
    // approved reviews — in one tx. The product row is locked first so
    // concurrent submissions for the same product can't clobber the aggregate
    // (same lost-update guard as moderateReview / adjustStock).
    await db.transaction(async (tx) => {
      await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, productId))
        .for("update")
        .limit(1);

      await tx.insert(reviews).values({
        productId,
        customerId,
        orderItemId,
        rating: input.rating,
        title: input.title,
        body: input.body,
        status: "approved",
      });

      const [agg] = await tx
        .select({
          cnt: sql<number>`count(*)::int`,
          avg: sql<string>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)`,
        })
        .from(reviews)
        .where(and(eq(reviews.productId, productId), eq(reviews.status, "approved")));

      await tx
        .update(products)
        .set({
          ratingCount: Number(agg?.cnt ?? 0),
          ratingAvg: String(agg?.avg ?? "0"), // numeric column ↔ string in drizzle
          updatedAt: sql`now()`,
        })
        .where(eq(products.id, productId));
    });
  } catch {
    // Unique(order_item_id) race → already reviewed.
    return { ok: false, code: "CONFLICT", message: "You've already reviewed this product." };
  }

  // Purge catalog caches so the new review + updated rating show immediately.
  await revalidateCatalog();
  return { ok: true };
}
