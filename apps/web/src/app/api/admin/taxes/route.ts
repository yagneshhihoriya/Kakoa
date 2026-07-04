/**
 * GET /api/admin/taxes — tax groups (HSN × rate + counts) + seller GST identity.
 * Guard `taxes:manage` (the module is manage-only — no separate read perm).
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getSellerTaxIdentity, listTaxGroups } from '@/lib/admin/taxes';

export async function GET(): Promise<Response> {
  const auth = await requireAdmin('taxes:manage');
  if (!auth.ok) return auth.response;

  const [groups, seller] = await Promise.all([listTaxGroups(), getSellerTaxIdentity()]);
  return jsonOk({ groups, seller }, { cacheControl: NO_STORE });
}
