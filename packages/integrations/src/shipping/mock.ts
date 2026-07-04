import { createHmac } from "node:crypto";
import type {
  AssignAwbResult,
  CreateShipmentInput,
  CreateShipmentResult,
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

/** Deterministic 8-hex tag from a seed — no Math.random, so it's replay-stable. */
function tag(seed: string): string {
  return createHmac("sha256", "kkmock").update(seed).digest("hex").slice(0, 8).toUpperCase();
}

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

  /**
   * Mock create: fabricate deterministic SR order/shipment handles from the order
   * number so the fulfilment flow runs end-to-end with no Shiprocket account.
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- async to satisfy the interface
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (!Number.isInteger(input.weightGrams) || input.weightGrams <= 0) {
      throw new Error(`MockShippingProvider.createShipment: bad weightGrams ${input.weightGrams}`);
    }
    const t = tag(input.orderNumber);
    return {
      shiprocketOrderId: `KKMOCK-SO-${t}`,
      shiprocketShipmentId: `KKMOCK-SH-${t}`,
    };
  }

  /**
   * Mock AWB assignment: fabricate a deterministic AWB + a fixed "Mock Express"
   * courier. `labelUrl` is null (label generation is Phase 2-3).
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- async to satisfy the interface
  async assignAwb(input: {
    shiprocketShipmentId: string;
    courierCompanyId?: number;
  }): Promise<AssignAwbResult> {
    return {
      awbCode: `KKMOCK${tag(input.shiprocketShipmentId)}`,
      courierName: "Mock Express",
      courierCompanyId: input.courierCompanyId ?? 1,
      labelUrl: null,
    };
  }
}
