/**
 * Session issuance / lookup / revocation — auth-otp.md §1.4, §5.4, §6.
 *
 * `kakoa_session` = 32 random bytes as base64url (43-char opaque token). The
 * DB stores ONLY `sha256(token)` hex in `customer_sessions.token_hash`; the raw
 * token lives solely in the `Set-Cookie` header and the client cookie jar.
 *
 * Cookie: HttpOnly; Secure (production only); SameSite=Lax; Path=/; Max-Age 30d.
 * Rolling: any authenticated request within 24h of expiry extends `expires_at`
 * to `LEAST(created_at + 90d, now() + 30d)` — 30d rolling, 90d absolute cap.
 * All expiry decisions are made against DB `now()`, never the app clock.
 *
 * SERVER-ONLY: uses node:crypto + next/headers.
 */
import type { CustomerView } from '@kakoa/core';
import { customers, customerSessions, db } from '@kakoa/db';
import { and, eq, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';

import {
  SESSION_TOKEN_RE,
  generateSessionToken,
  hashToken,
} from './session-token';

/** A drizzle transaction handle (from `db.transaction(async (tx) => …)`). */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const SESSION_COOKIE_NAME = 'kakoa_session';

/** 30 days (§1.4 Max-Age). */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Re-export the dep-free token primitives so the pinned interface is stable.
export { generateSessionToken, hashToken } from './session-token';

/** Secure cookie flag only under a real deployment (spec §1.4 / §6). */
function isProduction(): boolean {
  return process.env.APP_ENV === 'production';
}

/** Write (or rotate) the session cookie. Route Handlers / Server Actions only. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie (Max-Age 0). Logout must never fail visibly. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Read the raw session token from the request cookies. Shape-validated only
 * (43-char base64url) — anything malformed/absent ⇒ `null`, never an error
 * (no oracle: an invalid cookie is indistinguishable from no cookie, §5.4).
 */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  if (!value || !SESSION_TOKEN_RE.test(value)) return null;
  return value;
}

/** DB → API projection (ISO-8601 UTC timestamps, §5.4). */
function toCustomerView(row: {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  phoneVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}): CustomerView {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    phoneVerifiedAt: row.phoneVerifiedAt ? row.phoneVerifiedAt.toISOString() : null,
    emailVerifiedAt: row.emailVerifiedAt ? row.emailVerifiedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Resolve the authenticated customer from the `kakoa_session` cookie, or
 * `null` when there is no valid live session (missing/malformed cookie, hash
 * not found, revoked, or expired — all indistinguishable, §5.4).
 *
 * Side effect (§1.4 rolling extension): when the live session is within 24h of
 * `expires_at`, extend it to `LEAST(created_at + 90d, now() + 30d)` — enforced
 * entirely on DB time. The extension never resurrects a dead session (the join
 * already filtered `revoked_at IS NULL AND expires_at > now()`).
 */
export async function getCurrentCustomer(): Promise<CustomerView | null> {
  const token = await readSessionToken();
  if (token === null) return null;
  const tokenHash = hashToken(token);

  const [row] = await db
    .select({
      sessionId: customerSessions.id,
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      phoneVerifiedAt: customers.phoneVerifiedAt,
      emailVerifiedAt: customers.emailVerifiedAt,
      createdAt: customers.createdAt,
      // within 24h of expiry ⇒ eligible for rolling extension
      needsExtension: sql<boolean>`${customerSessions.expiresAt} < now() + interval '24 hours'`,
    })
    .from(customerSessions)
    .innerJoin(customers, eq(customers.id, customerSessions.customerId))
    .where(
      and(
        eq(customerSessions.tokenHash, tokenHash),
        sql`${customerSessions.revokedAt} IS NULL`,
        sql`${customerSessions.expiresAt} > now()`,
      ),
    )
    .limit(1);

  if (!row) return null;

  if (row.needsExtension) {
    // 30d rolling, capped at 90d absolute — computed on DB time.
    await db
      .update(customerSessions)
      .set({
        expiresAt: sql`LEAST(${customerSessions.createdAt} + interval '90 days', now() + interval '30 days')`,
      })
      .where(eq(customerSessions.id, row.sessionId));
  }

  return toCustomerView(row);
}

/**
 * Issue a fresh session row for `customerId` and return the RAW token to set as
 * the cookie. Session rotation on every auth event is by construction — this
 * always INSERTs a new row (spec §6). `expires_at = now() + 30d` on DB time.
 * When `tx` is supplied the INSERT joins the caller's transaction (verify runs
 * consume + upsert + session in one tx, §2 step 8).
 */
export async function createSession(
  customerId: string,
  ip: string | null,
  userAgent: string | null,
  tx?: DbTx,
): Promise<{ token: string; tokenHash: string }> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const runner = tx ?? db;

  await runner
    .insert(customerSessions)
    .values({
      customerId,
      tokenHash,
      expiresAt: sql`now() + interval '30 days'`,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    });

  return { token, tokenHash };
}

/**
 * Revoke the session identified by a RAW token. Idempotent: a missing /
 * already-revoked / expired token is a no-op (logout never fails, §5.3).
 */
export async function revokeSession(token: string | null): Promise<void> {
  if (token === null || !SESSION_TOKEN_RE.test(token)) return;
  await db
    .update(customerSessions)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(customerSessions.tokenHash, hashToken(token)),
        sql`${customerSessions.revokedAt} IS NULL`,
      ),
    );
}
