/**
 * GET /api/admin/analytics/export?report=orders|best-sellers|revenue&preset|from&to&bucket
 * — returns an RFC-4180, injection-safe CSV (raw `text/csv` Response, NOT jsonOk).
 * Guard `reports:export` (a `analytics:read`-only admin is refused here).
 */
import { jsonErr } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import {
  getBestSellersExport,
  getOrdersExport,
  getRevenueExport,
  type ExportTable,
} from '@/lib/admin/analytics';
import { resolveRange, type Bucket } from '@/lib/admin/analytics-range';
import { toCsv } from '@/lib/admin/csv';

const REPORTS = ['orders', 'best-sellers', 'revenue'] as const;
type Report = (typeof REPORTS)[number];

const BUCKETS: readonly Bucket[] = ['day', 'week', 'month'];

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('reports:export');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const reportRaw = url.searchParams.get('report') ?? 'orders';
  if (!(REPORTS as readonly string[]).includes(reportRaw)) {
    return jsonErr('VALIDATION_ERROR', 'Unknown report.');
  }
  const report = reportRaw as Report;

  const resolved = resolveRange({
    preset: url.searchParams.get('preset') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  });
  if (!resolved.ok) return jsonErr('VALIDATION_ERROR', resolved.message);

  let table: ExportTable;
  if (report === 'orders') {
    table = await getOrdersExport(resolved.range);
  } else if (report === 'best-sellers') {
    table = await getBestSellersExport(resolved.range);
  } else {
    const bucketRaw = url.searchParams.get('bucket');
    const bucket: Bucket = bucketRaw !== null && (BUCKETS as readonly string[]).includes(bucketRaw)
      ? (bucketRaw as Bucket)
      : resolved.range.bucketDefault;
    table = await getRevenueExport(resolved.range, bucket);
  }

  if (table.truncated) {
    console.warn('analytics.export_truncated', { report, preset: resolved.range.preset });
  }

  const csv = toCsv(table.headers, table.rows);
  const label = resolved.range.preset === 'custom'
    ? `${resolved.range.fromIso.slice(0, 10)}_${resolved.range.toIso.slice(0, 10)}`
    : resolved.range.preset;
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="kakoa-${report}-${label}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
