/**
 * Tracking JWT — order-tracking.md §1.3, §5.2, §6 (token hygiene).
 *
 * A minimal HS256 JWT (no `jose` dependency) minted at guest OTP verify and
 * carried as `Authorization: Bearer <token>` on the tracking + cancel reads.
 * Claims: `{ orderId: uuid, scope: 'tracking', exp }` — 30-minute lifetime,
 * scope checked on every use so a login-session token can never pass and the
 * tracking token grants nothing outside the two order-scoped endpoints.
 *
 * The token is held in client memory only (never localStorage, cookie, or URL).
 * `access_token` is the read-only 24h path; this is the OTP-proven path that
 * ALSO authorizes cancel.
 *
 * Signing key: `SESSION_SECRET`. (The spec calls for a dedicated secret; until a
 * separate `TRACKING_JWT_SECRET` is provisioned we derive a scope-namespaced key
 * from `SESSION_SECRET` via HMAC so a login token and a tracking token can never
 * share a signing key even though they share the root secret.)
 *
 * SERVER-ONLY: uses node:crypto.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** 30 minutes, in seconds (order-tracking.md §1.3). */
export const TRACKING_TOKEN_TTL_SECONDS = 30 * 60;

const TRACKING_SCOPE = 'tracking' as const;

interface TrackingClaims {
  orderId: string;
  scope: typeof TRACKING_SCOPE;
  /** Unix seconds. */
  exp: number;
  /** Unix seconds (issued-at, informational). */
  iat: number;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Scope-namespaced HS256 signing key. Derived from `SESSION_SECRET` so the
 * tracking token is cryptographically unrelated to the session token even
 * though both roots live in the same env var — a login JWT forged with the
 * session secret cannot validate here, and vice versa.
 */
function signingKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET (>= 32 chars) is required for tracking-token signing');
  }
  return createHmac('sha256', secret).update('kakoa.tracking.jwt.v1').digest();
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(signingInput: string): string {
  return base64url(createHmac('sha256', signingKey()).update(signingInput).digest());
}

/**
 * Mint a 30-minute tracking token for `orderId`. `exp` is computed against the
 * app clock at mint; verification re-checks it against `Date.now()`.
 */
export function signTrackingToken(orderId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      orderId,
      scope: TRACKING_SCOPE,
      iat: now,
      exp: now + TRACKING_TOKEN_TTL_SECONDS,
    } satisfies TrackingClaims),
  );
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${sign(signingInput)}`;
}

/**
 * Verify a tracking token. Returns `{ orderId }` for a token whose signature,
 * `scope`, and `exp` all check out; otherwise `null` — a tampered signature, a
 * `scope !== 'tracking'` token (e.g. a login JWT), an expired token, or any
 * malformed input all collapse to `null` (the caller distinguishes expiry via
 * `isTrackingTokenExpired` when it needs the 410 vs 404 split).
 */
export function verifyTrackingToken(token: string): { orderId: string } | null {
  const claims = decodeVerified(token);
  if (claims === null) return null;
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) return null;
  return { orderId: claims.orderId };
}

/**
 * True iff `token` has a valid signature + scope but its `exp` has passed — the
 * signal the tracking route needs to answer 410 `TOKEN_EXPIRED` (re-OTP CTA)
 * rather than a generic 404. A structurally invalid or wrong-scope token is NOT
 * "expired" — it returns `false` here and 404s (no existence oracle, §7 case 3).
 */
export function isTrackingTokenExpired(token: string): boolean {
  const claims = decodeVerified(token);
  if (claims === null) return false;
  return claims.exp <= Math.floor(Date.now() / 1000);
}

/**
 * Signature- and scope-verified claims (ignoring `exp`), or `null`. Splitting
 * this out lets both `verifyTrackingToken` (exp → null) and
 * `isTrackingTokenExpired` (exp → true) share one constant-time check.
 */
function decodeVerified(token: string): TrackingClaims | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];

  // Constant-time signature compare over the exact signing input.
  const expected = sign(`${header}.${payload}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(base64urlDecode(payload).toString('utf8'));
  } catch {
    return null;
  }
  if (
    typeof claims !== 'object' ||
    claims === null ||
    !('orderId' in claims) ||
    !('scope' in claims) ||
    !('exp' in claims)
  ) {
    return null;
  }
  const { orderId, scope, exp } = claims as Record<string, unknown>;
  if (
    typeof orderId !== 'string' ||
    !UUID_RE.test(orderId) ||
    scope !== TRACKING_SCOPE ||
    typeof exp !== 'number' ||
    !Number.isFinite(exp)
  ) {
    return null;
  }
  const iat = 'iat' in claims && typeof (claims as { iat: unknown }).iat === 'number'
    ? (claims as { iat: number }).iat
    : 0;
  return { orderId, scope: TRACKING_SCOPE, exp, iat };
}
