/**
 * Shop-grid default-variant lookup — feeds the card's one-tap "Add" CTA
 * (AddToBagButton needs a concrete variant id; the card DTO only carries
 * price aggregates). Page-local data helper: the shared catalog data layer
 * (src/lib/catalog/queries.ts) is a pinned interface and stays untouched.
 *
 * Cached under the 'products' tag like every other catalog read, so admin
 * mutations purge it together with the grid.
 */
import { unstable_cache } from "next/cache";

import { db, productVariants } from "@kakoa/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

/** Matches the catalog data layer's 15-min staleness bound. */
const REVALIDATE_SECONDS = 900;

async function fetchDefaultVariantIds(
  productIds: string[],
): Promise<Record<string, string>> {
  if (productIds.length === 0) return {};

  const rows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.isActive, true),
        inArray(productVariants.productId, productIds),
      ),
    )
    .orderBy(
      asc(productVariants.productId),
      desc(productVariants.isDefault),
      asc(productVariants.position),
      asc(productVariants.name),
    );

  // First active row per product = the default (isDefault, then position).
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (!(row.productId in out)) out[row.productId] = row.id;
  }
  return out;
}

/**
 * `productId → default active variant id` for the given grid page. Products
 * with no active variant are simply absent (the card degrades to a PDP link).
 */
export async function getDefaultVariantIds(
  productIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(productIds)].sort();
  const cached = unstable_cache(
    () => fetchDefaultVariantIds(ids),
    ["shop-default-variants", ids.join(",")],
    { tags: ["products"], revalidate: REVALIDATE_SECONDS },
  );
  return cached();
}
