/**
 * POST /api/admin/auth/logout — revoke the current admin session + clear the
 * cookie. Best-effort; never fails visibly.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { revokeCurrentAdminSession } from '@/lib/admin/session';

export async function POST(): Promise<Response> {
  await revokeCurrentAdminSession();
  return jsonOk({ ok: true }, { cacheControl: NO_STORE });
}
