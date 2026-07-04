/**
 * GET /api/admin/orders/[orderNumber] — order detail (admin-orders.md). Guarded
 * by `orders:read`. 404 when the order doesn't exist.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getOrderDetail } from '@/lib/admin/orders';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  const auth = await requireAdmin('orders:read');
  if (!auth.ok) return auth.response;

  const { orderNumber } = await params;
  const detail = await getOrderDetail(orderNumber);
  if (detail === null) {
    return jsonErr('NOT_FOUND', "We couldn't find that order.");
  }
  return jsonOk(detail, { cacheControl: NO_STORE });
}
