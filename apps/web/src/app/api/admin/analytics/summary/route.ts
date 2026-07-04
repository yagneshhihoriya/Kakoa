/**
 * GET /api/admin/analytics/summary?preset|from&to — headline metrics for the
 * range. Guard `analytics:read`. Reconciles with the Dashboard for `preset=all`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getSummary } from '@/lib/admin/analytics';
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

  const summary = await getSummary(resolved.range);
  return jsonOk({ range: resolved.range, summary }, { cacheControl: NO_STORE });
}
