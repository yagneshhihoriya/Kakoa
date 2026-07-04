/**
 * PATCH /api/admin/taxes/variant/[id] — set one variant's GST rate + HSN.
 * Body `{ gstRateBp, hsnCode }`. Guard `taxes:manage`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { updateVariantTax } from '@/lib/admin/taxes';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('taxes:manage');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }

  const result = await updateVariantTax(id, body, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ gstRateBp: result.gstRateBp, hsnCode: result.hsnCode }, { cacheControl: NO_STORE });
}
