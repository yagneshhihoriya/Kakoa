/**
 * GET /api/admin/customers — customer list with search + filter (admin-customers.md).
 *     Guarded by `customers:read`. Query: `search`, `filter` (all|blocked), `page`.
 *     Phone/email are masked unless the acting admin also holds `customers:pii-view`.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { listCustomers } from '@/lib/admin/customers';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('customers:read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const filterRaw = url.searchParams.get('filter');
  const filter = filterRaw === 'blocked' ? 'blocked' : 'all';
  const search = (url.searchParams.get('search') ?? '').slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const canViewPii = auth.value.ctx.can('customers:pii-view');
  const list = await listCustomers({ search, filter, page }, canViewPii);
  return jsonOk(list, { cacheControl: NO_STORE });
}
