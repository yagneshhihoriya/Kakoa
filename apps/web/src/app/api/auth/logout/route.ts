/**
 * POST /api/auth/logout — customer · no rate class (auth-otp.md §5.3).
 *
 * Revoke the session (`revoked_at = now()`), clear the cookie, return 200 {}.
 * Idempotent: a revoked / expired / absent session still returns 200 and clears
 * the cookie — logout must never fail visibly.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import {
  clearSessionCookie,
  readSessionToken,
  revokeSession,
} from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  // Best-effort server-side revoke; a DB hiccup must not block local logout.
  try {
    const token = await readSessionToken();
    await revokeSession(token);
  } catch {
    /* revoke is best-effort — never fail logout visibly (§5.3) */
  }
  await clearSessionCookie();
  return jsonOk({}, { cacheControl: NO_STORE });
}
