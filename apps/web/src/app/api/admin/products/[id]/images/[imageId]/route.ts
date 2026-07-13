/**
 * DELETE /api/admin/products/[id]/images/[imageId] — detach an image (`products:write`).
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/guard";
import { removeProductImage, setPrimaryProductImage } from "@/lib/admin/product-images";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
): Promise<Response> {
  const auth = await requireAdmin("products:write");
  if (!auth.ok) return auth.response;
  const { id, imageId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("VALIDATION_ERROR", "Invalid request body.");
  }
  if ((body as { primary?: unknown }).primary !== true) {
    return jsonErr("VALIDATION_ERROR", "Only { primary: true } is supported.");
  }

  const result = await setPrimaryProductImage(id, imageId, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ updated: true }, { cacheControl: NO_STORE });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
): Promise<Response> {
  const auth = await requireAdmin("products:write");
  if (!auth.ok) return auth.response;
  const { id, imageId } = await params;

  const result = await removeProductImage(id, imageId, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ deleted: true }, { cacheControl: NO_STORE });
}
