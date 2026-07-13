/**
 * GET  /api/admin/products/[id]/images — list a product's gallery (`products:read`).
 * POST /api/admin/products/[id]/images — attach a media URL (`products:write`).
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/guard";
import { attachProductImage, listProductImages } from "@/lib/admin/product-images";

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
  const b = body as { url?: unknown; alt?: unknown };
  if (typeof b.url !== "string") return jsonErr("VALIDATION_ERROR", "An image url is required.");

  const result = await attachProductImage(
    id,
    { url: b.url, alt: typeof b.alt === "string" ? b.alt : undefined },
    auth.value.admin.id,
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ id: result.id }, { cacheControl: NO_STORE });
}
