/**
 * GET /api/admin/analytics/breakdown?preset|from&to — the small panels bundled:
 * sales-by-category, payment split, order-status breakdown, coupon usage, and a
 * (non-range-bound) low-stock snapshot. Guard `analytics:read`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import {
  getCouponUsage,
  getLowStock,
  getPaymentSplit,
  getSalesByCategory,
  getStatusBreakdown,
} from '@/lib/admin/analytics';
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

  const [categorySales, paymentSplit, statusBreakdown, couponUsage, lowStock] = await Promise.all([
    getSalesByCategory(resolved.range),
    getPaymentSplit(resolved.range),
    getStatusBreakdown(resolved.range),
    getCouponUsage(resolved.range),
    getLowStock(),
  ]);

  return jsonOk(
    { range: resolved.range, categorySales, paymentSplit, statusBreakdown, couponUsage, lowStock },
    { cacheControl: NO_STORE },
  );
}
