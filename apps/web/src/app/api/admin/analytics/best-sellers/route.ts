/**
 * GET /api/admin/analytics/best-sellers?preset|from&to&by&limit — top products,
 * revenue-recognized only (orders with a collected payment). Guard `analytics:read`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getBestSellers } from '@/lib/admin/analytics';
import { resolveRange } from '@/lib/admin/analytics-range';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('analytics:read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const resolved = resolveRange({
    preset: url.searchParams.get('preset') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  });
  if (!resolved.ok) return jsonErr('VALIDATION_ERROR', resolved.message);

  const by = url.searchParams.get('by') === 'units' ? 'units' : 'revenue';
  const limit = Number(url.searchParams.get('limit') ?? '10') || 10;

  const rows = await getBestSellers(resolved.range, { by, limit });
  return jsonOk({ range: resolved.range, by, rows }, { cacheControl: NO_STORE });
}
