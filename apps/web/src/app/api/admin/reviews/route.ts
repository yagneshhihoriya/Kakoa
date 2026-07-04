/**
 * GET /api/admin/reviews — review moderation queue (admin-reviews.md).
 *     Guarded by `reviews:moderate`. Query: `status` (pending|approved|rejected|all,
 *     default pending), `page`.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { listReviews, type ReviewFilter } from '@/lib/admin/reviews';

const FILTERS: readonly ReviewFilter[] = ['pending', 'approved', 'rejected', 'all'];

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('reviews:moderate');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const statusRaw = url.searchParams.get('status');
  const status = FILTERS.includes(statusRaw as ReviewFilter)
    ? (statusRaw as ReviewFilter)
    : 'pending';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const list = await listReviews({ status, page });
  return jsonOk(list, { cacheControl: NO_STORE });
}
