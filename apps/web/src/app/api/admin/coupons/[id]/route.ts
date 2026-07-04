/**
 * GET   /api/admin/coupons/[id] — coupon detail (`coupons:read`).
 * PATCH /api/admin/coupons/[id] — update a coupon (`coupons:manage`).
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getCoupon, updateCoupon } from '@/lib/admin/coupons';
import { validateCouponInput } from '@/lib/admin/coupon-validation';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('coupons:read');
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const coupon = await getCoupon(id);
  if (coupon === null) return jsonErr('NOT_FOUND', "We couldn't find that coupon.");
  return jsonOk(coupon, { cacheControl: NO_STORE });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('coupons:manage');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const parsed = validateCouponInput(body);
  if (!parsed.ok) return jsonErr('VALIDATION_ERROR', parsed.message);

  const result = await updateCoupon(id, parsed.value, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ ok: true }, { cacheControl: NO_STORE });
}
