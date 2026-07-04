/**
 * POST /api/admin/inventory/[variantId]/adjust — set a variant's on-hand and
 * write a ledger row + audit (`inventory:adjust`). Body: { newQuantity, reason, note? }.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { adjustStock } from '@/lib/admin/inventory';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ variantId: string }> },
): Promise<Response> {
  const auth = await requireAdmin('inventory:adjust');
  if (!auth.ok) return auth.response;

  const { variantId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const b = body as { newQuantity?: unknown; reason?: unknown; note?: unknown };
  if (typeof b.newQuantity !== 'number' || typeof b.reason !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'A new quantity and reason are required.');
  }

  const result = await adjustStock(
    {
      variantId,
      newQuantity: b.newQuantity,
      reason: b.reason,
      note: typeof b.note === 'string' ? b.note : undefined,
    },
    auth.value.admin.id,
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ stockAfter: result.stockAfter, delta: result.delta }, { cacheControl: NO_STORE });
}
