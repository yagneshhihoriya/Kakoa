/**
 * Shipping/serviceability abstraction (checkout.md §3, order-management.md).
 *
 * The provider answers ONE question: can this pincode be delivered to, and is COD
 * available there, and with what ETAs? It reports availability + ETA only — it does
 * NOT price shipping. Rupee fees for the standard/express options come from
 * store_settings and are applied by the checkout quote engine, so `feePaise` here
 * is a placeholder (0) that the quote layer overrides.
 *
 * No file outside `packages/integrations/src/shipping/**` may import Shiprocket
 * specifics; all consumers depend on this interface only.
 *
 * NOTE: The `ServiceabilityResult` shape is duplicated here to match the pinned
 * @kakoa/core contract while keeping this provider package independently
 * typecheckable. The core `contracts/checkout.ts` type is the single source of
 * truth once the checkout foundations land; keep these in exact sync.
 */

/** A single delivery option's availability + ETA (fee applied later by the quote engine). */
export interface ServiceabilityOption {
  option: "standard" | "express";
  /** Placeholder — real rupee fee comes from store_settings in the quote engine. */
  feePaise: number;
  etaDaysMin: number;
  etaDaysMax: number;
}

/** Result of a serviceability check for a pincode (checkout.md §5, ServiceabilityResult). */
export interface ServiceabilityResult {
  serviceable: boolean;
  codAvailable: boolean;
  options: ServiceabilityOption[];
}

export interface ShippingProvider {
  /**
   * Check whether a pincode is serviceable and which options apply.
   *
   * @param a.pincode - 6-digit Indian PIN (validated by caller; provider still guards).
   * @param a.cod     - Whether the caller cares about COD availability for this request.
   * @returns Serviceability + COD availability + option ETAs. When `serviceable`
   *   is false, `options` is empty and `codAvailable` is false.
   * @throws On a hard upstream failure (timeout/5xx after retry) so the Route
   *   Handler can surface `502 UPSTREAM_ERROR` per checkout.md §3.
   */
  serviceability(a: {
    pincode: string;
    cod: boolean;
  }): Promise<ServiceabilityResult>;
}
