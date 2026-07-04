/**
 * Order tracking read — order-tracking.md §3 (timeline derivation), §5.3.
 *
 * Two concerns:
 *   1. `deriveTimeline` (PURE, DB-free, unit-tested): given the current order
 *      status + the `order_status_history` rows, build the `TimelineStep[]` rail
 *      per the §3 normative rules.
 *   2. `buildTimeline` / `getOrderTracking` (DB): fetch the order + history and
 *      assemble the `OrderTracking` payload (shipment `null` pre-AWB).
 *   3. `resolveTrackingAuth`: collapse the three auth inputs (session-owner |
 *      Bearer tracking JWT | `?accessToken` ≤24h) to a single `orders.id`, or a
 *      typed reason the route maps to 401 / 404 / 410 with no existence oracle.
 *
 * All `at` / `expected` values are ISO-8601 UTC; IST rendering happens only at
 * the edge via `formatIST()`.
 *
 * SERVER-ONLY: uses @kakoa/db + next/headers (via session).
 */
import {
  maskPhone,
  type OrderStatus,
  type OrderSummary,
  type OrderTracking,
  type TimelineStep,
} from '@kakoa/core';
import { db, orderItems, orders, orderStatusHistory } from '@kakoa/db';
import { asc, eq, sql } from 'drizzle-orm';

import { getCurrentCustomer } from '@/lib/auth/session';
import {
  isTrackingTokenExpired,
  verifyTrackingToken,
} from './lookup-jwt';
// Pure §3 derivation lives in its own DB-free module (unit-tested there).
import { deriveTimeline, type HistoryRow } from './timeline';

export { deriveTimeline } from './timeline';
export type { HistoryRow } from './timeline';

/* ------------------------------------------------------------------ */
/* OrderSummary + timeline from the DB                                 */
/* ------------------------------------------------------------------ */

/** The minimal order row every tracking read needs. */
interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMode: OrderSummary['paymentMode'];
  totalPaise: number;
  placedAt: Date;
  contactPhone: string;
  customerId: string | null;
  accessToken: string;
  itemCount: number;
}

/** DB order row → the `OrderSummary` shape (byte-compatible with /summary). */
function toOrderSummary(row: OrderRow): OrderSummary {
  return {
    orderNumber: row.orderNumber,
    status: row.status,
    paymentMode: row.paymentMode,
    totalPaise: row.totalPaise,
    placedAt: new Date(row.placedAt).toISOString(),
    itemCount: row.itemCount,
    contactPhoneMasked: maskPhone(row.contactPhone),
  };
}

/**
 * Build the timeline for an order id from its `order_status_history` rows
 * (ordered ASC via `osh_order_idx`). `expectedDeliveryAt` is `null` until the
 * fulfillment module populates shipments.
 */
export async function buildTimeline(
  orderId: string,
  currentStatus: OrderStatus,
  placedAt: string,
): Promise<TimelineStep[]> {
  const rows = await db
    .select({
      toStatus: orderStatusHistory.toStatus,
      createdAt: orderStatusHistory.createdAt,
    })
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(asc(orderStatusHistory.createdAt));

  const history: HistoryRow[] = rows.map((r) => ({
    toStatus: r.toStatus,
    at: new Date(r.createdAt).toISOString(),
  }));

  return deriveTimeline({ currentStatus, history, placedAt });
}

/**
 * The full tracking read for a resolved `orders.id`. Returns `null` if the
 * order vanished between auth resolution and this read (treated as 404 by the
 * caller). `shipment` is `null` pre-AWB — the fulfillment module has not run.
 */
export async function getOrderTracking(
  orderId: string,
): Promise<OrderTracking | null> {
  const [row] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMode: orders.paymentMode,
      totalPaise: orders.totalPaise,
      placedAt: orders.placedAt,
      contactPhone: orders.contactPhone,
      customerId: orders.customerId,
      accessToken: orders.accessToken,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) return null;

  const itemCount = await countItems(orderId);
  const summary = toOrderSummary({ ...row, itemCount });
  const placedAtIso = new Date(row.placedAt).toISOString();
  const timeline = await buildTimeline(orderId, row.status, placedAtIso);

  return { order: summary, timeline, shipment: null };
}

