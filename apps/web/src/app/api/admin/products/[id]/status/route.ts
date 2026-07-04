/**
 * POST /api/admin/products/[id]/status — publish / unpublish a product
 * (`products:publish`). Body `{ active: boolean }`. Publishing gates on ≥1
 * active variant with a price + weight.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { setProductActive } from '@/lib/admin/products';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('products:publish');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const active = (body as { active?: unknown }).active;
  if (typeof active !== 'boolean') {
    return jsonErr('VALIDATION_ERROR', 'Missing `active` flag.');
  }

  const { id } = await params;
  const result = await setProductActive(id, active, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ ok: true, active }, { cacheControl: NO_STORE });
}
