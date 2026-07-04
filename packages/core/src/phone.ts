/**
 * Indian mobile phone normalization + masking (auth-otp.md §1.1).
 *
 * Pure functions, zero deps. Shared by the OTP request path (normalize before
 * regex-anchor + rate counting) and by the client/UI (masked destination
 * display). The normalized E.164 value is what is stored in
 * `otp_challenges.destination`, matched against `customers.phone`, and counted
 * for rate limits — so all spacing/prefix variants collapse to one bucket.
 */

/** E.164 Indian mobile: `+91` then series 6–9 and 9 more digits. */
const E164_IN_MOBILE = /^\+91[6-9][0-9]{9}$/;

/** Characters stripped before any prefix handling: spaces, dashes, parens, dots. */
const SEPARATORS = /[\s\-().]/g;

/**
 * Normalize a raw phone string to Indian E.164 (`+91XXXXXXXXXX`).
 *
 * Steps (auth-otp.md §1.1):
 *   1. Strip `[\s\-().]`.
 *   2. `0[6-9]XXXXXXXXX` → drop the leading `0`.
 *   3. `91[6-9]XXXXXXXXX` → prefix `+`.
 *   4. bare `[6-9]XXXXXXXXX` → prefix `+91`.
 *   5. Result MUST match `^\+91[6-9][0-9]{9}$`, else `null`.
 *
 * @returns the normalized `+91`-prefixed number, or `null` if invalid.
 */
export function normalizePhoneE164(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  let s = raw.replace(SEPARATORS, '');

  // Step 2 first (drop domestic trunk `0`), THEN the prefix rules — these are
  // sequential, not mutually exclusive: `098765...` becomes bare `98765...`
  // which step 4 must still promote to `+9198765...`.
  if (/^0[6-9][0-9]{9}$/.test(s)) {
    s = s.slice(1);
  }

  if (/^91[6-9][0-9]{9}$/.test(s)) {
    s = `+${s}`;
  } else if (/^[6-9][0-9]{9}$/.test(s)) {
    s = `+91${s}`;
  }
  // An already-normalized `+91…` value falls through unchanged.

  return E164_IN_MOBILE.test(s) ? s : null;
}

/**
 * Mask a normalized E.164 Indian mobile for display: first 2 + last 3 of the
 * 10 national digits, e.g. `+919876543210` → `"+91 98•••••210"`.
 *
 * Expects an already-normalized value (as produced by {@link normalizePhoneE164}).
 * If the input is not a valid `+91` mobile it is returned unchanged rather than
 * throwing — masking is a display concern, never an authority.
 */
export function maskPhone(e164: string): string {
  if (!E164_IN_MOBILE.test(e164)) return e164;

  const national = e164.slice(3); // strip "+91" → 10 digits
  const first = national.slice(0, 2);
  const last = national.slice(-3);
  return `+91 ${first}•••••${last}`;
}
