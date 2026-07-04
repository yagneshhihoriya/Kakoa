/**
 * Cart cookie — Module 2 (docs/modules/cart.md §6 "Cookie integrity").
 *
 * `kakoa_cart` = `<cart token uuid>.<base64url HMAC-SHA256>` signed with
 * SESSION_SECRET. HttpOnly / SameSite=Lax / Path=/ / Max-Age 30d. The
 * cookie holds ONLY the signed token — never cart lines (4KB limit +
 * tamper surface; asserted in tests).
 *
 * Tampered / malformed / absent cookie ⇒ `null` ⇒ treated as "no cart" —
 * NEVER an error or a stack (no oracle, spec §1 row `kakoa_cart`).
 *
 * SERVER-ONLY: uses node:crypto + next/headers.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const CART_COOKIE_NAME = 'kakoa_cart';

/** 30 days — matches `carts.expires_at` default (Contract §1.10). */
export const CART_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // Config error, not a user error — fail loudly at the call site.
    throw new Error(
      'SESSION_SECRET (>= 32 chars) is required for cart cookie signing',
    );
  }
  return secret;
}

/** base64url HMAC-SHA256 of the cart token. */
export function signCartToken(token: string): string {
  return createHmac('sha256', sessionSecret()).update(token).digest('base64url');
}

/**
 * Verify a raw `kakoa_cart` cookie value; returns the cart token uuid or
 * `null` for anything malformed/tampered. Constant-time signature compare.
 */
export function verifyCartCookieValue(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot <= 0 || dot === value.length - 1) return null;
  const token = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!UUID_RE.test(token)) return null;
  const expected = signCartToken(token);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length) return null;
  return timingSafeEqual(given, wanted) ? token : null;
}

/**
 * Verified cart token from the request cookies, or `null`. Never throws
 * for a missing/invalid cookie.
 */
export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return verifyCartCookieValue(store.get(CART_COOKIE_NAME)?.value);
}

/**
 * Set (or rotate) the signed cart cookie. Only callable where Next.js
 * allows cookie writes (Server Actions / Route Handlers) — cart creation
 * is therefore deferred to the first mutation, never done during render.
 */
export async function setCartCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE_NAME, `${token}.${signCartToken(token)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Rotation helper — post-merge (session-fixation defense, spec §6) the
 * cookie is re-issued for the SURVIVING cart's token; the old guest token
 * is dead (`status='merged'`) so replays yield a fresh empty cart.
 */
export async function rotateCartCookie(newToken: string): Promise<void> {
  await setCartCookie(newToken);
}

/** Drop the cookie entirely (e.g. after conversion cleanup). */
export async function clearCartCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE_NAME);
}
