/**
 * Pure coupon validation — NO @kakoa/db import, so it's unit-testable and the
 * single source of truth for unit conversion (% → basis points, ₹ → paise) and
 * every coupons check constraint (percent XOR flat, code shape, windows, limits).
 * The admin form sends friendly units; this returns the DB-ready shape.
 */

export interface CouponValues {
  code: string;
  description: string;
  percentBp: number | null;
  flatPaise: number | null;
  maxDiscountPaise: number | null;
  minSubtotalPaise: number;
  startsAt: Date;
  endsAt: Date | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  isActive: boolean;
}

export type CouponValidation =
  | { ok: true; value: CouponValues }
  | { ok: false; message: string };

const CODE_RE = /^[A-Z0-9]{3,24}$/;
// Ceilings that keep paise/counts comfortably inside Postgres int4 (max 2,147,483,647).
const MAX_RUPEES = 1_000_000; // ₹10,00,000 — generous for any real discount/threshold
const MAX_COUNT = 100_000_000;

function fail(message: string): CouponValidation {
  return { ok: false, message };
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string' || v.trim() === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

export function validateCouponInput(raw: unknown, now: Date = new Date()): CouponValidation {
  if (typeof raw !== 'object' || raw === null) return fail('Invalid coupon payload.');
  const b = raw as Record<string, unknown>;

  const code = (typeof b.code === 'string' ? b.code : '').trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return fail('Code must be 3–24 characters: letters A–Z and digits 0–9.');
  }
  const description = (typeof b.description === 'string' ? b.description : '').slice(0, 200);

  const kind = b.kind === 'flat' ? 'flat' : b.kind === 'percent' ? 'percent' : null;
  if (kind === null) return fail('Choose a discount type (percent or flat).');

  let percentBp: number | null = null;
  let flatPaise: number | null = null;
  let maxDiscountPaise: number | null = null;

  if (kind === 'percent') {
    const pct = Number(b.percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return fail('Percent must be between 0.01 and 100.');
    }
    percentBp = Math.round(pct * 100);
    if (percentBp < 1 || percentBp > 10000) return fail('Percent must be between 0.01 and 100.');
    if (!isBlank(b.maxDiscountRupees)) {
      const md = Number(b.maxDiscountRupees);
      if (!Number.isFinite(md) || md <= 0 || md > MAX_RUPEES) {
        return fail('Max discount must be between ₹1 and ₹10,00,000.');
      }
      maxDiscountPaise = Math.round(md * 100);
    }
  } else {
    const fr = Number(b.flatRupees);
    if (!Number.isFinite(fr) || fr <= 0 || fr > MAX_RUPEES) {
      return fail('Flat discount must be between ₹1 and ₹10,00,000.');
    }
    flatPaise = Math.round(fr * 100);
  }

  const minR = isBlank(b.minSubtotalRupees) ? 0 : Number(b.minSubtotalRupees);
  if (!Number.isFinite(minR) || minR < 0 || minR > MAX_RUPEES) {
    return fail('Minimum subtotal must be between ₹0 and ₹10,00,000.');
  }
  const minSubtotalPaise = Math.round(minR * 100);

  const startsAt = parseDate(b.startsAt) ?? now;
  let endsAt: Date | null = null;
  if (!isBlank(b.endsAt)) {
    endsAt = parseDate(b.endsAt);
    if (endsAt === null) return fail('Enter a valid end date.');
    if (endsAt <= startsAt) return fail('End date must be after the start date.');
  }

  let usageLimit: number | null = null;
  if (!isBlank(b.usageLimit)) {
    const ul = Number(b.usageLimit);
    if (!Number.isInteger(ul) || ul < 1 || ul > MAX_COUNT) {
      return fail('Usage limit must be a whole number between 1 and 100,000,000.');
    }
    usageLimit = ul;
  }

  const pcl = isBlank(b.perCustomerLimit) ? 1 : Number(b.perCustomerLimit);
  if (!Number.isInteger(pcl) || pcl < 1 || pcl > MAX_COUNT) {
    return fail('Per-customer limit must be a whole number between 1 and 100,000,000.');
  }

  return {
    ok: true,
    value: {
      code,
      description,
      percentBp,
      flatPaise,
      maxDiscountPaise,
      minSubtotalPaise,
      startsAt,
      endsAt,
      usageLimit,
      perCustomerLimit: pcl,
      firstOrderOnly: b.firstOrderOnly === true,
      isActive: b.isActive !== false,
    },
  };
}

export type CouponStatus = 'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive';

/** Human status matching how checkout gates a coupon (quote.ts). */
export function couponStatus(
  c: {
    isActive: boolean;
    startsAt: Date | string;
    endsAt: Date | string | null;
    usageLimit: number | null;
    redemptionCount: number;
  },
  now: Date = new Date(),
): CouponStatus {
  if (!c.isActive) return 'inactive';
  const t = now.getTime();
  if (new Date(c.startsAt).getTime() > t) return 'scheduled';
  if (c.endsAt !== null && new Date(c.endsAt).getTime() <= t) return 'expired';
  if (c.usageLimit !== null && c.redemptionCount >= c.usageLimit) return 'exhausted';
  return 'active';
}
