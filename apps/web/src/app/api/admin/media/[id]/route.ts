/**
 * DELETE /api/admin/media/[id] — remove an asset (storage + row) (`media:write`).
 * PATCH  /api/admin/media/[id] — update alt text (`media:write`).
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/guard";
import { deleteMedia, updateMediaAlt } from "@/lib/admin/media";
import { isUuid } from "@/lib/admin/product-validation";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin("media:write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonErr("NOT_FOUND", "We couldn't find that file.");

  const result = await deleteMedia(id, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ deleted: true }, { cacheControl: NO_STORE });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin("media:write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonErr("NOT_FOUND", "We couldn't find that file.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("VALIDATION_ERROR", "Invalid request body.");
  }
  const alt = (body as { alt?: unknown }).alt;
  if (typeof alt !== "string") return jsonErr("VALIDATION_ERROR", "Alt text is required.");

  const result = await updateMediaAlt(id, alt, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ updated: true }, { cacheControl: NO_STORE });
}
