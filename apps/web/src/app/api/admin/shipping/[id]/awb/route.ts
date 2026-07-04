/**
 * POST /api/admin/shipping/[id]/awb — assign an AWB + courier to a pending
 * shipment. Body `{ awbCode?, courierName?, courierCompanyId? }`; omit `awbCode`
 * to let the provider assign one. Guard `shipping:manage`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { assignAwb } from '@/lib/admin/shipping';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('shipping:manage');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const result = await assignAwb(id, body, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ shipmentId: result.shipmentId, status: result.status }, { cacheControl: NO_STORE });
}
