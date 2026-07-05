/**
 * Pure Shiprocket status-code → shipment-status mapper (verified codes from the
 * Shiprocket support helpsheets + Postman workspace). Unit-testable, no I/O.
 *
 * The local union mirrors `@kakoa/core` `SHIPMENT_STATUSES` exactly (integrations
 * doesn't depend on core); the app treats the result as a `ShipmentStatus`.
 * Unmapped codes fall back to a scan LABEL substring match ("delivered", "rto",
 * "out for delivery", …) so an unpublished code is still classified, not crashed.
 */

/** Mirrors `@kakoa/core` SHIPMENT_STATUSES (kept in exact sync). */
export type ShipmentStatusName =
  | 'pending'
  | 'awb_assigned'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'rto_initiated'
  | 'rto_in_transit'
  | 'rto_delivered'
  | 'cancelled'
  | 'lost';

/** Confirmed SR `shipment_status_id` → our status (see HANDOFF-Shiprocket §2). */
export const SHIPROCKET_STATUS_CODES: Readonly<Record<number, ShipmentStatusName>> = {
  1: 'awb_assigned', // AWB assigned
  2: 'awb_assigned', // label generated
  5: 'awb_assigned', // manifest generated
  3: 'pickup_scheduled',
  4: 'pickup_scheduled', // queued for pickup
  19: 'pickup_scheduled', // out for pickup
  42: 'picked_up',
  6: 'in_transit', // shipped
  18: 'in_transit', // in transit
  20: 'in_transit', // reached destination hub
  38: 'in_transit',
  17: 'out_for_delivery',
  7: 'delivered',
  9: 'rto_initiated',
  14: 'rto_initiated', // RTO acknowledged
  40: 'rto_initiated', // RTO NDR
  41: 'rto_in_transit',
  46: 'rto_in_transit',
  10: 'rto_delivered',
  8: 'cancelled',
  16: 'cancelled',
  45: 'cancelled',
  12: 'lost',
};

/** Ordered label substrings for the fallback (most specific first). */
const LABEL_FALLBACKS: readonly [RegExp, ShipmentStatusName][] = [
  [/rto.*deliver/i, 'rto_delivered'],
  [/rto/i, 'rto_initiated'],
  [/out for delivery/i, 'out_for_delivery'],
  [/deliver/i, 'delivered'],
  [/picked up/i, 'picked_up'],
  [/in.?transit|shipped|dispatch/i, 'in_transit'],
  [/pickup/i, 'pickup_scheduled'],
  [/cancel/i, 'cancelled'],
  [/lost/i, 'lost'],
];

/**
 * Map a Shiprocket status code (+ optional label) to our shipment status.
 * Returns `null` for an unrecognized code with no matching label (the caller
 * logs it + skips — never guesses, never crashes).
 */
export function mapShiprocketStatus(
  code: number | string | null | undefined,
  label?: string | null,
): ShipmentStatusName | null {
  const numeric = typeof code === 'string' ? Number(code) : code;
  if (numeric !== null && numeric !== undefined && Number.isFinite(numeric)) {
    const mapped = SHIPROCKET_STATUS_CODES[numeric];
    if (mapped !== undefined) return mapped;
  }
  if (typeof label === 'string' && label.trim() !== '') {
    for (const [re, status] of LABEL_FALLBACKS) {
      if (re.test(label)) return status;
    }
  }
  return null;
}
