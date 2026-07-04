import { parseServerEnv } from "@kakoa/config";
import type {
  AssignAwbResult,
  CreateShipmentInput,
  CreateShipmentResult,
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

  // TODO(shipping Phase 2-3): implement against apiv2.shiprocket.in with the
  // 240h bearer token (store_settings) + 401 refresh-and-retry-once. Until then
  // this provider is only selected when SHIPROCKET_EMAIL is set and throws so a
  // misconfiguration surfaces loudly rather than silently degrading.
  // eslint-disable-next-line @typescript-eslint/require-await -- stub
  async createShipment(_input: CreateShipmentInput): Promise<CreateShipmentResult> {
    throw new Error(
      "ShiprocketShippingProvider.createShipment not implemented — Phase 2-3 (POST /v1/external/orders/create/adhoc)",
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- stub
  async assignAwb(_input: {
    shiprocketShipmentId: string;
    courierCompanyId?: number;
  }): Promise<AssignAwbResult> {
    throw new Error(
      "ShiprocketShippingProvider.assignAwb not implemented — Phase 2-3 (POST /v1/external/courier/assign/awb)",
    );
  }
}
