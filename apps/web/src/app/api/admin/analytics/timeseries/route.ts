/**
 * GET /api/admin/analytics/timeseries?preset|from&to&bucket — zero-filled revenue
 * timeseries (IST buckets, auto-upgraded on huge ranges). Guard `analytics:read`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getRevenueTimeseries } from '@/lib/admin/analytics';
import { resolveRange, type Bucket } from '@/lib/admin/analytics-range';

const BUCKETS: readonly Bucket[] = ['day', 'week', 'month'];

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

  const bucketRaw = url.searchParams.get('bucket');
  const bucket: Bucket = bucketRaw !== null && (BUCKETS as readonly string[]).includes(bucketRaw)
    ? (bucketRaw as Bucket)
    : resolved.range.bucketDefault;

  const series = await getRevenueTimeseries(resolved.range, bucket);
  return jsonOk({ range: resolved.range, ...series }, { cacheControl: NO_STORE });
}
