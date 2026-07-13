/**
 * /api/wishlist — customer wishlist toggle (session is the credential).
 *   GET    → { productIds }            (401 if not signed in)
 *   POST   { productId } → { saved }    add
 *   DELETE { productId } → { saved:false } remove
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { getCurrentCustomer } from "@/lib/auth/session";
import { addWishlist, listWishlistIds, removeWishlist } from "@/lib/wishlist/wishlist";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const customer = await getCurrentCustomer();
  if (customer === null) return jsonErr("UNAUTHORIZED", "Please sign in.");
  const productIds = await listWishlistIds(customer.id);
  return jsonOk({ productIds }, { cacheControl: NO_STORE });
}

async function readProductId(req: Request): Promise<string | null> {
  try {
    const body = await req.json();
    const id = (body as { productId?: unknown }).productId;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  const customer = await getCurrentCustomer();
  if (customer === null) return jsonErr("UNAUTHORIZED", "Please sign in to save items.");
  const productId = await readProductId(req);
  if (productId === null) return jsonErr("VALIDATION_ERROR", "A product is required.");
  const result = await addWishlist(customer.id, productId);
  if (!result.ok) return jsonErr("VALIDATION_ERROR", result.message);
  return jsonOk({ saved: true }, { cacheControl: NO_STORE });
}

export async function DELETE(req: Request): Promise<Response> {
  const customer = await getCurrentCustomer();
  if (customer === null) return jsonErr("UNAUTHORIZED", "Please sign in.");
  const productId = await readProductId(req);
  if (productId === null) return jsonErr("VALIDATION_ERROR", "A product is required.");
  const result = await removeWishlist(customer.id, productId);
  if (!result.ok) return jsonErr("VALIDATION_ERROR", result.message);
  return jsonOk({ saved: false }, { cacheControl: NO_STORE });
}
