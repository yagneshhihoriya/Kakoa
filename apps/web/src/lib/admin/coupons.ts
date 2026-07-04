/**
 * Admin coupons / promotions (admin-coupons.md, Phase 2). CRUD over the coupons
 * table that checkout already consumes (quote.ts). `redemption_count` is managed
 * by the order flow (atomic exhaustion) — never written here. Audited in-tx;
 * the unique(code) race is handled by withConstraintMapping.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { adminAuditLog, coupons, db } from '@kakoa/db';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { withConstraintMapping } from './db-errors';
import { couponStatus, type CouponStatus, type CouponValues } from './coupon-validation';
import { isUuid } from './product-validation';

export const COUPON_PAGE_SIZE = 20;

export interface AdminCouponRow {
  id: string;
  code: string;
  description: string;
  percentBp: number | null;
  flatPaise: number | null;
  minSubtotalPaise: number;
  redemptionCount: number;
  usageLimit: number | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  status: CouponStatus;
}

export interface AdminCouponList {
  rows: AdminCouponRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function likeParam(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listCoupons(input: {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  page?: number;
}): Promise<AdminCouponList> {
  const page = Math.min(1_000_000, Math.max(1, Math.floor(Number(input.page ?? 1)) || 1));
  const pageSize = COUPON_PAGE_SIZE;

  const conds: SQL[] = [];
  if (input.status === 'active') conds.push(eq(coupons.isActive, true));
  if (input.status === 'inactive') conds.push(eq(coupons.isActive, false));
  const search = input.search?.trim();
  if (search) conds.push(sql`${coupons.code}::text ilike ${likeParam(search)}`);
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(coupons)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      id: coupons.id,
      code: coupons.code,
      description: coupons.description,
      percentBp: coupons.percentBp,
      flatPaise: coupons.flatPaise,
      minSubtotalPaise: coupons.minSubtotalPaise,
      redemptionCount: coupons.redemptionCount,
      usageLimit: coupons.usageLimit,
      startsAt: coupons.startsAt,
      endsAt: coupons.endsAt,
      isActive: coupons.isActive,
    })
    .from(coupons)
    .where(where)
    .orderBy(desc(coupons.isActive), asc(coupons.code))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      code: r.code,
      description: r.description,
      percentBp: r.percentBp,
      flatPaise: r.flatPaise,
      minSubtotalPaise: Number(r.minSubtotalPaise),
      redemptionCount: Number(r.redemptionCount),
      usageLimit: r.usageLimit,
      startsAt: new Date(r.startsAt).toISOString(),
      endsAt: r.endsAt ? new Date(r.endsAt).toISOString() : null,
      isActive: r.isActive,
      status: couponStatus(r),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface AdminCouponDetail {
  id: string;
  code: string;
  description: string;
  percentBp: number | null;
  flatPaise: number | null;
  maxDiscountPaise: number | null;
  minSubtotalPaise: number;
  startsAt: string;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  isActive: boolean;
  redemptionCount: number;
  status: CouponStatus;
}

export async function getCoupon(id: string): Promise<AdminCouponDetail | null> {
  if (!isUuid(id)) return null;
  const [c] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  if (!c) return null;
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    percentBp: c.percentBp,
    flatPaise: c.flatPaise,
    maxDiscountPaise: c.maxDiscountPaise,
    minSubtotalPaise: Number(c.minSubtotalPaise),
    startsAt: new Date(c.startsAt).toISOString(),
    endsAt: c.endsAt ? new Date(c.endsAt).toISOString() : null,
    usageLimit: c.usageLimit,
    perCustomerLimit: Number(c.perCustomerLimit),
    firstOrderOnly: c.firstOrderOnly,
    isActive: c.isActive,
    redemptionCount: Number(c.redemptionCount),
    status: couponStatus(c),
  };
}

export type CouponResult =
  | { ok: true; id: string }
  | { ok: false; code: 'VALIDATION_ERROR' | 'NOT_FOUND'; message: string };

export async function createCoupon(v: CouponValues, adminUserId: string): Promise<CouponResult> {
  return withConstraintMapping(() =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .insert(coupons)
        .values({
          code: v.code,
          description: v.description,
          percentBp: v.percentBp,
          flatPaise: v.flatPaise,
          maxDiscountPaise: v.maxDiscountPaise,
          minSubtotalPaise: v.minSubtotalPaise,
          startsAt: v.startsAt,
          endsAt: v.endsAt,
          usageLimit: v.usageLimit,
          perCustomerLimit: v.perCustomerLimit,
          firstOrderOnly: v.firstOrderOnly,
          isActive: v.isActive,
          createdBy: adminUserId,
        })
        .returning({ id: coupons.id });
      if (!row) return { ok: false, code: 'VALIDATION_ERROR', message: 'Could not create the coupon.' };
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'coupon.create',
        entityType: 'coupon',
        entityId: row.id,
        before: null,
        after: { code: v.code, percentBp: v.percentBp, flatPaise: v.flatPaise },
      });
      return { ok: true, id: row.id };
    }),
  );
}

export async function updateCoupon(
  id: string,
  v: CouponValues,
  adminUserId: string,
): Promise<CouponResult> {
  if (!isUuid(id)) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that coupon." };
  return withConstraintMapping(() =>
    db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: coupons.id, code: coupons.code, isActive: coupons.isActive })
        .from(coupons)
        .where(eq(coupons.id, id))
        .for('update')
        .limit(1);
      if (!current) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that coupon." };

      await tx
        .update(coupons)
        .set({
          code: v.code,
          description: v.description,
          // Persist the chosen kind exactly (percent XOR flat) — clear the other.
          percentBp: v.percentBp,
          flatPaise: v.flatPaise,
          maxDiscountPaise: v.maxDiscountPaise,
          minSubtotalPaise: v.minSubtotalPaise,
          startsAt: v.startsAt,
          endsAt: v.endsAt,
          usageLimit: v.usageLimit,
          perCustomerLimit: v.perCustomerLimit,
          firstOrderOnly: v.firstOrderOnly,
          isActive: v.isActive,
          updatedAt: sql`now()`,
        })
        .where(eq(coupons.id, id));
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'coupon.update',
        entityType: 'coupon',
        entityId: id,
        before: { code: current.code, isActive: current.isActive },
        after: { code: v.code, isActive: v.isActive },
      });
      return { ok: true, id };
    }),
  );
}
