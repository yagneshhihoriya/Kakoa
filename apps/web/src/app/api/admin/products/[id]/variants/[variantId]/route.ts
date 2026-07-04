/**
 * PATCH /api/admin/products/[id]/variants/[variantId] — update a variant
 * (`products:write`). Promoting to default unsets the prior default in-tx.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { updateVariant } from '@/lib/admin/products';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> },
): Promise<Response> {
  const auth = await requireAdmin('products:write');
  if (!auth.ok) return auth.response;

  const { id, variantId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }

  const result = await updateVariant(id, variantId, body, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ ok: true }, { cacheControl: NO_STORE });
}
