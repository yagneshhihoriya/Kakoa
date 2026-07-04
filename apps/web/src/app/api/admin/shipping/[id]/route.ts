/**
 * GET /api/admin/shipping/[id] — shipment detail + its event timeline.
 * Guard `shipping:read`. Malformed / unknown id → NOT_FOUND (never a 500).
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getShipmentDetail } from '@/lib/admin/shipping';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('shipping:read');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const detail = await getShipmentDetail(id);
  if (detail === null) {
    return jsonErr('NOT_FOUND', 'Shipment not found.');
  }
  return jsonOk(detail, { cacheControl: NO_STORE });
}
