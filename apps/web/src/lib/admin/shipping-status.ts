/**
 * Pure shipment status machine + AWB validation — NO @kakoa/db import, so it's
 * unit-testable and the single source of truth for the monotonic guard the data
 * layer and UI both rely on.
 *
 * Two tracks:
 *  - Forward: pending → awb_assigned → pickup_scheduled → picked_up → in_transit
 *    → out_for_delivery → delivered.
 *  - RTO (separate, ascending): rto_initiated → rto_in_transit → rto_delivered,
 *    enterable only from an IN-FLIGHT forward state (picked_up..out_for_delivery).
 * Terminals (no further transitions): delivered, rto_delivered, cancelled, lost.
 * `cancelled` / `lost` are enterable from ANY non-terminal state. Never regress.
 */
import { type ShipmentStatus } from '@kakoa/core';

/** Forward-track rank (RTO is a separate ascending sub-track; see below). */
export const SHIPMENT_RANK: Record<ShipmentStatus, number> = {
  pending: 0,
  awb_assigned: 1,
  pickup_scheduled: 2,
  picked_up: 3,
  in_transit: 4,
  out_for_delivery: 5,
  delivered: 6,
  // RTO sub-track — ascending on its own scale, not comparable to the forward ranks.
  rto_initiated: 0,
  rto_in_transit: 1,
  rto_delivered: 2,
  // Exception terminals.
  cancelled: -1,
  lost: -1,
};

export const TERMINAL_SHIPMENT_STATUSES = [
  'delivered',
  'rto_delivered',
  'cancelled',
  'lost',
] as const satisfies readonly ShipmentStatus[];

export function isTerminalShipment(status: ShipmentStatus): boolean {
  return (TERMINAL_SHIPMENT_STATUSES as readonly string[]).includes(status);
}

/** In-flight forward states from which the RTO track may be entered. */
const RTO_ENTRY_FROM = new Set<ShipmentStatus>([
  'picked_up',
  'in_transit',
  'out_for_delivery',
]);

/**
 * The legal "advance" adjacency (excludes cancel/lost, which are exceptions
 * handled separately). `pending → awb_assigned` is done via the Assign-AWB
 * action, not a plain advance, so it's excluded from `nextShipmentStatuses`.
 */
const FORWARD_NEXT: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  pending: ['awb_assigned'],
  awb_assigned: ['pickup_scheduled'],
  pickup_scheduled: ['picked_up'],
  picked_up: ['in_transit', 'rto_initiated'],
  in_transit: ['out_for_delivery', 'rto_initiated'],
  out_for_delivery: ['delivered', 'rto_initiated'],
  delivered: [],
  rto_initiated: ['rto_in_transit'],
  rto_in_transit: ['rto_delivered'],
  rto_delivered: [],
  cancelled: [],
  lost: [],
};

/**
 * Can the shipment move `from → to`? Enforces monotonic, non-regressing moves:
 *  - never from a terminal state;
 *  - `cancelled` / `lost` from any non-terminal;
 *  - `rto_initiated` only from an in-flight forward state;
 *  - otherwise only the declared forward/RTO next step(s).
 */
export function canAdvanceShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  if (isTerminalShipment(from)) return false;
  if (from === to) return false;
  // Exception terminals: enterable from any non-terminal state.
  if (to === 'cancelled' || to === 'lost') return true;
  // RTO entry is gated to in-flight forward states.
  if (to === 'rto_initiated') return RTO_ENTRY_FROM.has(from);
  return (FORWARD_NEXT[from] as readonly string[]).includes(to);
}

/**
 * Advance targets to offer in the UI (excludes `awb_assigned`, which is the
 * Assign-AWB action, and the always-available `cancelled`/`lost` exceptions).
 */
export function nextShipmentStatuses(from: ShipmentStatus): ShipmentStatus[] {
  if (isTerminalShipment(from)) return [];
  return FORWARD_NEXT[from].filter((s) => s !== 'awb_assigned');
}

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending: 'Pending',
  awb_assigned: 'AWB assigned',
  pickup_scheduled: 'Pickup scheduled',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  rto_initiated: 'RTO initiated',
  rto_in_transit: 'RTO in transit',
  rto_delivered: 'RTO delivered',
  cancelled: 'Cancelled',
  lost: 'Lost',
};

export function shipmentStatusLabel(status: string): string {
  return SHIPMENT_STATUS_LABEL[status as ShipmentStatus] ?? status.replace(/_/g, ' ');
}

/* ── AWB input validation ───────────────────────────────────────────── */

const AWB_RE = /^[A-Za-z0-9-]{4,40}$/;

export interface AwbInput {
  awbCode: string;
  courierName: string | null;
  courierCompanyId: number | null;
}

export type AwbValidation =
  | { ok: true; value: AwbInput }
  | { ok: false; message: string };

/** Validate a manual/gateway AWB payload before it touches the DB. */
export function validateAwbInput(raw: unknown): AwbValidation {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'Invalid AWB payload.' };
  }
  const b = raw as Record<string, unknown>;

  const awbCode = typeof b.awbCode === 'string' ? b.awbCode.trim() : '';
  if (!AWB_RE.test(awbCode)) {
    return { ok: false, message: 'AWB must be 4–40 characters: letters, digits or hyphen.' };
  }

  let courierName: string | null = null;
  if (b.courierName !== undefined && b.courierName !== null && b.courierName !== '') {
    if (typeof b.courierName !== 'string' || b.courierName.trim().length > 80) {
      return { ok: false, message: 'Courier name must be 80 characters or fewer.' };
    }
    courierName = b.courierName.trim();
  }

  let courierCompanyId: number | null = null;
  if (b.courierCompanyId !== undefined && b.courierCompanyId !== null && b.courierCompanyId !== '') {
    const n = Number(b.courierCompanyId);
    if (!Number.isInteger(n) || n < 1 || n > 2_147_483_647) {
      return { ok: false, message: 'Courier company id must be a positive whole number.' };
    }
    courierCompanyId = n;
  }

  return { ok: true, value: { awbCode, courierName, courierCompanyId } };
}
