/**
 * PUT /api/admin/products/[id]/images/order — rewrite the gallery order
 * (`products:write`). Body: `{ ids: string[] }` — every image id of the
 * product, in the new order; the first becomes the storefront primary.
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/guard";
import { reorderProductImages } from "@/lib/admin/product-images";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin("products:write");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("VALIDATION_ERROR", "Invalid request body.");
  }
  const ids = (body as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids)) return jsonErr("VALIDATION_ERROR", "Send the gallery's image ids in their new order.");

  const result = await reorderProductImages(id, ids, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ updated: true }, { cacheControl: NO_STORE });
}
