/**
 * Pure payment/refund money-math + presentation helpers — NO @kakoa/db import,
 * so they're unit-testable in isolation and safe from route/Edge code. The
 * money rules (remaining-refundable, over-refund guard, destination legality)
 * live here as the SINGLE source of truth the data layer and UI both call, so
 * the "never over-refund" invariant is enforced in one place.
 */
import {
  formatPaise,
  REFUND_DESTINATIONS,
  type PaymentStatus,
  type RefundDestination,
} from '@kakoa/core';

/** Postgres int4 ceiling — every paise column is int4 (guard before the DB, else 22003). */
export const INT4_MAX = 2_147_483_647;

/**
 * Collected/settled money states (prepaid captured + COD collected). This is the
 * SAME set `metrics.ts` uses for net revenue — exported here as the single source
 * of truth (metrics imports it) so the two can never drift.
 */
export const COLLECTED_PAYMENT_STATUSES = [
  'captured',
  'partially_refunded',
  'refunded',
  'cod_collected',
  'cod_pending_remittance',
] as const satisfies readonly PaymentStatus[];

export function isCollectedStatus(status: string): boolean {
  return (COLLECTED_PAYMENT_STATUSES as readonly string[]).includes(status);
}

/** COD payments queued for remittance marking (the `payments_cod_remit_idx` set). */
export const COD_REMIT_QUEUE_STATUSES = [
  'cod_collected',
  'cod_pending_remittance',
] as const satisfies readonly PaymentStatus[];

/** A COD-remit action is valid only from a collected-COD state. */
export function isCodRemittable(status: string): boolean {
  return (COD_REMIT_QUEUE_STATUSES as readonly string[]).includes(status);
}

/**
 * Money is refundable only once it has been COLLECTED. `created`/`authorized`/
 * `failed`/`cod_pending_collection` never captured anything → nothing to refund.
 * (`refunded` is technically collected but has zero remaining — the amount guard
 * rejects it with a clearer message.)
 */
const REFUNDABLE_STATUSES = [
  'captured',
  'partially_refunded',
  'refunded',
  'cod_collected',
  'cod_pending_remittance',
  'cod_remitted',
] as const satisfies readonly PaymentStatus[];

export function isRefundableStatus(status: string): boolean {
  return (REFUNDABLE_STATUSES as readonly string[]).includes(status);
}

/** Remaining refundable paise, clamped to ≥ 0 (never negative even on dirty data). */
export function remainingRefundablePaise(
  amountPaise: number,
  amountRefundedPaise: number,
): number {
  return Math.max(0, amountPaise - amountRefundedPaise);
}

export type RefundAmountCheck =
  | { ok: true; amountPaise: number }
  | { ok: false; message: string };

/**
 * Validate a requested refund amount: a positive int4 that does not exceed the
 * remaining refundable balance. This is the over-refund guard — the caller
 * computes `remaining` under a row lock and passes it in.
 */
export function validateRefundAmount(
  amountPaise: unknown,
  remaining: number,
): RefundAmountCheck {
  const n = Number(amountPaise);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, message: 'Enter a refund amount greater than ₹0.' };
  }
  if (n > INT4_MAX) {
    return { ok: false, message: 'That amount is out of the allowed range.' };
  }
  if (remaining <= 0) {
    return { ok: false, message: 'This payment has already been fully refunded.' };
  }
  if (n > remaining) {
    return {
      ok: false,
      message: `You can refund at most ${formatPaise(remaining)} more.`,
    };
  }
  return { ok: true, amountPaise: n };
}

/** A payment is COD when its provider or method is `cod`. */
export function isCodPayment(provider: string, method: string): boolean {
  return provider === 'cod' || method === 'cod';
}

export type RefundDestinationCheck =
  | { ok: true; destination: RefundDestination }
  | { ok: false; message: string };

/**
 * Prepaid refunds go back to `original_method` (Razorpay). COD refunds are manual
 * payouts, so they must target `bank_transfer` / `upi` and never `original_method`.
 */
export function validateRefundDestination(
  destination: unknown,
  isCod: boolean,
): RefundDestinationCheck {
  if (
    typeof destination !== 'string' ||
    !(REFUND_DESTINATIONS as readonly string[]).includes(destination)
  ) {
    return { ok: false, message: 'Choose a valid refund destination.' };
  }
  const d = destination as RefundDestination;
  if (isCod) {
    if (d === 'original_method') {
      return { ok: false, message: 'COD refunds must be paid out to a bank transfer or UPI.' };
    }
  } else if (d !== 'original_method') {
    return { ok: false, message: 'Prepaid refunds go back to the original payment method.' };
  }
  return { ok: true, destination: d };
}

/** The payment status after applying a refund of `refundPaise` to the current ledger. */
export function nextStatusAfterRefund(
  amountPaise: number,
  amountRefundedPaise: number,
  refundPaise: number,
): 'partially_refunded' | 'refunded' {
  return amountRefundedPaise + refundPaise >= amountPaise
    ? 'refunded'
    : 'partially_refunded';
}

/* ── Presentation ──────────────────────────────────────────────────── */

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  created: 'Created',
  authorized: 'Authorized',
  captured: 'Captured',
  failed: 'Failed',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  cod_pending_collection: 'COD · pending collection',
  cod_collected: 'COD · collected',
  cod_pending_remittance: 'COD · pending remittance',
  cod_remitted: 'COD · remitted',
};

export type Tone = 'success' | 'danger' | 'warn' | 'refund' | 'neutral';

export const PAYMENT_STATUS_TONE: Record<string, Tone> = {
  created: 'neutral',
  authorized: 'warn',
  captured: 'success',
  failed: 'danger',
  partially_refunded: 'refund',
  refunded: 'refund',
  cod_pending_collection: 'warn',
  cod_collected: 'success',
  cod_pending_remittance: 'warn',
  cod_remitted: 'success',
};

export const REFUND_STATUS_LABEL: Record<string, string> = {
  initiated: 'Initiated',
  processed: 'Processed',
  failed: 'Failed',
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  card: 'Card',
  upi: 'UPI',
  netbanking: 'Netbanking',
  wallet: 'Wallet',
  emi: 'EMI',
  cod: 'Cash on delivery',
  unknown: 'Unknown',
};

export const REFUND_DESTINATION_LABEL: Record<string, string> = {
  original_method: 'Original method',
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
};

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status] ?? status.replace(/_/g, ' ');
}

export function methodLabel(method: string): string {
  return PAYMENT_METHOD_LABEL[method] ?? method.replace(/_/g, ' ');
}
