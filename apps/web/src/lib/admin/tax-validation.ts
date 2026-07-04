/**
 * Pure GST rate / HSN validation — NO @kakoa/db import, so it's unit-testable and
 * the single source of truth for the rate bounds + HSN shape the Taxes module
 * writes. GST is stored as basis points on the variant (`gst_rate_bp`, DB CHECK
 * 0…2800 = 0%…28%); HSN is a 4/6/8-digit code.
 */

/** Postgres CHECK ceiling: `gst_rate_bp BETWEEN 0 AND 2800` (0%…28%). */
export const MAX_GST_RATE_BP = 2800;

/** HSN is 4, 6 or 8 digits (India GST). */
const HSN_RE = /^[0-9]{4,8}$/;

/** The GST rates India actually uses — offered as UI presets (bp). */
export const GST_RATE_PRESETS_BP = [0, 500, 1200, 1800, 2800] as const;

export function ratePctFromBp(bp: number): number {
  return bp / 100;
}

export function isValidHsn(hsn: unknown): hsn is string {
  return typeof hsn === 'string' && HSN_RE.test(hsn.trim());
}

export interface TaxInput {
  gstRateBp: number;
  hsnCode: string;
}

export type TaxValidation =
  | { ok: true; value: TaxInput }
  | { ok: false; message: string };

/**
 * Validate + coerce a `{ gstRateBp, hsnCode }` payload. `gstRateBp` must be an
 * integer 0…2800; `hsnCode` must match `^[0-9]{4,8}$`. Returns the clean shape or
 * the first failing field's message (the DB CHECK is the race-safe backstop).
 */
export function validateTaxInput(raw: unknown): TaxValidation {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'Invalid tax payload.' };
  }
  const b = raw as Record<string, unknown>;

  const gstRateBp = Number(b.gstRateBp);
  if (!Number.isInteger(gstRateBp) || gstRateBp < 0 || gstRateBp > MAX_GST_RATE_BP) {
    return { ok: false, message: 'GST rate must be between 0% and 28%.' };
  }

  const hsnRaw = typeof b.hsnCode === 'string' ? b.hsnCode.trim() : '';
  if (!HSN_RE.test(hsnRaw)) {
    return { ok: false, message: 'HSN code must be 4, 6 or 8 digits.' };
  }

  return { ok: true, value: { gstRateBp, hsnCode: hsnRaw } };
}

/** Validate just an HSN route param (before it touches the text column). */
export function validateHsnParam(hsn: string): string | null {
  const s = hsn.trim();
  return HSN_RE.test(s) ? s : null;
}

/** Validate just a rate (bp) for the bulk-set action. */
export function validateRateBp(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= MAX_GST_RATE_BP ? n : null;
}
