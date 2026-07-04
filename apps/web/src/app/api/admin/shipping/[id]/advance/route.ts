/**
 * POST /api/admin/shipping/[id]/advance — advance a shipment to `toStatus`
 * through the monotonic machine, mirroring the order. Body `{ toStatus }`.
 * Guard `shipping:manage`.
 */
import { SHIPMENT_STATUSES, type ShipmentStatus } from '@kakoa/core';
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { advanceShipment } from '@/lib/admin/shipping';

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
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const toStatus = (body as { toStatus?: unknown }).toStatus;
  if (typeof toStatus !== 'string' || !(SHIPMENT_STATUSES as readonly string[]).includes(toStatus)) {
    return jsonErr('VALIDATION_ERROR', 'Invalid target status.');
  }

  const result = await advanceShipment(id, toStatus as ShipmentStatus, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ shipmentId: result.shipmentId, status: result.status }, { cacheControl: NO_STORE });
}
