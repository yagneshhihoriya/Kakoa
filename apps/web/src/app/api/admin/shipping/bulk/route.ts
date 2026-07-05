/**
 * POST /api/admin/shipping/bulk — bulk print labels / request pickup over
 * selected shipments. Body `{ action: 'label' | 'pickup', shipmentIds: string[] }`.
 * Guard `shipping:manage`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { bulkShipmentAction } from '@/lib/admin/shipping';

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('shipping:manage');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const b = body as { action?: unknown; shipmentIds?: unknown };
  if (b.action !== 'label' && b.action !== 'pickup') {
    return jsonErr('VALIDATION_ERROR', 'Unknown bulk action.');
  }

  const result = await bulkShipmentAction(b.action, b.shipmentIds, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk(result, { cacheControl: NO_STORE });
}
