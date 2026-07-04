/**
 * Admin shipping console.
 *  - GET  /api/admin/shipping — list shipments (filters + search). Guard `shipping:read`.
 *  - POST /api/admin/shipping — create a shipment for an order. Body `{ orderId }`.
 *    Guard `shipping:manage`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { createShipment, isShipmentFilter, listShipments } from '@/lib/admin/shipping';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('shipping:read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const filterRaw = url.searchParams.get('filter') ?? 'all';
  const list = await listShipments({
    search: url.searchParams.get('search') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    filter: isShipmentFilter(filterRaw) ? filterRaw : 'all',
    page: Number(url.searchParams.get('page') ?? '1') || 1,
  });
  return jsonOk(list, { cacheControl: NO_STORE });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('shipping:manage');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const orderId = (body as { orderId?: unknown }).orderId;
  if (typeof orderId !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'An order id is required.');
  }

  const result = await createShipment(orderId, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ shipmentId: result.shipmentId, status: result.status }, { cacheControl: NO_STORE, status: 201 });
}
