/**
 * GET  /api/admin/media   — list media assets, newest first (`media:read`).
 *                           Query: `search`, `page`, `folder` (`general` or
 *                           `products/<uuid>`; omit for the whole library).
 * POST /api/admin/media   — upload an image (multipart `file`, optional
 *                           `folder` field) (`media:write`).
 *
 * Upload is server-proxied: the bytes are validated (magic-byte sniff + size +
 * MIME allowlist) here, stored via the MediaProvider (S3 in prod, local in dev),
 * and recorded as a media_assets row. Node runtime (reads the file buffer).
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/guard";
import { listMedia, uploadMedia } from "@/lib/admin/media";
import { parseMediaFolder } from "@/lib/admin/media-folder";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin("media:read");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? undefined;
  const page = url.searchParams.get("page") ?? undefined;
  const folderRaw = url.searchParams.get("folder");
  let folder: string | undefined;
  if (folderRaw !== null) {
    const parsed = parseMediaFolder(folderRaw);
    if (parsed === null) return jsonErr("VALIDATION_ERROR", "That folder is not valid.");
    folder = parsed;
  }
  const media = await listMedia({ search, page: page ? Number(page) : undefined, folder });
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

  const folderField = form.get("folder");
  let folder: string | undefined;
  if (folderField !== null) {
    const parsed = parseMediaFolder(folderField);
    if (parsed === null) return jsonErr("VALIDATION_ERROR", "That folder is not valid.");
    folder = parsed;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadMedia({
    bytes,
    filename: file.name || "upload",
    adminUserId: auth.value.admin.id,
    folder,
  });
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ asset: result.asset }, { cacheControl: NO_STORE });
}
