/**
 * POST /api/admin/auth/otp/verify — verify the admin email OTP and open a 12h
 * admin session (admin-staff-roles.md).
 *
 * `verifyCode` is non-consuming (checks the hash, tracks attempts); on success we
 * atomically `consumeChallenge`, then require the challenge destination to be an
 * ACTIVE admin with purpose `admin_login` before issuing a session — so a
 * test-mode code alone never yields admin access to a non-admin email.
 */
import { adminUsers, db } from '@kakoa/db';
import { and, eq, sql } from 'drizzle-orm';
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { consumeChallenge, verifyCode } from '@/lib/auth/otp';
import { clientIp, userAgent } from '@/lib/auth/request-context';
import { createAdminSession, setAdminCookie } from '@/lib/admin/session';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[0-9]{6}$/;

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const challengeId = (body as { challengeId?: unknown })?.challengeId;
  const code = (body as { code?: unknown })?.code;
  if (typeof challengeId !== 'string' || !UUID_RE.test(challengeId)) {
    return jsonErr('OTP_EXPIRED', 'This code has expired. Request a new one.');
  }
  if (typeof code !== 'string' || !CODE_RE.test(code.trim())) {
    return jsonErr('VALIDATION_ERROR', 'Enter the 6-digit code.');
  }

  const outcome = await verifyCode({ challengeId, code: code.trim() });
  if (outcome.status === 'incorrect') {
    return jsonErr('OTP_INCORRECT', 'Incorrect code.', {
      details: { attemptsLeft: outcome.attemptsLeft },
    });
  }
  if (
    outcome.status === 'expired' ||
    outcome.challenge.purpose !== 'admin_login'
  ) {
    return jsonErr('OTP_EXPIRED', 'This code has expired. Request a new one.');
  }

  // Atomically consume — a racing verify or a lapsed TTL loses here.
  const consumed = await db.transaction((tx) => consumeChallenge(challengeId, tx));
  if (!consumed) {
    return jsonErr('OTP_EXPIRED', 'This code has expired. Request a new one.');
  }

  // The destination MUST be an active admin (purpose already checked).
  const [admin] = await db
    .select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name })
    .from(adminUsers)
    .where(
      and(
        eq(adminUsers.email, outcome.challenge.destination),
        eq(adminUsers.isActive, true),
      ),
    )
    .limit(1);
  if (!admin) {
    return jsonErr('UNAUTHORIZED', 'This account cannot sign in to the admin.');
  }

  const token = await createAdminSession({
    adminUserId: admin.id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });
  await setAdminCookie(token);
  await db
    .update(adminUsers)
    .set({ lastLoginAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(adminUsers.id, admin.id));

  return jsonOk(
    { admin: { email: admin.email, name: admin.name } },
    { cacheControl: NO_STORE },
  );
}
