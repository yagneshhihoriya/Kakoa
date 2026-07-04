/**
 * GET /api/admin/metrics — dashboard metrics (admin-dashboard.md). Guarded by
 * `dashboard:read`. Admin reads are never CDN-cached.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { computeDashboardMetrics } from '@/lib/admin/metrics';

export async function GET(): Promise<Response> {
  const auth = await requireAdmin('dashboard:read');
  if (!auth.ok) return auth.response;
  const metrics = await computeDashboardMetrics();
  return jsonOk(metrics, { cacheControl: NO_STORE });
}
