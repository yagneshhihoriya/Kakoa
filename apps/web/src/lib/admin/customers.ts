/**
 * Admin customers (admin-customers.md). A PII-heavy, read-mostly module: a
 * searchable list with per-customer order-count + lifetime spend, a composed
 * detail (profile + stats + orders + addresses), and ONE mutation — block /
 * unblock (abuse control), audited in-tx. Business-agnostic.
 *
 * PII rule (docs/admin-platform §PII): phone + email are masked UNLESS the acting
 * admin holds `customers:pii-view`. Masking is decided on the SERVER (the
 * `canViewPii` arg) so a client lacking the permission never receives the raw
 * value in the RSC/JSON payload. The customer NAME is not PII-gated — it is a
 * distinct list/detail column support staff need, and the spec masks only the
 * contact fields.
 *
 * Editing customer identity is out of scope; block/unblock is the only write.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  adminAuditLog,
  customerAddresses,
  customers,
  db,
  orders,
  payments,
} from '@kakoa/db';
import type { OrderStatus, PaymentMode } from '@kakoa/core';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { withConstraintMapping } from './db-errors';
import { maskEmail, maskPhoneMaybe } from './customer-privacy';
import { isUuid } from './product-validation';

export const CUSTOMER_PAGE_SIZE = 30;

/**
 * Collected-money payment states — the SAME set the dashboard uses
 * (metrics.ts `COLLECTED`). Lifetime spend is NET: captured/COD-collected minus
 * refunds. Kept in sync deliberately; both express "money we actually took".
 */
const COLLECTED = sql`('captured','partially_refunded','refunded','cod_collected','cod_pending_remittance')`;

