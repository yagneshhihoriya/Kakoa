import type {
  ServiceabilityResult,
  ShippingProvider,
} from "./provider";

/**
 * In-memory shipping provider for local dev and tests (checkout.md §3, mock note).
 *
 * Serviceability rules (kept simple + documented so tests can exercise every path):
 *   - Any syntactically valid Indian PIN (^[1-9][0-9]{5}$) is serviceable, EXCEPT
 *     the hardcoded UNSERVICEABLE set below (exercises PINCODE_UNSERVICEABLE).
 *   - COD is available everywhere serviceable EXCEPT the COD_UNAVAILABLE set below
 *     (exercises the COD_UNAVAILABLE blocked path).
 *   - Syntactically invalid PINs are not serviceable.
 *
 * ETAs come from the provider; rupee fees do NOT — `feePaise` is 0 here and the
 * checkout quote engine overrides it from store_settings.
 */

const PIN_RE = /^[1-9][0-9]{5}$/;

/** Test pincodes that are entirely unserviceable (no delivery at all). */
const UNSERVICEABLE = new Set<string>(["110011"]);

/** Test pincodes that are serviceable for prepaid but NOT for COD. */
const COD_UNAVAILABLE = new Set<string>(["190001"]);

/** ETA-only options; fees are placeholders applied later from store_settings. */
function options(): ServiceabilityResult["options"] {
  return [
    { option: "standard", feePaise: 0, etaDaysMin: 3, etaDaysMax: 5 },
    { option: "express", feePaise: 0, etaDaysMin: 1, etaDaysMax: 2 },
  ];
}

const UNSERVICEABLE_RESULT: ServiceabilityResult = {
  serviceable: false,
  codAvailable: false,
  options: [],
};

export class MockShippingProvider implements ShippingProvider {
  async serviceability(a: {
    pincode: string;
    cod: boolean;
  }): Promise<ServiceabilityResult> {
    if (!PIN_RE.test(a.pincode) || UNSERVICEABLE.has(a.pincode)) {
      return UNSERVICEABLE_RESULT;
    }

    return {
      serviceable: true,
      codAvailable: !COD_UNAVAILABLE.has(a.pincode),
      options: options(),
    };
  }
}
