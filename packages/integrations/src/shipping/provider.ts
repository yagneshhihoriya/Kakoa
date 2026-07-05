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

/** One line for a Shiprocket adhoc order. */
export interface CreateShipmentItem {
  name: string;
  sku: string;
  units: number;
  /** Unit selling price in paise (converted to rupees by the provider). */
  sellingPricePaise: number;
}

/**
 * The parcel + destination facts a shipment push needs. Built by the caller ONLY
 * from the order's address snapshot + variant physicals — the provider never
 * reaches back into our DB.
 */
export interface CreateShipmentInput {
  /** KAKOA order number (e.g. `KK-00042`) — the channel reference for idempotency. */
  orderNumber: string;
  /** Order placement time (ISO) — Shiprocket wants an `order_date`. */
  orderDateIso: string;
  cod: boolean;
  /** Goods value to declare / collect, in paise (COD collects this). */
  subTotalPaise: number;
  /** Registered Shiprocket pickup-location nickname (EXACT match). */
  pickupLocation: string;
  /** Destination + recipient (from the order's address snapshot). */
  billing: {
    name: string;
    phone: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    email?: string;
  };
  items: CreateShipmentItem[];
  /** Total packed weight in grams (> 0, validated by the caller). */
  weightGrams: number;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
}

/** A normalized courier scan (from `track` / webhook), pre-mapping. */
export interface TrackingScan {
  statusCode: number | null;
  statusLabel: string | null;
  activity: string | null;
  location: string | null;
  occurredAtIso: string | null;
}

/** Normalized tracking read — the CALLER maps `statusCode`/`statusLabel` → SHIPMENT_STATUSES. */
export interface TrackingResult {
  awb: string;
  statusCode: number | null;
  statusLabel: string | null;
  scans: TrackingScan[];
}

export interface LabelResult {
  labelUrl: string | null;
}
export interface ManifestResult {
  manifestUrl: string | null;
}
export interface PickupResult {
  pickupScheduledDateIso: string | null;
}

/** The gateway handles created for a shipment push. */
export interface CreateShipmentResult {
  shiprocketOrderId: string;
  shiprocketShipmentId: string;
}

/** The AWB + courier assigned to a shipment. */
export interface AssignAwbResult {
  awbCode: string;
  courierName: string;
  courierCompanyId: number;
  labelUrl: string | null;
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

  /**
   * Create a gateway order/shipment for a fulfilment-ready order (adhoc create).
   * Returns the provider order + shipment handles KAKOA persists. Idempotency is
   * the caller's job (channel reference = `orderNumber`).
   * @throws On a hard upstream failure so the route surfaces `502 UPSTREAM_ERROR`.
   */
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>;

  /**
   * Assign an AWB (courier tracking number) + courier to a created shipment.
   * `courierCompanyId` omitted ⇒ the provider picks the recommended courier.
   * @throws On a hard upstream failure so the route surfaces `502 UPSTREAM_ERROR`.
   */
  assignAwb(input: {
    shiprocketShipmentId: string;
    courierCompanyId?: number;
  }): Promise<AssignAwbResult>;

  /** Generate (or fetch) the shipping-label PDF for one or more SR shipment ids. */
  getLabel(shiprocketShipmentIds: string[]): Promise<LabelResult>;

  /** Generate the manifest PDF for one or more SR shipment ids. */
  getManifest(shiprocketShipmentIds: string[]): Promise<ManifestResult>;

  /** Request a courier pickup for one or more SR shipment ids. */
  requestPickup(shiprocketShipmentIds: string[]): Promise<PickupResult>;

  /** Track by AWB — returns the raw SR status code/label + scans (caller maps them). */
  track(awb: string): Promise<TrackingResult>;
}
