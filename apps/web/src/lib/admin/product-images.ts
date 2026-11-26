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
import { dedupeByUrl, validateReorderIds } from "./product-images-order";
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

export type ImageBatchResult =
  | { ok: true; ids: string[]; skipped: number }
  | { ok: false; code: "NOT_FOUND" | "VALIDATION_ERROR"; message: string };

/** Hard cap on one batch — the picker and the multi-file upload both stay well under it. */
export const MAX_ATTACH_BATCH = 50;

export interface AttachImageInput {
  url: string;
  alt?: string;
}

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

/**
 * Attach several Media Library images in one transaction. Positions continue
 * after the current max; a URL already in the gallery (or repeated in the
 * batch) is skipped, not an error. One audit row carries every added id and
 * the cache is purged once.
 */
export async function attachProductImages(
  productId: string,
  items: readonly AttachImageInput[],
  adminUserId: string,
): Promise<ImageBatchResult> {
  if (!isUuid(productId)) return { ok: false, code: "NOT_FOUND", message: "We couldn't find that product." };
  if (items.length === 0 || items.length > MAX_ATTACH_BATCH) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Select between 1 and 50 images." };
  }
  const clean = items.map((it) => ({ url: it.url.trim(), alt: (it.alt ?? "").slice(0, 300) }));
  if (clean.some((it) => it.url.length === 0 || it.url.length > 2000)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Select images from the media library." };
  }

  const result = await db.transaction(async (tx): Promise<ImageBatchResult> => {
    const [prod] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!prod) return { ok: false, code: "NOT_FOUND", message: "We couldn't find that product." };

    const existing = await tx
      .select({ url: productImages.url, position: productImages.position })
      .from(productImages)
      .where(eq(productImages.productId, productId));
    const fresh = dedupeByUrl(clean, existing.map((r) => r.url));
    const skipped = clean.length - fresh.length;
    if (fresh.length === 0) return { ok: true, ids: [], skipped };

    const maxPos = existing.reduce((m, r) => Math.max(m, r.position), -1);
    const rows = await tx
      .insert(productImages)
      .values(fresh.map((it, i) => ({ productId, url: it.url, alt: it.alt, position: maxPos + 1 + i })))
      .returning({ id: productImages.id });
    const ids = rows.map((r) => r.id);
    await tx.insert(adminAuditLog).values({
      adminUserId,
      action: "product.image.attach",
      entityType: "product",
      entityId: productId,
      before: null,
      after: { imageIds: ids, urls: fresh.map((it) => it.url), skipped },
    });
    return { ok: true, ids, skipped };
  });

  if (result.ok && result.ids.length > 0) await revalidateCatalog();
  return result;
}

/**
 * Rewrite the gallery order from the full list of image ids (drag-and-drop).
 * `ids` must be exactly the product's current set; positions become 0..n so
 * the first id is the storefront primary, consistent with setPrimaryProductImage.
 */
export async function reorderProductImages(
  productId: string,
  ids: unknown,
  adminUserId: string,
): Promise<ImageMutationResult> {
  if (!isUuid(productId)) return { ok: false, code: "NOT_FOUND", message: "We couldn't find that product." };

  const result = await db.transaction(async (tx): Promise<ImageMutationResult> => {
    const rows = await tx
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.position), asc(productImages.createdAt));
    if (rows.length === 0) return { ok: false, code: "NOT_FOUND", message: "This product has no images yet." };

    const before = rows.map((r) => r.id);
    const check = validateReorderIds(ids, before);
    if (!check.ok) return { ok: false, code: "VALIDATION_ERROR", message: check.message };

    for (let i = 0; i < check.ids.length; i += 1) {
      await tx
        .update(productImages)
        .set({ position: i })
        .where(and(eq(productImages.id, check.ids[i]!), eq(productImages.productId, productId)));
    }
    await tx.insert(adminAuditLog).values({
      adminUserId,
      action: "product.image.reorder",
      entityType: "product",
      entityId: productId,
      before: { order: before },
      after: { order: check.ids },
    });
    return { ok: true };
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
