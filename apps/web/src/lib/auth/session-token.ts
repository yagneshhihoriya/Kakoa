/**
 * Session token primitives — auth-otp.md §1.4. Dependency-free (node:crypto
 * only) so token generation / hashing / shape-validation is unit-testable
 * without `next/headers` or a DB. Re-exported from `session.ts`.
 *
 * SERVER-ONLY: uses node:crypto.
 */
import { createHash, randomBytes } from 'node:crypto';

/** A raw session token is 32 bytes → base64url = exactly 43 chars, no padding. */
export const SESSION_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** 32 CSPRNG bytes → base64url opaque token (raw, never stored). */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** `sha256(token)` hex — the only representation that ever touches the DB. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** True when `value` is a well-formed raw session token (shape only). */
export function isSessionTokenShape(value: string | null | undefined): boolean {
  return typeof value === 'string' && SESSION_TOKEN_RE.test(value);
}
