/**
 * Admin analytics (HANDOFF-Analytics.md) — READ-ONLY reporting over orders /
 * payments / order_items. NO writes, NO audit.
 *
 * 🔴 Correctness = RECONCILIATION with the Dashboard (`metrics.ts`): revenue uses
 * the SAME collected-payment set (`COLLECTED_PAYMENT_STATUSES`, imported) and the
 * same net = gross − refunds rule, so an all-time summary folds up to the exact
 * Dashboard net/paidOrders/AOV. Every `SUM(*_paise)` is cast `::bigint` (int4
 * columns overflow), buckets are IST (Asia/Kolkata) to match the Dashboard's
 * "today", and best-sellers / category sales count only revenue-recognized items
 * (orders with a collected payment).
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  categories,
  couponRedemptions,
  coupons,
  db,
  orderItems,
  orders,
  payments,
  productVariants,
  products,
} from '@kakoa/db';
import { ORDER_STATUSES, type OrderStatus } from '@kakoa/core';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { COLLECTED_PAYMENT_STATUSES } from './payment-format';
import { bucketsFor, truncField, type Bucket, type ResolvedRange } from './analytics-range';

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Collected-money set, built from the shared constant (single source of truth). */
const COLLECTED = sql`(${sql.join(
  COLLECTED_PAYMENT_STATUSES.map((s) => sql`${s}`),
  sql`, `,
)})`;

/** `orders.placed_at ∈ [from, to)` — the half-open IST range. */
function inRange(range: ResolvedRange): SQL {
  return sql`${orders.placedAt} >= ${range.fromIso}::timestamptz AND ${orders.placedAt} < ${range.toIso}::timestamptz`;
}

