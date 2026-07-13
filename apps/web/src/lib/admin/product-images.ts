/**
 * Product image gallery management (admin-catalog-inventory.md). Images are
 * chosen from the Media Library (or uploaded there first) and attached to a
 * product as `product_images` rows. The storefront listing/PDP read these, so
 * every mutation purges the catalog cache (revalidateCatalog).
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { adminAuditLog, db, productImages, products } from "@kakoa/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidateCatalog } from "@/lib/catalog/queries";
import { isUuid } from "./product-validation";

export interface ProductImageRow {
  id: string;
  url: string;
  alt: string;
  position: number;
}

export async function listProductImages(productId: string): Promise<ProductImageRow[]> {
  if (!isUuid(productId)) return [];
  return db
    .select({
      id: productImages.id,
      url: productImages.url,
      alt: productImages.alt,
      position: productImages.position,
    })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.position));
}

export type ImageMutationResult =
  | { ok: true; id?: string }
  | { ok: false; code: "NOT_FOUND" | "VALIDATION_ERROR"; message: string };

/** Attach an image URL (from the Media Library) to the end of the gallery. */
export async function attachProductImage(
  productId: string,
  input: { url: string; alt?: string },
  adminUserId: string,
): Promise<ImageMutationResult> {
  if (!isUuid(productId)) return { ok: false, code: "NOT_FOUND", message: "We couldn't find that product." };
  const url = input.url.trim();
  if (url.length === 0 || url.length > 2000) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Select an image from the media library." };
  }

  const result = await db.transaction(async (tx): Promise<ImageMutationResult> => {
    const [prod] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!prod) return { ok: false, code: "NOT_FOUND", message: "We couldn't find that product." };

    const [agg] = await tx
      .select({ maxPos: sql<number>`coalesce(max(${productImages.position}), 0)::int` })
      .from(productImages)
      .where(eq(productImages.productId, productId));

    const [row] = await tx
      .insert(productImages)
      .values({
        productId,
        url,
        alt: (input.alt ?? "").slice(0, 300),
        position: Number(agg?.maxPos ?? 0) + 1,
      })
      .returning({ id: productImages.id });
    if (!row) return { ok: false, code: "VALIDATION_ERROR", message: "Could not attach the image." };
    await tx.insert(adminAuditLog).values({
      adminUserId,
      action: "product.image.attach",
      entityType: "product",
      entityId: productId,
      before: null,
      after: { imageId: row.id, url },
    });
    return { ok: true, id: row.id };
  });

  if (result.ok) await revalidateCatalog();
  return result;
}

/** Make an image the primary (first) one; resequences the gallery 0..n. */
export async function setPrimaryProductImage(
  productId: string,
  imageId: string,
  adminUserId: string,
): Promise<ImageMutationResult> {
  if (!isUuid(productId) || !isUuid(imageId)) {
    return { ok: false, code: "NOT_FOUND", message: "We couldn't find that image." };
  }
  const result = await db.transaction(async (tx): Promise<ImageMutationResult> => {
    const rows = await tx
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.position), asc(productImages.createdAt));
    if (!rows.some((r) => r.id === imageId)) {
      return { ok: false, code: "NOT_FOUND", message: "We couldn't find that image." };
    }
    const ordered = [imageId, ...rows.filter((r) => r.id !== imageId).map((r) => r.id)];
    for (let i = 0; i < ordered.length; i += 1) {
      await tx.update(productImages).set({ position: i }).where(eq(productImages.id, ordered[i]!));
    }    await tx.insert(adminAuditLog).values({
      adminUserId,
      action: "product.image.reorder",
      entityType: "product",
      entityId: productId,
      before: null,
      after: { primaryImageId: imageId },
    });
    return { ok: true };
  });
  if (result.ok) await revalidateCatalog();
  return result;
}

/** Detach (delete) an image from a product's gallery. */
export async function removeProductImage(
  productId: string,
  imageId: string,
  adminUserId: string,
): Promise<ImageMutationResult> {
  if (!isUuid(productId) || !isUuid(imageId)) {
    return { ok: false, code: "NOT_FOUND", message: "We couldn't find that image." };
  }
  const result = await db.transaction(async (tx): Promise<ImageMutationResult> => {
    const [row] = await tx
      .select({ id: productImages.id, url: productImages.url })
      .from(productImages)
      .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
      .limit(1);
    if (!row) return { ok: false, code: "NOT_FOUND", message: "We couldn't find that image." };

    await tx.delete(productImages).where(eq(productImages.id, imageId));    await tx.insert(adminAuditLog).values({
      adminUserId,
      action: "product.image.detach",
      entityType: "product",
      entityId: productId,
      before: { imageId, url: row.url },
      after: null,
    });
    return { ok: true };
  });

  if (result.ok) await revalidateCatalog();
  return result;
}