/** Escape LIKE wildcards so search is a literal substring (default `\` escape). */
function likeParam(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Clamp a page number to a sane, finite range (guards `?page=1e308` → bad OFFSET). */
function clampPage(raw: number | undefined): number {
  const n = Math.floor(Number(raw ?? 1));
  return Number.isFinite(n) ? Math.min(1_000_000, Math.max(1, n)) : 1;
}

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// Per-customer aggregates as CORRELATED subqueries. The outer `customers.id` is
// written as literal SQL (not `${customers.id}`) because drizzle renders an
// interpolated column UNqualified (`"id"`), which is ambiguous inside a subquery
// that also has an `id` column in scope. The outer FROM is the unaliased
// `customers` table, so the literal `customers.id` correlates correctly; inner
// tables are aliased (o2/o3/p2) to keep every other reference unambiguous.

/** Orders linked to a customer. Guest orders (customer_id null) never match. */
const orderCountSql = sql<number>`(select count(*)::int from ${orders} o2 where o2.customer_id = customers.id)`;

/** Net collected across a customer's orders; ::bigint guards int4 sum overflow. */
const lifetimeSpendSql = sql<string>`(select coalesce(sum(p2.amount_paise - p2.amount_refunded_paise), 0)::bigint from ${payments} p2 join ${orders} o3 on p2.order_id = o3.id where o3.customer_id = customers.id and p2.status in ${COLLECTED})`;

export interface CustomerRow {
  id: string;
  name: string | null;
  /** Masked unless the caller passed canViewPii=true. Null when the column is null. */
  phone: string | null;
  email: string | null;
  isBlocked: boolean;
  orderCount: number;
  lifetimeSpendPaise: number;
  createdAt: string;
}

export interface CustomerList {
  rows: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listCustomers(
  input: { search?: string; filter?: 'all' | 'blocked'; page?: number },
  canViewPii: boolean,
): Promise<CustomerList> {
  const page = clampPage(input.page);
  const pageSize = CUSTOMER_PAGE_SIZE;

  const conds: SQL[] = [];
  if (input.filter === 'blocked') conds.push(eq(customers.isBlocked, true));
  const search = input.search?.trim();
  if (search) {
    // Searching raw columns server-side is not "viewing PII" — the raw values
    // never leave the server; only masked values are returned to the client.
    const p = likeParam(search);
    conds.push(
      sql`(${customers.name} ilike ${p} or ${customers.phone} ilike ${p} or ${customers.email}::text ilike ${p})`,
    );
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(customers)
    .where(where);
  const total = toNum(totalRow?.total);

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      isBlocked: customers.isBlocked,
      orderCount: orderCountSql,
      lifetimeSpendPaise: lifetimeSpendSql,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(where)
    .orderBy(desc(customers.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: canViewPii ? r.phone : maskPhoneMaybe(r.phone),
      email: canViewPii ? r.email : maskEmail(r.email),
      isBlocked: r.isBlocked,
      orderCount: toNum(r.orderCount),
      lifetimeSpendPaise: toNum(r.lifetimeSpendPaise),
      createdAt: new Date(r.createdAt).toISOString(),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface CustomerDetail {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  isBlocked: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: string;
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
  lifetimeSpendPaise: number;
}

export async function getCustomerDetail(
  id: string,
  canViewPii: boolean,
): Promise<CustomerDetail | null> {
  if (!isUuid(id)) return null;
  const [c] = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      isBlocked: customers.isBlocked,
      phoneVerifiedAt: customers.phoneVerifiedAt,
      emailVerifiedAt: customers.emailVerifiedAt,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (!c) return null;

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')::int`,
      cancelled: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')::int`,
    })
    .from(orders)
    .where(eq(orders.customerId, id));

  const [spend] = await db
    .select({
      spend: sql<string>`coalesce(sum(${payments.amountPaise} - ${payments.amountRefundedPaise}) filter (where ${payments.status} in ${COLLECTED}), 0)::bigint`,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(eq(orders.customerId, id));

  return {
    id: c.id,
    name: c.name,
    phone: canViewPii ? c.phone : maskPhoneMaybe(c.phone),
    email: canViewPii ? c.email : maskEmail(c.email),
    isBlocked: c.isBlocked,
    phoneVerified: c.phoneVerifiedAt !== null,
    emailVerified: c.emailVerifiedAt !== null,
    createdAt: new Date(c.createdAt).toISOString(),
    orderCount: toNum(counts?.total),
    deliveredCount: toNum(counts?.delivered),
    cancelledCount: toNum(counts?.cancelled),
    lifetimeSpendPaise: toNum(spend?.spend),
  };
}

export interface CustomerOrderRow {
  orderNumber: string;
  status: OrderStatus;
  paymentMode: PaymentMode;
  totalPaise: number;
  placedAt: string;
}

/** A customer's own orders (customer_id-linked), newest first. */
export async function listCustomerOrders(id: string): Promise<CustomerOrderRow[]> {
  if (!isUuid(id)) return [];
  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMode: orders.paymentMode,
      totalPaise: orders.totalPaise,
      placedAt: orders.placedAt,
    })
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.placedAt))
    .limit(100);
  return rows.map((r) => ({
    orderNumber: r.orderNumber,
    status: r.status,
    paymentMode: r.paymentMode,
    totalPaise: Number(r.totalPaise),
    placedAt: new Date(r.placedAt).toISOString(),
  }));
}

export interface CustomerAddressRow {
  id: string;
  label: string;
  fullName: string;
  phone: string | null; // masked unless canViewPii
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export async function listCustomerAddresses(
  id: string,
  canViewPii: boolean,
): Promise<CustomerAddressRow[]> {
  if (!isUuid(id)) return [];
  const rows = await db
    .select({
      id: customerAddresses.id,
      label: customerAddresses.label,
      fullName: customerAddresses.fullName,
      phone: customerAddresses.phone,
      line1: customerAddresses.line1,
      line2: customerAddresses.line2,
      city: customerAddresses.city,
      state: customerAddresses.state,
      pincode: customerAddresses.pincode,
      isDefault: customerAddresses.isDefault,
    })
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, id))
    .orderBy(desc(customerAddresses.isDefault), customerAddresses.createdAt);
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    fullName: r.fullName,
    phone: canViewPii ? r.phone : maskPhoneMaybe(r.phone),
    line1: r.line1,
    line2: r.line2,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    isDefault: r.isDefault,
  }));
}

export type BlockResult =
  | { ok: true; changed: boolean; isBlocked: boolean }
  | { ok: false; code: 'NOT_FOUND' | 'VALIDATION_ERROR'; message: string };

/**
 * Block / unblock a customer (serial-RTO abuse control). tx + FOR UPDATE + audit.
 * Idempotent: setting the flag to its current value is a no-op success (no audit
 * row). The audit before/after stores only the flag — never contact details.
 */
export async function setCustomerBlocked(
  id: string,
  blocked: boolean,
  adminUserId: string,
): Promise<BlockResult> {
  if (!isUuid(id)) {
    return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that customer." };
  }
  return withConstraintMapping(() =>
    db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: customers.id, isBlocked: customers.isBlocked })
        .from(customers)
        .where(eq(customers.id, id))
        .for('update')
        .limit(1);
      if (!current) {
        return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that customer." };
      }
      if (current.isBlocked === blocked) {
        return { ok: true, changed: false, isBlocked: blocked };
      }

      await tx
        .update(customers)
        .set({ isBlocked: blocked, updatedAt: sql`now()` })
        .where(eq(customers.id, id));
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: blocked ? 'customer.block' : 'customer.unblock',
        entityType: 'customer',
        entityId: id,
        before: { isBlocked: current.isBlocked },
        after: { isBlocked: blocked },
      });
      return { ok: true, changed: true, isBlocked: blocked };
    }),
  );
}

// TODO(customers:data-request): GDPR-style export / delete of a customer's data
// is a later increment — the permission is registered but the flow is unbuilt.