/** `date_trunc(bucket)` of placed_at at IST, returned as a timestamptz instant. */
function bucketExpr(bucket: 'day' | 'week' | 'month'): SQL {
  return sql`(date_trunc(${bucket}, ${orders.placedAt} AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
}

/** EXISTS a collected payment for the joined order (revenue-recognized filter). */
const HAS_COLLECTED_PAYMENT = sql`EXISTS (SELECT 1 FROM payments p2 WHERE p2.order_id = ${orders.id} AND p2.status IN ${COLLECTED})`;

export interface AnalyticsSummary {
  netRevenuePaise: number;
  grossRevenuePaise: number;
  refundedPaise: number;
  orders: number;
  paidOrders: number;
  aovPaise: number;
  unitsSold: number;
  refundRatePct: number;
  prepaidRevenuePaise: number;
  codRevenuePaise: number;
  newCustomers: number;
  returningCustomers: number;
}

export async function getSummary(range: ResolvedRange): Promise<AnalyticsSummary> {
  // Revenue over payments whose ORDER falls in the range (refunds attributed to
  // the placement bucket — matches the Dashboard for an all-time range).
  const [rev] = await db
    .select({
      gross: sql`coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} in ${COLLECTED}), 0)::bigint`,
      refunded: sql`coalesce(sum(${payments.amountRefundedPaise}), 0)::bigint`,
      paidOrders: sql`coalesce(count(distinct ${payments.orderId}) filter (where ${payments.status} in ${COLLECTED}), 0)::bigint`,
      prepaidGross: sql`coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} in ${COLLECTED} and ${orders.paymentMode} = 'prepaid'), 0)::bigint`,
      prepaidRefund: sql`coalesce(sum(${payments.amountRefundedPaise}) filter (where ${orders.paymentMode} = 'prepaid'), 0)::bigint`,
      codGross: sql`coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} in ${COLLECTED} and ${orders.paymentMode} = 'cod'), 0)::bigint`,
      codRefund: sql`coalesce(sum(${payments.amountRefundedPaise}) filter (where ${orders.paymentMode} = 'cod'), 0)::bigint`,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(inRange(range));

  const [ord] = await db
    .select({ n: sql`count(*)::bigint` })
    .from(orders)
    .where(inRange(range));

  const [units] = await db
    .select({ n: sql`coalesce(sum(${orderItems.quantity}), 0)::bigint` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(inRange(range), HAS_COLLECTED_PAYMENT));

  // New vs returning: customers who ordered in-range, split by whether their
  // FIRST-EVER order lands inside the range (new) or before it (returning).
  const custRows = (await db.execute(sql`
    with in_range as (
      select distinct customer_id as cid from orders
      where customer_id is not null
        and placed_at >= ${range.fromIso}::timestamptz
        and placed_at < ${range.toIso}::timestamptz
    ),
    firsts as (
      select customer_id as cid, min(placed_at) as first_at from orders
      where customer_id is not null group by customer_id
    )
    select
      coalesce(count(*) filter (where f.first_at >= ${range.fromIso}::timestamptz), 0)::int as new_c,
      coalesce(count(*) filter (where f.first_at < ${range.fromIso}::timestamptz), 0)::int as returning_c
    from in_range ir join firsts f on f.cid = ir.cid
  `)) as unknown as Array<{ new_c: number; returning_c: number }>;
  const cust = custRows[0] ?? { new_c: 0, returning_c: 0 };

  const grossRevenuePaise = toNum(rev?.gross);
  const refundedPaise = toNum(rev?.refunded);
  const netRevenuePaise = grossRevenuePaise - refundedPaise;
  const paidOrders = toNum(rev?.paidOrders);
  const prepaidRevenuePaise = toNum(rev?.prepaidGross) - toNum(rev?.prepaidRefund);
  const codRevenuePaise = toNum(rev?.codGross) - toNum(rev?.codRefund);

  return {
    grossRevenuePaise,
    refundedPaise,
    netRevenuePaise,
    orders: toNum(ord?.n),
    paidOrders,
    aovPaise: paidOrders > 0 ? Math.round(netRevenuePaise / paidOrders) : 0,
    unitsSold: toNum(units?.n),
    refundRatePct:
      grossRevenuePaise > 0
        ? Math.round((refundedPaise / grossRevenuePaise) * 1000) / 10
        : 0,
    prepaidRevenuePaise,
    codRevenuePaise,
    newCustomers: toNum(cust.new_c),
    returningCustomers: toNum(cust.returning_c),
  };
}

export interface TimeseriesPoint {
  bucketStartIso: string;
  netRevenuePaise: number;
  orders: number;
  paidOrders: number;
}

export async function getRevenueTimeseries(
  range: ResolvedRange,
  requestedBucket: Bucket,
): Promise<{ bucket: Bucket; points: TimeseriesPoint[] }> {
  const plan = bucketsFor(range, requestedBucket);
  const field = truncField(plan.bucket);

  const rows = await db
    .select({
      bucketStart: bucketExpr(field),
      gross: sql`coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} in ${COLLECTED}), 0)::bigint`,
      refunded: sql`coalesce(sum(${payments.amountRefundedPaise}), 0)::bigint`,
      paidOrders: sql`coalesce(count(distinct ${payments.orderId}) filter (where ${payments.status} in ${COLLECTED}), 0)::bigint`,
      orders: sql`count(distinct ${orders.id})::bigint`,
    })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(inRange(range))
    // GROUP BY the first select expression by ordinal: the bucket `date_trunc`
    // takes its field as a bound param, so repeating the expression would bind a
    // SECOND param that Postgres can't match (→ "must appear in GROUP BY").
    .groupBy(sql`1`);

  const byKey = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    byKey.set(new Date(r.bucketStart as string).toISOString(), r);
  }

  const points: TimeseriesPoint[] = plan.startsIso.map((iso) => {
    const r = byKey.get(iso);
    const gross = toNum(r?.gross);
    const refunded = toNum(r?.refunded);
    return {
      bucketStartIso: iso,
      netRevenuePaise: gross - refunded,
      orders: toNum(r?.orders),
      paidOrders: toNum(r?.paidOrders),
    };
  });

  return { bucket: plan.bucket, points };
}

export interface BestSellerRow {
  productId: string;
  productName: string;
  sku: string;
  unitsSold: number;
  revenuePaise: number;
}

export async function getBestSellers(
  range: ResolvedRange,
  opts: { by: 'revenue' | 'units'; limit: number },
): Promise<BestSellerRow[]> {
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit) || 10));
  const units = sql<number>`sum(${orderItems.quantity})::bigint`;
  const revenue = sql<number>`sum(${orderItems.lineTotalPaise})::bigint`;

  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      sku: sql<string>`min(${orderItems.sku})`,
      unitsSold: units,
      revenuePaise: revenue,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(inRange(range), HAS_COLLECTED_PAYMENT))
    .groupBy(products.id, products.name)
    .orderBy(desc(opts.by === 'units' ? units : revenue))
    .limit(limit);

  return rows.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    sku: r.sku,
    unitsSold: toNum(r.unitsSold),
    revenuePaise: toNum(r.revenuePaise),
  }));
}

export interface CategorySalesRow {
  categoryId: string;
  categoryName: string;
  revenuePaise: number;
  unitsSold: number;
}

export async function getSalesByCategory(range: ResolvedRange): Promise<CategorySalesRow[]> {
  const rows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      revenuePaise: sql<number>`sum(${orderItems.lineTotalPaise})::bigint`,
      unitsSold: sql<number>`sum(${orderItems.quantity})::bigint`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(inRange(range), HAS_COLLECTED_PAYMENT))
    .groupBy(categories.id, categories.name)
    .orderBy(desc(sql`sum(${orderItems.lineTotalPaise})`));

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    revenuePaise: toNum(r.revenuePaise),
    unitsSold: toNum(r.unitsSold),
  }));
}

export interface PaymentSplit {
  prepaid: { orders: number; netRevenuePaise: number };
  cod: { orders: number; netRevenuePaise: number };
}

export async function getPaymentSplit(range: ResolvedRange): Promise<PaymentSplit> {
  const rows = await db
    .select({
      mode: orders.paymentMode,
      orders: sql`count(distinct ${orders.id})::bigint`,
      net: sql`(coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} in ${COLLECTED}), 0) - coalesce(sum(${payments.amountRefundedPaise}), 0))::bigint`,
    })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(inRange(range))
    .groupBy(orders.paymentMode);

  const split: PaymentSplit = {
    prepaid: { orders: 0, netRevenuePaise: 0 },
    cod: { orders: 0, netRevenuePaise: 0 },
  };
  for (const r of rows) {
    const bucket = r.mode === 'cod' ? split.cod : split.prepaid;
    bucket.orders = toNum(r.orders);
    bucket.netRevenuePaise = toNum(r.net);
  }
  return split;
}

export interface StatusCount {
  status: OrderStatus;
  count: number;
}

export async function getStatusBreakdown(range: ResolvedRange): Promise<StatusCount[]> {
  const rows = await db
    .select({ status: orders.status, count: sql`count(*)::int` })
    .from(orders)
    .where(inRange(range))
    .groupBy(orders.status);
  const byStatus = new Map(rows.map((r) => [r.status, toNum(r.count)]));
  return ORDER_STATUSES.map((status) => ({ status, count: byStatus.get(status) ?? 0 }));
}

export interface CouponUsageRow {
  code: string;
  redemptions: number;
  totalDiscountPaise: number;
}

export async function getCouponUsage(range: ResolvedRange, limit = 10): Promise<CouponUsageRow[]> {
  const n = Math.min(50, Math.max(1, Math.floor(limit) || 10));
  const rows = await db
    .select({
      code: coupons.code,
      redemptions: sql<number>`count(*)::int`,
      totalDiscountPaise: sql<number>`coalesce(sum(${couponRedemptions.discountPaise}), 0)::bigint`,
    })
    .from(couponRedemptions)
    .innerJoin(coupons, eq(coupons.id, couponRedemptions.couponId))
    .where(
      sql`${couponRedemptions.createdAt} >= ${range.fromIso}::timestamptz AND ${couponRedemptions.createdAt} < ${range.toIso}::timestamptz`,
    )
    .groupBy(coupons.code)
    .orderBy(desc(sql`count(*)`))
    .limit(n);
  return rows.map((r) => ({
    code: r.code,
    redemptions: toNum(r.redemptions),
    totalDiscountPaise: toNum(r.totalDiscountPaise),
  }));
}

export interface LowStockRow {
  sku: string;
  productName: string;
  variantName: string;
  stockQuantity: number;
  lowStockThreshold: number;
}

/** Low-stock snapshot (NOT range-bound) — mirrors the Dashboard's predicate. */
export async function getLowStock(limit = 10): Promise<{ count: number; items: LowStockRow[] }> {
  const n = Math.min(50, Math.max(1, Math.floor(limit) || 10));
  const lowPredicate = sql`${productVariants.isActive} and ${productVariants.stockQuantity} <= ${productVariants.lowStockThreshold}`;

  const [countRow] = await db
    .select({ n: sql`count(*)::int` })
    .from(productVariants)
    .where(lowPredicate);

  const items = await db
    .select({
      sku: productVariants.sku,
      productName: products.name,
      variantName: productVariants.name,
      stockQuantity: productVariants.stockQuantity,
      lowStockThreshold: productVariants.lowStockThreshold,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(lowPredicate)
    .orderBy(asc(productVariants.stockQuantity), asc(products.name))
    .limit(n);

  return {
    count: toNum(countRow?.n),
    items: items.map((r) => ({
      sku: r.sku,
      productName: r.productName,
      variantName: r.variantName,
      stockQuantity: toNum(r.stockQuantity),
      lowStockThreshold: toNum(r.lowStockThreshold),
    })),
  };
}

/* ── CSV export data (revenue-recognized where applicable; row-capped) ── */

export const EXPORT_ROW_CAP = 50_000;

export interface ExportTable {
  headers: string[];
  rows: (string | number | null)[][];
  truncated: boolean;
}

/** Orders placed in the range (one row per order). */
export async function getOrdersExport(range: ResolvedRange): Promise<ExportTable> {
  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      placedAt: orders.placedAt,
      status: orders.status,
      paymentMode: orders.paymentMode,
      totalPaise: orders.totalPaise,
      couponCode: orders.couponCode,
    })
    .from(orders)
    .where(inRange(range))
    .orderBy(desc(orders.placedAt))
    .limit(EXPORT_ROW_CAP + 1);

  const truncated = rows.length > EXPORT_ROW_CAP;
  const capped = truncated ? rows.slice(0, EXPORT_ROW_CAP) : rows;
  return {
    headers: ['Order', 'Placed (IST)', 'Status', 'Payment mode', 'Total (₹)', 'Coupon'],
    rows: capped.map((r) => [
      r.orderNumber,
      istDate(r.placedAt),
      r.status,
      r.paymentMode,
      (Number(r.totalPaise) / 100).toFixed(2),
      r.couponCode ?? '',
    ]),
    truncated,
  };
}

export async function getBestSellersExport(range: ResolvedRange): Promise<ExportTable> {
  const rows = await getBestSellers(range, { by: 'revenue', limit: 100 });
  return {
    headers: ['Product', 'SKU', 'Units sold', 'Revenue (₹)'],
    rows: rows.map((r) => [r.productName, r.sku, r.unitsSold, (r.revenuePaise / 100).toFixed(2)]),
    truncated: false,
  };
}

export async function getRevenueExport(range: ResolvedRange, bucket: Bucket): Promise<ExportTable> {
  const { points } = await getRevenueTimeseries(range, bucket);
  return {
    headers: ['Bucket start (IST)', 'Net revenue (₹)', 'Orders', 'Paid orders'],
    rows: points.map((p) => [
      istDate(new Date(p.bucketStartIso)),
      (p.netRevenuePaise / 100).toFixed(2),
      p.orders,
      p.paidOrders,
    ]),
    truncated: false,
  };
}

/** A timestamp → `YYYY-MM-DD` in IST. */
function istDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
