/**
 * POST /api/orders/[orderNumber]/cancel — order-tracking.md §5.4.
 *
 * Auth = session-owner OR Bearer tracking JWT. `access_token` is NOT accepted:
 * a mutation requires OTP-proven or session-proven identity (§1.4, §6). No/only-
 * accessToken credential ⇒ 401; not-owner / nonexistent ⇒ 404 (identical).
 *
 *   resolveTrackingAuth (allowAccessToken:false) → parse cancelOrderSchema (400)
 *   → cancelOrder (shared FOR-UPDATE executor): 200 { order } | 404 | 422
 *   `INVALID_TRANSITION` (status is `packed` or later / already terminal).
 *
 * The `reason` is stored raw on `orders.cancel_reason` and output-encoded at
 * every render (the admin panel echoes it — stored-XSS-into-admin is the risk).
 */
import { cancelOrderSchema } from '@kakoa/core';

import { jsonErr, jsonOk, NO_STORE, toFieldErrors } from '@/lib/api/http';
import { getCurrentCustomer } from '@/lib/auth/session';
import { cancelOrder } from '@/lib/orders/cancel';
import { resolveTrackingAuth } from '@/lib/orders/tracking';

export const dynamic = 'force-dynamic';

const ORDER_NUMBER_RE = /^KK-\d{5}$/;

const NOT_FOUND_MESSAGE = "We couldn't find that order.";
const UNAUTHORIZED_MESSAGE = 'Sign in or verify with OTP to cancel this order.';
const EXPIRED_MESSAGE = 'Your tracking link expired. Verify again with OTP.';
const VALIDATION_MESSAGE = "Please tell us why you're cancelling (3–500 characters).";
const INTERNAL_MESSAGE = 'Something went wrong. Please try again.';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  const { orderNumber: raw } = await params;
  const orderNumber = raw.trim().toUpperCase();
  if (!ORDER_NUMBER_RE.test(orderNumber)) {
    return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
  }

  try {
    // Auth: session-owner or Bearer tracking JWT ONLY (accessToken rejected).
    const auth = await resolveTrackingAuth(req, orderNumber, {
      allowAccessToken: false,
    });
    if (auth.kind === 'unauthorized') {
      return jsonErr('UNAUTHORIZED', UNAUTHORIZED_MESSAGE);
    }
    if (auth.kind === 'expired') {
      return jsonErr('TOKEN_EXPIRED', EXPIRED_MESSAGE);
    }
    if (auth.kind === 'notfound') {
      return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
    }

    // Parse the reason AFTER auth (a valid credential precedes any body read).
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE);
    }
    const parsed = cancelOrderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE, {
        fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      });
    }

    // The actor is the session customer (owner path) or a guest via JWT (null).
    const customer = auth.via === 'session' ? await getCurrentCustomer() : null;

    const result = await cancelOrder({
      orderId: auth.orderId,
      reason: parsed.data.reason,
      actor: { customerId: customer?.id ?? null },
    });

    if (!result.ok) {
      return jsonErr(result.code, result.message, {
        ...(result.details !== undefined ? { details: result.details } : {}),
      });
    }

    return jsonOk({ order: result.data }, { cacheControl: NO_STORE });
  } catch (cause) {
    console.error('order.cancel_internal', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
