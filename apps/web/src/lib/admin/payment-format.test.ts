/**
 * Unit tests for the pure payment/refund money-math + rules. These are the
 * money-critical invariants (never over-refund, partials sum correctly, COD
 * destination legality, collected-status predicate) — no @kakoa/db needed.
 */
import { describe, expect, it } from 'vitest';
import {
  COLLECTED_PAYMENT_STATUSES,
  INT4_MAX,
  isCodPayment,
  isCodRemittable,
  isCollectedStatus,
  isRefundableStatus,
  nextStatusAfterRefund,
  remainingRefundablePaise,
  validateRefundAmount,
  validateRefundDestination,
} from './payment-format';

describe('remainingRefundablePaise', () => {
  it('is amount minus refunded', () => {
    expect(remainingRefundablePaise(10_000, 3_000)).toBe(7_000);
    expect(remainingRefundablePaise(10_000, 0)).toBe(10_000);
    expect(remainingRefundablePaise(10_000, 10_000)).toBe(0);
  });

  it('never goes negative on dirty data', () => {
    expect(remainingRefundablePaise(10_000, 12_000)).toBe(0);
  });
});

describe('validateRefundAmount (never over-refund)', () => {
  const remaining = 5_000;

  it('accepts a positive integer within the remaining balance', () => {
    expect(validateRefundAmount(5_000, remaining)).toEqual({ ok: true, amountPaise: 5_000 });
    expect(validateRefundAmount(1, remaining)).toEqual({ ok: true, amountPaise: 1 });
  });

  it('rejects an amount greater than the remaining balance', () => {
    const r = validateRefundAmount(5_001, remaining);
    expect(r.ok).toBe(false);
  });

  it('rejects zero, negative and non-integer amounts', () => {
    expect(validateRefundAmount(0, remaining).ok).toBe(false);
    expect(validateRefundAmount(-100, remaining).ok).toBe(false);
    expect(validateRefundAmount(10.5, remaining).ok).toBe(false);
    expect(validateRefundAmount(Number.NaN, remaining).ok).toBe(false);
  });

  it('rejects when there is nothing left to refund', () => {
    expect(validateRefundAmount(1, 0).ok).toBe(false);
  });

  it('rejects an amount beyond the int4 ceiling', () => {
    expect(validateRefundAmount(INT4_MAX + 1, INT4_MAX + 1).ok).toBe(false);
  });
});

describe('nextStatusAfterRefund (partials sum correctly)', () => {
  it('is partially_refunded while a balance remains', () => {
    expect(nextStatusAfterRefund(10_000, 0, 4_000)).toBe('partially_refunded');
    expect(nextStatusAfterRefund(10_000, 4_000, 3_000)).toBe('partially_refunded');
  });

  it('is refunded once the sum reaches the full amount', () => {
    expect(nextStatusAfterRefund(10_000, 0, 10_000)).toBe('refunded');
    expect(nextStatusAfterRefund(10_000, 4_000, 6_000)).toBe('refunded');
  });

  it('two partials that sum to the total end refunded', () => {
    // first 3000 → partially, then 7000 → refunded
    expect(nextStatusAfterRefund(10_000, 0, 3_000)).toBe('partially_refunded');
    expect(nextStatusAfterRefund(10_000, 3_000, 7_000)).toBe('refunded');
  });
});

describe('validateRefundDestination', () => {
  it('prepaid must be original_method', () => {
    expect(validateRefundDestination('original_method', false).ok).toBe(true);
    expect(validateRefundDestination('bank_transfer', false).ok).toBe(false);
    expect(validateRefundDestination('upi', false).ok).toBe(false);
  });

  it('COD must be bank_transfer or upi, never original_method', () => {
    expect(validateRefundDestination('bank_transfer', true).ok).toBe(true);
    expect(validateRefundDestination('upi', true).ok).toBe(true);
    expect(validateRefundDestination('original_method', true).ok).toBe(false);
  });

  it('rejects an unknown destination', () => {
    expect(validateRefundDestination('paypal', false).ok).toBe(false);
    expect(validateRefundDestination(undefined, true).ok).toBe(false);
  });
});

describe('status predicates', () => {
  it('collected set matches metrics', () => {
    expect([...COLLECTED_PAYMENT_STATUSES]).toEqual([
      'captured',
      'partially_refunded',
      'refunded',
      'cod_collected',
      'cod_pending_remittance',
    ]);
    expect(isCollectedStatus('captured')).toBe(true);
    expect(isCollectedStatus('failed')).toBe(false);
    expect(isCollectedStatus('created')).toBe(false);
  });

  it('refundable only once collected', () => {
    expect(isRefundableStatus('captured')).toBe(true);
    expect(isRefundableStatus('partially_refunded')).toBe(true);
    expect(isRefundableStatus('cod_collected')).toBe(true);
    // never captured → nothing to refund
    expect(isRefundableStatus('created')).toBe(false);
    expect(isRefundableStatus('authorized')).toBe(false);
    expect(isRefundableStatus('failed')).toBe(false);
    expect(isRefundableStatus('cod_pending_collection')).toBe(false);
  });

  it('cod-remittable only from a collected-COD state', () => {
    expect(isCodRemittable('cod_collected')).toBe(true);
    expect(isCodRemittable('cod_pending_remittance')).toBe(true);
    expect(isCodRemittable('cod_remitted')).toBe(false);
    expect(isCodRemittable('captured')).toBe(false);
  });

  it('detects COD by provider or method', () => {
    expect(isCodPayment('cod', 'cod')).toBe(true);
    expect(isCodPayment('razorpay', 'cod')).toBe(true);
    expect(isCodPayment('cod', 'unknown')).toBe(true);
    expect(isCodPayment('razorpay', 'card')).toBe(false);
  });
});
