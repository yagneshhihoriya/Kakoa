/**
 * Customer wishlist (product-level hearts). SERVER-ONLY: uses @kakoa/db. All
 * operations are scoped to the caller's `customerId` (never a client-supplied
 * id). Add is idempotent (composite PK); remove is a no-op when absent.
 */
import { db, wishlistItems } from "@kakoa/db";
import { and, eq } from "drizzle-orm";
import { isUuid } from "@/lib/admin/product-validation";

export async function listWishlistIds(customerId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.customerId, customerId));
  return rows.map((r) => r.productId);
}

export type WishlistResult = { ok: true } | { ok: false; message: string };

export async function addWishlist(customerId: string, productId: string): Promise<WishlistResult> {
  if (!isUuid(productId)) return { ok: false, message: "Invalid product." };
  try {
    await db
      .insert(wishlistItems)
      .values({ customerId, productId })
      .onConflictDoNothing();
    return { ok: true };
  } catch {
    // FK violation (unknown product) or similar → soft failure.
    return { ok: false, message: "Couldn't save this item." };
  }
}

export async function removeWishlist(customerId: string, productId: string): Promise<WishlistResult> {
  if (!isUuid(productId)) return { ok: false, message: "Invalid product." };
  await db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.customerId, customerId), eq(wishlistItems.productId, productId)));
  return { ok: true };
}
