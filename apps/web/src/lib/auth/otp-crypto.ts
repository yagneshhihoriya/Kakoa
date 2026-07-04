/**
 * OTP crypto primitives — auth-otp.md §1.3, §6. Dependency-free (node:crypto +
 * env only) so the code-gen / hashing logic is unit-testable without a DB.
 * Re-exported from `otp.ts` (the DB-touching module) for the pinned interface.
 *
 * SERVER-ONLY: uses node:crypto.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/** Test-mode fixed code (non-prod only, §1.3) — Playwright + local login. */
export const TEST_MODE_CODE = '000000';

/** Max wrong attempts before a challenge is dead (§6 / DB CHECK attempts ≤ 5). */
export const OTP_MAX_ATTEMPTS = 5;

export function isOtpTestMode(): boolean {
  return process.env.OTP_TEST_MODE === '1' && process.env.APP_ENV !== 'production';
}

function pepper(): string {
  const value = process.env.OTP_PEPPER;
  if (!value || value.length < 32) {
    throw new Error('OTP_PEPPER (>= 32 chars) is required for OTP hashing');
  }
  return value;
}

/**
 * Generate a 6-digit code. Production: `crypto.randomInt(0, 1000000)` (Node
 * rejection-samples — NO modulo bias) zero-padded to 6. Test mode: `000000`.
 * Leading zeros are significant.
 */
export function generateCode(): string {
  if (isOtpTestMode()) return TEST_MODE_CODE;
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** `sha256(code || OTP_PEPPER)` hex, lowercase (§1.3). */
export function hashCode(code: string): string {
  return createHash('sha256').update(code + pepper()).digest('hex');
}

/** Constant-time compare of two hex hashes. */
export function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** `sha256(destination)` — the only identifier that may appear in logs (§6). */
export function hashDestination(destination: string): string {
  return createHash('sha256').update(destination).digest('hex');
}
