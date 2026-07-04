import { describe, expect, it } from 'vitest';
import { couponStatus, validateCouponInput } from './coupon-validation';

const NOW = new Date('2026-07-04T00:00:00Z');
const base = {
  code: 'save10',
  kind: 'percent',
  percent: 10,
  startsAt: '2026-07-01T00:00:00Z',
};

describe('validateCouponInput', () => {
  it('accepts a percent coupon, uppercases code, sets percentBp and null flat', () => {
    const r = validateCouponInput(base, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.code).toBe('SAVE10');
      expect(r.value.percentBp).toBe(1000);
      expect(r.value.flatPaise).toBeNull();
      expect(r.value.perCustomerLimit).toBe(1);
    }
  });

  it('accepts a flat coupon (₹200 → 20000 paise) and nulls percent', () => {
    const r = validateCouponInput({ code: 'FLAT200', kind: 'flat', flatRupees: 200 }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.flatPaise).toBe(20000);
      expect(r.value.percentBp).toBeNull();
    }
  });

  it('converts percent max-discount ₹ → paise, only for percent', () => {
    const r = validateCouponInput({ ...base, maxDiscountRupees: 500 }, NOW);
    expect(r.ok && r.value.maxDiscountPaise).toBe(50000);
  });

  it('rejects a bad code', () => {
    expect(validateCouponInput({ ...base, code: 'ab' }, NOW).ok).toBe(false);
    expect(validateCouponInput({ ...base, code: 'has space' }, NOW).ok).toBe(false);
    expect(validateCouponInput({ ...base, code: 'x'.repeat(25) }, NOW).ok).toBe(false);
  });

  it('rejects percent out of range and non-positive flat', () => {
    expect(validateCouponInput({ ...base, percent: 0 }, NOW).ok).toBe(false);
    expect(validateCouponInput({ ...base, percent: 150 }, NOW).ok).toBe(false);
    expect(validateCouponInput({ code: 'F', kind: 'flat', flatRupees: 0 }, NOW).ok).toBe(false);
  });

  it('rejects endsAt on or before startsAt, and a negative min subtotal', () => {
    expect(validateCouponInput({ ...base, endsAt: '2026-06-30T00:00:00Z' }, NOW).ok).toBe(false);
    expect(validateCouponInput({ ...base, minSubtotalRupees: -1 }, NOW).ok).toBe(false);
  });

  it('rejects usage/per-customer limits below 1', () => {
    expect(validateCouponInput({ ...base, usageLimit: 0 }, NOW).ok).toBe(false);
    expect(validateCouponInput({ ...base, perCustomerLimit: 0 }, NOW).ok).toBe(false);
  });

  it('caps money/count fields to stay inside int4 (no 22003 overflow at the DB)', () => {
    // ₹9,99,99,999 would be ~10 billion paise > int4 max — must be rejected here, not at Postgres.
    expect(validateCouponInput({ code: 'BIG', kind: 'flat', flatRupees: 99_999_999 }, NOW).ok).toBe(false);
    expect(validateCouponInput({ ...base, maxDiscountRupees: 99_999_999 }, NOW).ok).toBe(false);
    expect(validateCouponInput({ ...base, minSubtotalRupees: 99_999_999 }, NOW).ok).toBe(false);
    expect(validateCouponInput({ ...base, usageLimit: 1e21 }, NOW).ok).toBe(false);
    // A generous-but-sane value still passes.
    expect(validateCouponInput({ code: 'OKAY', kind: 'flat', flatRupees: 5000 }, NOW).ok).toBe(true);
  });
});

describe('couponStatus', () => {
  const c = {
    isActive: true,
    startsAt: '2026-07-01T00:00:00Z',
    endsAt: null as string | null,
    usageLimit: null as number | null,
    redemptionCount: 0,
  };
  it('inactive when not active', () => {
    expect(couponStatus({ ...c, isActive: false }, NOW)).toBe('inactive');
  });
  it('scheduled before start', () => {
    expect(couponStatus({ ...c, startsAt: '2026-08-01T00:00:00Z' }, NOW)).toBe('scheduled');
  });
  it('expired after end', () => {
    expect(couponStatus({ ...c, endsAt: '2026-07-02T00:00:00Z' }, NOW)).toBe('expired');
  });
  it('exhausted when fully redeemed', () => {
    expect(couponStatus({ ...c, usageLimit: 5, redemptionCount: 5 }, NOW)).toBe('exhausted');
  });
  it('active otherwise', () => {
    expect(couponStatus(c, NOW)).toBe('active');
  });
});
