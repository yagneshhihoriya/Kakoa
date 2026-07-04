import { parseServerEnv } from "@kakoa/config";
import type {
  ServiceabilityResult,
  ShippingProvider,
} from "./provider";

/**
 * Shiprocket shipping provider (order-management.md, checkout.md §3) — STUB.
 *
 * Shiprocket is the serviceability/fulfilment pipe. No file outside this directory
 * may import Shiprocket specifics.
 *
 * Real flow (verify at integration):
 *   1. POST https://apiv2.shiprocket.in/v1/external/auth/login with
 *      { email: SHIPROCKET_EMAIL, password: SHIPROCKET_PASSWORD } → { token }.
 *      Cache the token (valid ~10 days) and refresh on 401.
 *   2. GET .../courier/serviceability?pickup_postcode=<seller>&delivery_postcode=<pin>
 *      &cod=<0|1>&weight=<kg> with Authorization: Bearer <token> → available couriers,
 *      COD flag, and estimated_delivery_days → map to standard/express options.
 *
 * Not implemented yet: getShippingProvider only selects this provider when
 * SHIPROCKET_EMAIL is configured; until the token flow is wired it throws so a
 * misconfiguration surfaces loudly rather than silently degrading.
 */
export class ShiprocketShippingProvider implements ShippingProvider {
  async serviceability(_a: {
    pincode: string;
    cod: boolean;
  }): Promise<ServiceabilityResult> {
    // Guard: this provider is only selected when SHIPROCKET_EMAIL is set, but
    // require the password too before pretending we can talk to Shiprocket.
    const env = parseServerEnv();
    if (env.SHIPROCKET_EMAIL === undefined || env.SHIPROCKET_PASSWORD === undefined) {
      throw new Error("Shiprocket provider selected without credentials");
    }
    throw new Error(
      "ShiprocketShippingProvider.serviceability not implemented — wire token + courier serviceability at integration",
    );
  }
}
