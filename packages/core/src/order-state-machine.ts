/**
 * Order state machine — Contract §1.27 (PROJECT_PLAN.md §3.0), normative.
 *
 * The transition map is DATA: imported by the API layer (transition
 * execution), the admin UI (button enablement), and tests. Anything not in
 * the map is rejected with 422 `INVALID_TRANSITION`. Transition execution
 * (server-side) is `SELECT ... FOR UPDATE` → validate against this map →
 * `UPDATE orders` + `INSERT order_status_history` + side effects, one tx.
 */

import type { ActorType, OrderStatus } from './enums';

export interface OrderTransition {
  readonly to: OrderStatus;
  /** Human-readable trigger description, verbatim from Contract §1.27. */
  readonly trigger: string;
  /** Actor types (Contract `actor_type`) allowed to drive this transition. */
  readonly actors: readonly ActorType[];
}

/**
 * Legal transitions per Contract §1.27. Keys are exhaustive over the 11
 * order statuses; terminal states map to an empty list.
 */
export const ORDER_TRANSITIONS = {
  pending_payment: [
    {
      to: 'confirmed',
      trigger: '`payment.captured` webhook or `/checkout/verify`',
      actors: ['system', 'webhook'],
    },
    {
      to: 'payment_failed',
      trigger: '`payment.failed` webhook',
      actors: ['webhook'],
    },
    {
      to: 'cancelled',
      trigger: '30-min expiry Inngest job; customer cancel',
      actors: ['system', 'customer'],
    },
  ],
  payment_failed: [
    {
      to: 'pending_payment',
      trigger: 'customer retry-payment',
      actors: ['customer'],
    },
    {
      to: 'cancelled',
      trigger: '24h expiry job; customer',
      actors: ['system', 'customer'],
    },
  ],
  cod_pending_confirmation: [
    {
      to: 'confirmed',
      trigger: 'admin confirm-COD action; customer self-confirm link',
      actors: ['admin', 'customer'],
    },
    {
      to: 'cancelled',
      trigger: 'admin decline; customer cancel; 48h-unreachable job',
      actors: ['admin', 'customer', 'system'],
    },
  ],
  confirmed: [
    { to: 'packed', trigger: 'admin', actors: ['admin'] },
    {
      to: 'cancelled',
      trigger: 'admin/customer (auto-refund if prepaid)',
      actors: ['admin', 'customer'],
    },
  ],
  packed: [
    {
      to: 'shipped',
      trigger: 'Shiprocket pickup webhook/poll; admin',
      actors: ['webhook', 'system', 'admin'],
    },
    {
      to: 'cancelled',
      trigger: 'admin (rare; auto-refund)',
      actors: ['admin'],
    },
  ],
  shipped: [
    {
      to: 'out_for_delivery',
      trigger: 'webhook/poll',
      actors: ['webhook', 'system'],
    },
    {
      to: 'delivered',
      trigger: 'webhook/poll (couriers sometimes skip OFD scan)',
      actors: ['webhook', 'system'],
    },
    {
      to: 'rto_initiated',
      trigger: 'webhook/poll',
      actors: ['webhook', 'system'],
    },
  ],
  out_for_delivery: [
    {
      to: 'delivered',
      trigger: 'webhook/poll',
      actors: ['webhook', 'system'],
    },
    {
      to: 'rto_initiated',
      trigger: 'webhook/poll (failed attempts/NDR)',
      actors: ['webhook', 'system'],
    },
  ],
  delivered: [],
  cancelled: [],
  rto_initiated: [
    {
      to: 'out_for_delivery',
      trigger: 'webhook/poll (NDR resolved, re-attempt)',
      actors: ['webhook', 'system'],
    },
    {
      to: 'rto_delivered',
      trigger: 'webhook/poll; admin',
      actors: ['webhook', 'system', 'admin'],
    },
  ],
  rto_delivered: [],
} as const satisfies Record<OrderStatus, readonly OrderTransition[]>;

/** Terminal states — Contract §1.27 states table. */
export const TERMINAL_STATES = [
  'delivered',
  'cancelled',
  'rto_delivered',
] as const satisfies readonly OrderStatus[];

export type TerminalOrderStatus = (typeof TERMINAL_STATES)[number];

export function isTerminal(status: OrderStatus): boolean {
  return (TERMINAL_STATES as readonly OrderStatus[]).includes(status);
}

/** True iff `from → to` is a legal transition per Contract §1.27. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].some((t) => t.to === to);
}

/** Thrown by `assertTransition` for illegal moves — maps to 422 `INVALID_TRANSITION`. */
export class IllegalTransitionError extends Error {
  override readonly name = 'IllegalTransitionError';
  readonly code = 'INVALID_TRANSITION' as const;
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Illegal order transition: ${from} -> ${to}`);
  }
}

/** Throws `IllegalTransitionError` unless `from → to` is in the map. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
}

/** All statuses reachable from `from` in one legal step. */
export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from].map((t) => t.to);
}
