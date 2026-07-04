/**
 * GET  /api/admin/coupons — list promotions (`coupons:read`). Query: search, status, page.
 * POST /api/admin/coupons — create a coupon (`coupons:manage`).
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { createCoupon, listCoupons } from '@/lib/admin/coupons';
import { validateCouponInput } from '@/lib/admin/coupon-validation';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('coupons:read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const statusRaw = url.searchParams.get('status');
  const status = statusRaw === 'active' || statusRaw === 'inactive' ? statusRaw : 'all';
  const search = (url.searchParams.get('search') ?? '').slice(0, 40);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const list = await listCoupons({ search, status, page });
  return jsonOk(list, { cacheControl: NO_STORE });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('coupons:manage');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const parsed = validateCouponInput(body);
  if (!parsed.ok) return jsonErr('VALIDATION_ERROR', parsed.message);

  const result = await createCoupon(parsed.value, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ id: result.id }, { cacheControl: NO_STORE, status: 201 });
}
