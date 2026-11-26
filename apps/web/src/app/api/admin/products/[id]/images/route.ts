/**
 * GET  /api/admin/products/[id]/images — list a product's gallery (`products:read`).
 * POST /api/admin/products/[id]/images — attach media URLs (`products:write`).
 *      Body: `{ url, alt? }` (one image, returns `{ id }`) or
 *      `{ images: [{ url, alt? }] }` (a batch, returns `{ ids, skipped }`).
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/guard";
import {
  attachProductImage,
  attachProductImages,
  listProductImages,
  MAX_ATTACH_BATCH,
  type AttachImageInput,
} from "@/lib/admin/product-images";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin("products:read");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const images = await listProductImages(id);
  return jsonOk({ images }, { cacheControl: NO_STORE });
}

export async function POST(
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
  const b = body as { url?: unknown; alt?: unknown; images?: unknown };

  if (Array.isArray(b.images)) {
    if (b.images.length === 0 || b.images.length > MAX_ATTACH_BATCH) {
      return jsonErr("VALIDATION_ERROR", `Select between 1 and ${MAX_ATTACH_BATCH} images.`);
    }
    const items: AttachImageInput[] = [];
    for (const raw of b.images as unknown[]) {
      const it = raw as { url?: unknown; alt?: unknown } | null;
      if (it === null || typeof it !== "object" || typeof it.url !== "string") {
        return jsonErr("VALIDATION_ERROR", "Each image needs a url.");
      }
      items.push({ url: it.url, alt: typeof it.alt === "string" ? it.alt : undefined });
    }
    const batch = await attachProductImages(id, items, auth.value.admin.id);
    if (!batch.ok) return jsonErr(batch.code, batch.message);
    return jsonOk({ ids: batch.ids, skipped: batch.skipped }, { cacheControl: NO_STORE });
  }

  if (typeof b.url !== "string") return jsonErr("VALIDATION_ERROR", "An image url is required.");

  const result = await attachProductImage(
    id,
    { url: b.url, alt: typeof b.alt === "string" ? b.alt : undefined },
    auth.value.admin.id,
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ id: result.id }, { cacheControl: NO_STORE });
}
