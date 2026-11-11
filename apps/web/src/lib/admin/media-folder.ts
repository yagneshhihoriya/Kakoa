/**
 * Pure Media Library folder helpers — NO db import, unit-testable. A folder
 * scopes an asset: `general` is the shared library, `products/<uuid>` is one
 * product's own gallery (uploads from the product editor land there). Nothing
 * else is accepted, so the column never carries free text.
 */
import { isUuid } from "./product-validation";

export const GENERAL_MEDIA_FOLDER = "general";

const PRODUCT_FOLDER_RE =
  /^products\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** The folder a product's own images live in. */
export function productMediaFolder(productId: string): string {
  return `products/${productId.toLowerCase()}`;
}

/**
 * Validate a folder from the wire. Returns the canonical folder string
 * (`general` or `products/<lower-case uuid>`) or null when it is not one.
 */
export function parseMediaFolder(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (value === GENERAL_MEDIA_FOLDER) return GENERAL_MEDIA_FOLDER;
  const m = PRODUCT_FOLDER_RE.exec(value);
  const id = m?.[1];
  if (id === undefined || !isUuid(id)) return null;
  return productMediaFolder(id);
}
