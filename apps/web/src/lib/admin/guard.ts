/**
 * Admin API guard (docs/admin-platform §4, [03] §4 rule 5). Every `/api/admin/*`
 * mutation resolves the acting admin + BusinessContext and checks a permission
 * SERVER-SIDE. UI gating is cosmetic; this is authoritative.
 *
 * Usage:
 *   const auth = await requireAdmin('orders:refund');
 *   if (!auth.ok) return auth.response;   // 401 / 403 envelope
 *   // auth.value.admin, auth.value.ctx are now available
 *
 * SERVER-ONLY.
 */
import type { Permission } from '@platform/kernel';
import { jsonErr } from '@/lib/api/http';
import { resolveAdminContext, type AdminRequestContext } from './context';

export type RequireAdminResult =
  | { ok: true; value: AdminRequestContext }
  | { ok: false; response: Response };

/**
 * Require a live admin session and (optionally) a permission. Returns the
 * resolved context or a ready-to-return 401/403 error response.
 */
export async function requireAdmin(
  permission?: Permission,
): Promise<RequireAdminResult> {
  const value = await resolveAdminContext();
  if (value === null) {
    return {
      ok: false,
      response: jsonErr('UNAUTHORIZED', 'Admin sign-in required.'),
    };
  }
  if (permission !== undefined && !value.ctx.can(permission)) {
    return {
      ok: false,
      response: jsonErr(
        'FORBIDDEN',
        "You don't have permission to perform this action.",
      ),
    };
  }
  return { ok: true, value };
}
