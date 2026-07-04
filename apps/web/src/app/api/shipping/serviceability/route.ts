/**
 * GET /api/shipping/serviceability?pincode=560001&cod=true — public · Class A
 * (checkout.md §5.1).
 *
 * Delegates to the ShippingProvider (real Shiprocket when configured, else the
 * in-repo mock). Serviceable ⇒ 200 with option ETAs; unserviceable ⇒ 422
 * `PINCODE_UNSERVICEABLE`; hard upstream failure ⇒ 502 `UPSTREAM_ERROR` so the
 * UI can degrade to "standard only, verified at dispatch". Cached 24h per
 * pincode (the placement snapshots serviceability, so cache staleness can never
 * mutate a placed order).
 */
import { getShippingProvider } from '@kakoa/integrations';

import { jsonErr, jsonOk } from '@/lib/api/http';
import { loadCheckoutSettings } from '@/lib/checkout/settings';

export const dynamic = 'force-dynamic';

const PINCODE_RE = /^[1-9][0-9]{5}$/;
const SVC_CACHE = 'public, max-age=86400, stale-while-revalidate=86400';
const BAD_PINCODE_MESSAGE = 'Enter a valid 6-digit Indian PIN code.';
const UNSERVICEABLE_MESSAGE = (p: string): string =>
  `Sorry, we can't deliver to PIN code ${p} yet.`;
const UPSTREAM_MESSAGE =
  "We couldn't confirm delivery to this PIN code — standard delivery only, verified at dispatch.";
const INTERNAL_MESSAGE = 'Something went wrong on our side.';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pincode = (url.searchParams.get('pincode') ?? '').trim();
  const cod = url.searchParams.get('cod') === 'true';

  if (!PINCODE_RE.test(pincode)) {
    return jsonErr('VALIDATION_ERROR', BAD_PINCODE_MESSAGE);
  }

  try {
    const [result, settings] = await Promise.all([
      getShippingProvider().serviceability({ pincode, cod }),
      loadCheckoutSettings(),
    ]);
    if (!result.serviceable) {
      return jsonErr('PINCODE_UNSERVICEABLE', UNSERVICEABLE_MESSAGE(pincode));
    }
    // The provider returns availability + ETAs only (`feePaise` is 0); the
    // rupee fee is policy that lives in store_settings. Inject the BASE fee per
    // option here so the delivery cards show the same amount the quote charges.
    // Free-shipping-over-threshold is applied client-side against the subtotal.
    const options = result.options.map((o) => ({
      ...o,
      feePaise:
        o.option === 'express'
          ? settings.shippingFeeExpressPaise
          : settings.shippingFeeStandardPaise,
    }));
    return jsonOk({ ...result, options }, { cacheControl: SVC_CACHE });
  } catch (cause) {
    // Hard upstream failure — surface 502 so the UI degrades gracefully.
    console.error('shipping.serviceability_upstream', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('UPSTREAM_ERROR', UPSTREAM_MESSAGE);
  }
}
