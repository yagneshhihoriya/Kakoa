/**
 * GET /api/admin/payments — list payments (financial visibility). Guard
 * `payments:read`. Filters: `status`, `method`, `search` (order # / provider
 * payment id), `page`.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { listPayments } from '@/lib/admin/payments';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('payments:read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const list = await listPayments({
    search: url.searchParams.get('search') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    method: url.searchParams.get('method') ?? undefined,
    page: Number(url.searchParams.get('page') ?? '1') || 1,
  });
  return jsonOk(list, { cacheControl: NO_STORE });
}
