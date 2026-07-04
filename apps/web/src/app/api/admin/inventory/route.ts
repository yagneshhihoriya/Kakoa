/**
 * GET /api/admin/inventory — stock overview across variants (`inventory:read`).
 * Query: `search`, `filter` (all|low|out), `page`.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { listInventory } from '@/lib/admin/inventory';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('inventory:read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const filterRaw = url.searchParams.get('filter');
  const filter = filterRaw === 'low' || filterRaw === 'out' ? filterRaw : 'all';
  const search = (url.searchParams.get('search') ?? '').slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const list = await listInventory({ search, filter, page });
  return jsonOk(list, { cacheControl: NO_STORE });
}
