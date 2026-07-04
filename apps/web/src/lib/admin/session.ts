/**
 * Admin session — separate from the customer session (docs/admin-platform §4,
 * admin-staff-roles.md). Distinct cookie (`kakoa_admin`), 12h absolute lifetime,
 * DB-backed (revocation within one request). DB stores ONLY `sha256(token)`;
 * the raw token lives solely in the cookie.
 *
 * Resolving a session also loads the acting admin's granular permission grants
 * (from `roles.permissions`, or the legacy `role` enum mapped to a kernel preset
 * when a `role_id` hasn't been backfilled) — these drive `BusinessContext.can()`.
 *
 * SERVER-ONLY: uses @kakoa/db + next/headers.
 */
import { cookies } from 'next/headers';
import { adminSessions, adminUsers, db, roles } from '@kakoa/db';
import {
  LEGACY_ROLE_TO_PRESET,
  systemRole,
  type PermissionGrant,
} from '@platform/kernel';
import { and, eq, sql } from 'drizzle-orm';
import { generateSessionToken, hashToken } from '@/lib/auth/session-token';

export const ADMIN_COOKIE_NAME = 'kakoa_admin';
/** 12h absolute — no sliding renewal (admin-staff-roles.md). */
export const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60;

const secure = process.env.APP_ENV === 'production';

export interface AdminIdentity {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly roleKey: string;
  /** Permission grants (`['*']` for Owner) — drives `can()`. */
  readonly grants: readonly PermissionGrant[];
}

/** Write (or rotate) the admin cookie. Route Handlers / Server Actions only. */
export async function setAdminCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
}

/** Clear the admin cookie (logout never fails visibly). */
export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

async function readAdminToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE_NAME)?.value ?? null;
}

/**
 * Create a 12h admin session and return the raw token (to set as the cookie).
 * Only `sha256(token)` is persisted.
 */
export async function createAdminSession(input: {
  adminUserId: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<string> {
  const token = generateSessionToken();
  await db.insert(adminSessions).values({
    adminUserId: input.adminUserId,
    tokenHash: hashToken(token),
    expiresAt: sql`now() + interval '12 hours'`,
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return token;
}

/**
 * Resolve the acting admin from the `kakoa_admin` cookie, or `null` when there
 * is no live session (missing/malformed cookie, revoked/expired session, or a
 * deactivated admin). Loads the admin + role grants in one round-trip.
 */
export async function resolveAdminSession(): Promise<AdminIdentity | null> {
  const token = await readAdminToken();
  if (token === null || token === '') return null;

  const [row] = await db
    .select({
      adminId: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      isActive: adminUsers.isActive,
      legacyRole: adminUsers.role,
      roleKey: roles.key,
      permissions: roles.permissions,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminUserId))
    .leftJoin(roles, eq(roles.id, adminUsers.roleId))
    .where(
      and(
        eq(adminSessions.tokenHash, hashToken(token)),
        sql`${adminSessions.revokedAt} IS NULL`,
        sql`${adminSessions.expiresAt} > now()`,
      ),
    )
    .limit(1);

  if (!row || !row.isActive) return null;

  // Prefer the granular role grants; fall back to the legacy enum → kernel preset.
  let grants: readonly PermissionGrant[];
  let roleKey: string;
  if (row.roleKey !== null && row.permissions !== null) {
    roleKey = row.roleKey;
    grants = row.permissions as PermissionGrant[];
  } else {
    const presetKey = LEGACY_ROLE_TO_PRESET[row.legacyRole];
    roleKey = presetKey;
    grants = systemRole(presetKey)?.permissions ?? [];
  }

  return {
    id: row.adminId,
    email: row.email,
    name: row.name,
    roleKey,
    grants,
  };
}

/** Revoke the current admin session (logout) + clear the cookie. Best-effort. */
export async function revokeCurrentAdminSession(): Promise<void> {
  const token = await readAdminToken();
  if (token !== null && token !== '') {
    await db
      .update(adminSessions)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(adminSessions.tokenHash, hashToken(token)),
          sql`${adminSessions.revokedAt} IS NULL`,
        ),
      );
  }
  await clearAdminCookie();
}
