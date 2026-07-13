/**
 * GET  /api/admin/media   — list media assets, newest first (`media:read`).
 * POST /api/admin/media   — upload an image (multipart `file`) (`media:write`).
 *
 * Upload is server-proxied: the bytes are validated (magic-byte sniff + size +
 * MIME allowlist) here, stored via the MediaProvider (S3 in prod, local in dev),
 * and recorded as a media_assets row. Node runtime (reads the file buffer).
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/guard";
import { listMedia, uploadMedia } from "@/lib/admin/media";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin("media:read");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? undefined;
  const page = url.searchParams.get("page") ?? undefined;
  const media = await listMedia({ search, page: page ? Number(page) : undefined });
  return jsonOk(media, { cacheControl: NO_STORE });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin("media:write");
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonErr("VALIDATION_ERROR", "Expected a multipart file upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonErr("VALIDATION_ERROR", "Attach an image file to upload.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadMedia({
    bytes,
    filename: file.name || "upload",
    adminUserId: auth.value.admin.id,
  });
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ asset: result.asset }, { cacheControl: NO_STORE });
}
