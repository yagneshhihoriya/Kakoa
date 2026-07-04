/**
 * Timeline derivation — order-tracking.md §3 (normative). PURE + DB-free so it
 * is unit-testable without an ephemeral Postgres: given the order's current
 * status + its `order_status_history` rows, produce the `TimelineStep[]` rail.
 *
 * The DB-touching wrapper (`buildTimeline`, `getOrderTracking`) lives in
 * `tracking.ts` and calls `deriveTimeline` here. Kept in its own module so the
 * derivation logic never drags `@kakoa/db` / `next/headers` into a unit test.
 */
import type {
  OrderStatus,
  TimelineStep,
  TimelineStepKey,
} from '@kakoa/core';

/** The happy-path rail (§3.1). Branch rails replace the tail (§3.5). */
export const HAPPY_RAIL: readonly TimelineStepKey[] = [
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
];

/** Customer-facing labels for each timeline node. */
export const STEP_LABELS: Record<TimelineStepKey, string> = {
  placed: 'Order placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rto_initiated: 'Returning to seller',
  rto_delivered: 'Returned to seller',
};

/**
 * Payment/COD sub-states collapse into the `placed` step (§3.2): they are
 * internal payment states, not customer timeline milestones.
 */
const PLACED_STATUSES: readonly OrderStatus[] = [
  'pending_payment',
  'payment_failed',
  'cod_pending_confirmation',
];

/** Map an order status to the timeline key it contributes an `at` to. */
function statusToKey(status: OrderStatus): TimelineStepKey {
  if (PLACED_STATUSES.includes(status)) return 'placed';
  return status as TimelineStepKey;
}

/** One `order_status_history` row, in the minimal shape the derivation needs. */
export interface HistoryRow {
  toStatus: OrderStatus;
  /** ISO-8601 UTC. */
  at: string;
}

/**
 * Build the timeline rail for an order (order-tracking.md §3 — normative).
 *
 * @param currentStatus the order's live `status`.
 * @param history       every `order_status_history` row for the order, ASC by
 *                      `created_at` (the caller supplies them ordered).
 * @param placedAt      `orders.placed_at` (ISO UTC) — authoritative `placed.at`.
 * @param expectedDeliveryAt optional active-shipment ETD (ISO UTC) — populates
 *                      the `delivered` step's `expected` only (§3.4).
 *
 * Rules applied:
 *  - Base rail is the happy path; `cancelled` / `rto_*` branches replace the
 *    delivery tail while KEEPING the steps already reached before the branch.
 *  - `at` per key = the LATEST history row with that `to_status`; `placed.at`
 *    is always `orders.placed_at`.
 *  - `state`: the reached step with the newest `at` is `active`; earlier reached
 *    steps are `done`; unreached steps are `future`.
 */
export function deriveTimeline(input: {
  currentStatus: OrderStatus;
  history: readonly HistoryRow[];
  placedAt: string;
  expectedDeliveryAt?: string | null;
}): TimelineStep[] {
  const { currentStatus, history, placedAt, expectedDeliveryAt = null } = input;

  // Latest `at` per timeline key (later rows overwrite earlier — history is ASC).
  // `placed.at` is authoritative from `orders.placed_at` (§3.2) and is NEVER
  // overwritten by a collapsed payment sub-state's history timestamp.
  const atByKey = new Map<TimelineStepKey, string>();
  for (const row of history) {
    const key = statusToKey(row.toStatus);
    if (key === 'placed') continue; // payment sub-states don't move placed.at
    atByKey.set(key, row.at);
  }
  atByKey.set('placed', placedAt);

  // Choose the rail. Branches (§3.5) reuse the happy prefix up to the branch
  // point, then swap the delivery tail for the branch's own steps.
  let rail: TimelineStepKey[];
  if (currentStatus === 'cancelled') {
    // placed → cancelled, PLUS any steps reached before the cancel.
    const reachedPrefix = HAPPY_RAIL.filter((k) => atByKey.has(k));
    rail = [...reachedPrefix, 'cancelled'];
  } else if (
    currentStatus === 'rto_initiated' ||
    currentStatus === 'rto_delivered'
  ) {
    // Keep placed→shipped; replace the post-shipped delivery tail with the RTO
    // branch (§3.5). `out_for_delivery`/`delivered` are dropped.
    const kept = HAPPY_RAIL.slice(0, HAPPY_RAIL.indexOf('shipped') + 1);
    rail =
      currentStatus === 'rto_delivered'
        ? [...kept, 'rto_initiated', 'rto_delivered']
        : [...kept, 'rto_initiated'];
  } else {
    rail = [...HAPPY_RAIL];
  }

  // The `active` node is the reached step with the newest timestamp — for a
  // linear rail that is the last reached key. Compute it by max `at`.
  let activeKey: TimelineStepKey | null = null;
  let activeAt = -Infinity;
  for (const key of rail) {
    const at = atByKey.get(key);
    if (at === undefined) continue;
    const ms = Date.parse(at);
    if (ms >= activeAt) {
      activeAt = ms;
      activeKey = key;
    }
  }

  return rail.map((key) => {
    const at = atByKey.get(key) ?? null;
    const state: TimelineStep['state'] =
      at === null ? 'future' : key === activeKey ? 'active' : 'done';
    return {
      key,
      label: STEP_LABELS[key],
      state,
      at,
      // `expected` populated only on the `delivered` step, from the active
      // shipment's ETD (§3.4). Everything else is null.
      expected: key === 'delivered' ? expectedDeliveryAt : null,
    };
  });
}