async function countItems(orderId: string): Promise<number> {
  const rows = await db
    .select({
      itemCount: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  return rows[0]?.itemCount ?? 0;
}

/* ------------------------------------------------------------------ */
/* Auth resolution (§1.3, §5.3) — three paths → one order id           */
/* ------------------------------------------------------------------ */

/** `access_token` uuid shape (order-tracking.md §1.3). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Outcome of resolving the tracking credential to a specific order:
 *  - `ok`         → `orderId` (a credential proved authority over THIS order);
 *  - `unauthorized` → no credential at all (→ 401);
 *  - `expired`    → a tracking JWT whose `exp` passed, or an `accessToken` used
 *                   after `placed_at + 24h` (→ 410 `TOKEN_EXPIRED`);
 *  - `notfound`   → order absent, OR a valid credential for a DIFFERENT order,
 *                   OR the session customer is not the owner — all identical
 *                   (→ 404, no oracle).
 */
export type TrackingAuth =
  | { kind: 'ok'; orderId: string; via: 'session' | 'jwt' | 'access_token' }
  | { kind: 'unauthorized' }
  | { kind: 'expired' }
  | { kind: 'notfound' };

/**
 * Resolve the three tracking auth paths for `orderNumber` to a single order id.
 * `allowAccessToken` is `false` on the cancel route (a mutation requires OTP- or
 * session-proven identity; `access_token` is read-only, §1.4 / §5.4).
 *
 * Order of precedence: Bearer tracking JWT → session owner → `?accessToken`.
 * Every path resolves the credential to a concrete `orders.id` BEFORE returning,
 * and compares it to the row for `orderNumber` — the URL is never trusted (§6).
 */
export async function resolveTrackingAuth(
  req: Request,
  orderNumber: string,
  options: { allowAccessToken: boolean },
): Promise<TrackingAuth> {
  const bearer = readBearer(req);
  const url = new URL(req.url);
  const accessToken = options.allowAccessToken
    ? url.searchParams.get('accessToken')
    : null;
  const customer = await getCurrentCustomer();

  const hasBearer = bearer !== null;
  const hasAccessToken = accessToken !== null && UUID_RE.test(accessToken);
  const hasSession = customer !== null;

  // No credential of any kind ⇒ 401 (distinct from a wrong credential → 404).
  if (!hasBearer && !hasAccessToken && !hasSession) {
    return { kind: 'unauthorized' };
  }

  // Load the target order ONCE (id, owner, access token, placed-at window).
  const [order] = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      accessToken: orders.accessToken,
      // `now() - placed_at <= 24h` on DB time (checkout.md §1.14).
      tokenLive: sql<boolean>`${orders.placedAt} > now() - interval '24 hours'`,
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  // (1) Bearer tracking JWT — the OTP-proven path (also authorizes cancel).
  if (hasBearer) {
    const verified = verifyTrackingToken(bearer);
    if (verified === null) {
      // A signature/scope-valid token that merely expired ⇒ 410; anything else
      // (tampered, wrong scope, malformed) ⇒ 404 (no oracle, §7 case 3).
      if (isTrackingTokenExpired(bearer)) return { kind: 'expired' };
      // Fall through to other credentials only if the bearer was the sole one.
      if (!hasSession && !hasAccessToken) return { kind: 'notfound' };
    } else if (order && order.id === verified.orderId) {
      return { kind: 'ok', orderId: order.id, via: 'jwt' };
    } else if (!hasSession && !hasAccessToken) {
      // Valid token, but for a different order (or order gone) ⇒ 404, not 401
      // (a 401 would confirm the target order exists, §7 case 3).
      return { kind: 'notfound' };
    }
  }

  // (2) Session owner — compare `orders.customer_id` to the session customer.
  if (hasSession && order && order.customerId === customer.id) {
    return { kind: 'ok', orderId: order.id, via: 'session' };
  }

  // (3) `access_token` ≤24h from `placed_at` (read-only path).
  if (hasAccessToken && order) {
    if (order.accessToken === accessToken) {
      if (!order.tokenLive) return { kind: 'expired' };
      return { kind: 'ok', orderId: order.id, via: 'access_token' };
    }
  }

  return { kind: 'notfound' };
}

/** Extract a `Bearer <token>` value, or `null`. */
function readBearer(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (header === null) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]!.trim() : null;
}
