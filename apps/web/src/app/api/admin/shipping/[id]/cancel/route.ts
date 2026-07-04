/**
 * POST /api/admin/shipping/[id]/cancel — cancel + supersede a shipment (frees the
 * one-active index so the order can be re-shipped). Guard `shipping:manage`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { cancelShipment } from '@/lib/admin/shipping';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('shipping:manage');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await cancelShipment(id, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ shipmentId: result.shipmentId, status: result.status }, { cacheControl: NO_STORE });
}
