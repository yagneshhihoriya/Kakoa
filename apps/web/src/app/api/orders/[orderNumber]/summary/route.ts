/**
 * GET /api/orders/[orderNumber]/summary?token=… — order success page data
 * (checkout.md §5; auth = order `access_token` ≤24h OR the owning customer).
 *
 * Returns the MINIMAL confirmation payload — never line items, addresses, or
 * money breakdowns beyond the total. A forged order number / wrong-or-expired
 * token gets 404 (no existence oracle); no token and no owning session gets 401.
 *
 * `Referrer-Policy` for the page is set by the page layer; this JSON endpoint is
 * `no-store` and leaks nothing beyond the caller's own order.
 */
import { maskPhone } from '@kakoa/core';
import { db, orderItems, orders } from '@kakoa/db';
import { eq, sql } from 'drizzle-orm';

import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { getCurrentCustomer } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const NOT_FOUND_MESSAGE = 'We could not find this order.';
const UNAUTHORIZED_MESSAGE = 'Please sign in to view this order.';
const INTERNAL_MESSAGE = 'Something went wrong. Please try again.';

/** Order `access_token` is a uuid; the ≤24h window is enforced on placed_at. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `KK-XXXXX` human order number. */
const ORDER_NUMBER_RE = /^KK-[0-9]{5,}$/;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  const { orderNumber } = await params;
  if (!ORDER_NUMBER_RE.test(orderNumber)) {
    return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
  }

  const token = new URL(req.url).searchParams.get('token');
  const customer = await getCurrentCustomer();

  // No credential at all ⇒ 401 (distinct from a wrong credential, which 404s).
  if ((token === null || !UUID_RE.test(token)) && customer === null) {
    return jsonErr('UNAUTHORIZED', UNAUTHORIZED_MESSAGE);
  }

  try {
    const [order] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentMode: orders.paymentMode,
        totalPaise: orders.totalPaise,
        placedAt: orders.placedAt,
        contactPhone: orders.contactPhone,
        accessToken: orders.accessToken,
        customerId: orders.customerId,
        // access_token is honored for 24h (checkout.md §1.14).
        tokenLive: sql<boolean>`${orders.placedAt} > now() - interval '24 hours'`,
      })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);

    if (!order) {
      return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
    }

    const tokenValid =
      token !== null &&
      UUID_RE.test(token) &&
      order.accessToken === token &&
      order.tokenLive;
    const ownsBySession =
      customer !== null && order.customerId === customer.id;
    if (!tokenValid && !ownsBySession) {
      // Wrong / expired token, and not the owner ⇒ 404 (no oracle).
      return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
    }

    const countRows = await db
      .select({
        itemCount: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const itemCount = countRows[0]?.itemCount ?? 0;

    return jsonOk(
      {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMode: order.paymentMode,
        totalPaise: order.totalPaise,
        placedAt: new Date(order.placedAt).toISOString(),
        itemCount,
        contactPhoneMasked: maskPhone(order.contactPhone),
      },
      { cacheControl: NO_STORE },
    );
  } catch (cause) {
    console.error('order.summary_internal', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
