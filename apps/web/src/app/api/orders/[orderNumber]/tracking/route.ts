/**
 * GET /api/orders/[orderNumber]/tracking — order-tracking.md §5.3.
 *
 * Three auth paths converge on ONE read (order-tracking.md §1.3):
 *   - `Authorization: Bearer <trackingToken>` (30-min OTP-proven JWT),
 *   - `?accessToken=<uuid>` (order access token, ≤24h from `placed_at`),
 *   - `kakoa_session` cookie (the owning customer).
 *
 * Resolution (`resolveTrackingAuth`) collapses them to a single order id, then
 * `getOrderTracking` returns `{ order, timeline, shipment }` (shipment `null`
 * pre-AWB). Responses:
 *   - 401 `UNAUTHORIZED` — no credential at all;
 *   - 404 `NOT_FOUND` — absent order, credential for a different order, or a
 *     non-owner session (all identical, no oracle, §7 case 3);
 *   - 410 `TOKEN_EXPIRED` — tracking JWT `exp` passed, or accessToken > 24h.
 *
 * `Cache-Control: private, no-store` — a per-order, credential-gated read must
 * never land in a shared cache (§6, A05).
 */
import { resolveTrackingAuth, getOrderTracking } from '@/lib/orders/tracking';
import { jsonErr, jsonOk } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

/** Per-order, credential-gated — never shared-cacheable (§6). */
const PRIVATE_NO_STORE = 'private, no-store';

const ORDER_NUMBER_RE = /^KK-\d{5}$/;

const NOT_FOUND_MESSAGE = "We couldn't find that order.";
const UNAUTHORIZED_MESSAGE = 'Verify with OTP or sign in to track this order.';
const EXPIRED_MESSAGE = 'Your tracking link expired. Verify again with OTP.';
const INTERNAL_MESSAGE = 'Something went wrong. Please try again.';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  const { orderNumber: raw } = await params;
  const orderNumber = raw.trim().toUpperCase();
  if (!ORDER_NUMBER_RE.test(orderNumber)) {
    // A malformed order number can never match a row ⇒ 404 (no existence oracle).
    return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
  }

  try {
    const auth = await resolveTrackingAuth(req, orderNumber, {
      allowAccessToken: true,
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

    const tracking = await getOrderTracking(auth.orderId);
    if (tracking === null) {
      // Resolved to an id that vanished ⇒ 404 (no oracle).
      return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
    }

    return jsonOk(tracking, { cacheControl: PRIVATE_NO_STORE });
  } catch (cause) {
    console.error('order.tracking_internal', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
