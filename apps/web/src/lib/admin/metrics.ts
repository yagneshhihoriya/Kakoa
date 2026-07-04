/**
 * Dashboard metrics (admin-dashboard.md, Phase 1). Business-agnostic aggregate
 * reads over orders / payments / product_variants. IST calendar for "today".
 * Money in integer paise. Postgres aggregates come back as strings → coerced.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { db, orders, payments, productVariants } from '@kakoa/db';
import { ORDER_STATUSES, type OrderStatus } from '@kakoa/core';
import { sql } from 'drizzle-orm';

export interface DashboardMetrics {
  /** Gross collected (prepaid captured + COD collected) minus refunds. */
  netRevenuePaise: number;
  grossRevenuePaise: number;
  refundedPaise: number;
  ordersTotal: number;
  ordersToday: number;
  /** Distinct orders with a collected payment (payment-ledger population — AOV base). */
  paidOrders: number;
  aovPaise: number;
  lowStockCount: number;
  codPendingCount: number;
  statusBreakdown: { status: OrderStatus; count: number }[];
}

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Collected-money payment states (prepaid + COD). */
const COLLECTED = sql`('captured','partially_refunded','refunded','cod_collected','cod_pending_remittance')`;

export async function computeDashboardMetrics(): Promise<DashboardMetrics> {
  // Revenue AND the paid-order count both come from the payment ledger, over the
  // SAME population (orders with a COLLECTED payment) — so AOV = net / paidOrders
  // is consistent (in-flight COD / RTO-refunded orders don't skew the ratio).
  const [rev] = await db
    .select({
      gross: sql`coalesce(sum(${payments.amountPaise}) filter (where ${payments.status} in ${COLLECTED}), 0)`,
      refunded: sql`coalesce(sum(${payments.amountRefundedPaise}), 0)`,
      paidOrders: sql`coalesce(count(distinct ${payments.orderId}) filter (where ${payments.status} in ${COLLECTED}), 0)`,
    })
    .from(payments);

  const [ord] = await db
    .select({
      total: sql`count(*)`,
      today: sql`count(*) filter (where ${orders.placedAt} >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'))`,
      codPending: sql`count(*) filter (where ${orders.status} = 'cod_pending_confirmation')`,
    })
    .from(orders);

  const [low] = await db
    .select({ n: sql`count(*)` })
    .from(productVariants)
    .where(
      sql`${productVariants.isActive} and ${productVariants.stockQuantity} <= ${productVariants.lowStockThreshold}`,
    );

  const statusRows = await db
    .select({ status: orders.status, count: sql`count(*)` })
    .from(orders)
    .groupBy(orders.status);

  const byStatus = new Map(statusRows.map((r) => [r.status, toNum(r.count)]));
  const statusBreakdown = ORDER_STATUSES.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
  }));

  const grossRevenuePaise = toNum(rev?.gross);
  const refundedPaise = toNum(rev?.refunded);
  const netRevenuePaise = grossRevenuePaise - refundedPaise;
  const paidOrders = toNum(rev?.paidOrders);

  return {
    grossRevenuePaise,
    refundedPaise,
    netRevenuePaise,
    ordersTotal: toNum(ord?.total),
    ordersToday: toNum(ord?.today),
    paidOrders,
    aovPaise: paidOrders > 0 ? Math.round(netRevenuePaise / paidOrders) : 0,
    lowStockCount: toNum(low?.n),
    codPendingCount: toNum(ord?.codPending),
    statusBreakdown,
  };
}
