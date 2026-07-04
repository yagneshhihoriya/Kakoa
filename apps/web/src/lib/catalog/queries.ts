/**
 * Catalog data layer — Module 1 (docs/modules/product-catalog.md §5,
 * Contract §2.2). SERVER-ONLY: direct Drizzle reads via @kakoa/db.
 *
 * Caching (shared interface):
 * - getCategories        → unstable_cache, tag 'categories'
 * - getProducts          → unstable_cache, tag 'products'
 * - getProductBySlug     → unstable_cache, tags ['products', 'product:{slug}']
 * - searchProducts       → uncached (CDN caches the route for 60s)
 * - getLiveStock         → NEVER cached (oversell surface, spec §5.6)
 *
 * All `is_active` filters live in-query on BOTH product and variant so
 * drafts/archived SKUs can never leak through list/detail/search (spec §6).
 */
import { revalidateTag, unstable_cache } from 'next/cache';

import {
  productToneSchema,
  type CategoryView,
  type ProductCardView,
  type ProductDetailView,
  type ProductImageView,
  type ProductListInput,
  type ProductTone,
  type ProductVariantView,
  type SearchHitView,
} from '@kakoa/core';
import {
  categories,
  db,
  orderItems,
  productImages,
  products,
  productVariants,
  storeSettings,
} from '@kakoa/db';
import { and, asc, desc, eq, inArray, ne, notInArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */

/** 15-min time fallback bounds staleness if a tag purge is missed (spec §3). */
const REVALIDATE_SECONDS = 900;

/** Matches the DB CHECK `slug ~ '^[a-z0-9-]+$'` (spec §1.2, max 120). */
const SLUG_RE = /^[a-z0-9-]{1,120}$/;

/** RFC-4122 UUID (case-insensitive) — pre-filter before the IN query. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Per-product aggregate over ACTIVE variants only. Inner-joining this
 * subquery enforces "≥ 1 active variant" everywhere it is used.
 * `compareAtPricePaise` is the compare-at of the cheapest active variant.
 */
const variantAgg = db
  .select({
    productId: productVariants.productId,
    fromPricePaise: sql<number>`min(${productVariants.pricePaise})::int`.as(
      'from_price_paise',
    ),
    compareAtPricePaise: sql<number | null>`
      (array_agg(${productVariants.compareAtPricePaise}
                 order by ${productVariants.pricePaise} asc))[1]
    `.as('compare_at_price_paise'),
    inStock: sql<boolean>`bool_or(${productVariants.stockQuantity} > 0)`.as(
      'in_stock',
    ),
  })
  .from(productVariants)
  .where(eq(productVariants.isActive, true))
  .groupBy(productVariants.productId)
  .as('variant_agg');

/** Raw row shape of the shared product-card select. */
interface CardRow {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  badge: string | null;
  categorySlug: string;
  ratingAvg: string;
  ratingCount: number;
  tone: string;
  fromPricePaise: number;
  compareAtPricePaise: number | null;
  inStock: boolean;
}

const cardColumns = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  blurb: products.blurb,
  badge: products.badge,
  categorySlug: categories.slug,
  ratingAvg: products.ratingAvg,
  ratingCount: products.ratingCount,
  tone: products.tone,
  fromPricePaise: variantAgg.fromPricePaise,
  compareAtPricePaise: variantAgg.compareAtPricePaise,
  inStock: variantAgg.inStock,
};

/** `products.tone` is a text column — coerce defensively to the enum. */
function toTone(value: string): ProductTone {
  const parsed = productToneSchema.safeParse(value);
  return parsed.success ? parsed.data : 'dark';
}

function toCard(row: CardRow): ProductCardView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    blurb: row.blurb,
    badge: row.badge,
    categorySlug: row.categorySlug,
    ratingAvg: Number(row.ratingAvg),
    ratingCount: row.ratingCount,
    tone: toTone(row.tone),
    fromPricePaise: row.fromPricePaise,
    compareAtPricePaise: row.compareAtPricePaise ?? null,
    inStock: row.inStock,
  };
}

/** Trim, NFC-normalize, strip control chars (spec §1.1 `q` sanitization). */
function sanitizeSearchText(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

/** Escape LIKE metacharacters so user text matches literally. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/* ------------------------------------------------------------------ */
/* getCategories                                                       */
/* ------------------------------------------------------------------ */

const getCategoriesCached = unstable_cache(
  async (): Promise<CategoryView[]> => {
    return db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        position: categories.position,
      })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.position), asc(categories.name));
  },
  ['catalog-categories'],
  { tags: ['categories'], revalidate: REVALIDATE_SECONDS },
);

/** Active categories ordered by `position` ASC (spec §5.1). */
export async function getCategories(): Promise<CategoryView[]> {
  return getCategoriesCached();
}

/* ------------------------------------------------------------------ */
/* getProducts                                                         */
/* ------------------------------------------------------------------ */

const getProductsCached = unstable_cache(
  async (
    input: ProductListInput,
  ): Promise<{ products: ProductCardView[]; total: number }> => {
    const { category, sort, page, pageSize } = input;
    const q = input.q === undefined ? '' : sanitizeSearchText(input.q);

    const filters = [eq(products.isActive, true)];
    if (category !== undefined) {
      // Unknown-but-valid-format slug ⇒ empty list, not 404 (spec §1.1).
      filters.push(eq(categories.slug, category));
    }
    if (q.length > 0) {
      const pattern = `%${escapeLike(q)}%`;
      const match = or(
        sql`${products.name} ilike ${pattern}`,
        sql`${products.blurb} ilike ${pattern}`,
      );
      if (match) filters.push(match);
    }
    const where = and(...filters);

    const orderBy =
      sort === 'price_asc'
        ? [asc(variantAgg.fromPricePaise), asc(products.slug)]
        : sort === 'price_desc'
          ? [desc(variantAgg.fromPricePaise), asc(products.slug)]
          : sort === 'rating'
            ? [
                desc(products.ratingAvg),
                desc(products.ratingCount),
                asc(products.slug),
              ]
            : // featured: badge-carrying products first, then seed/created order.
              [
                desc(sql`(${products.badge} is not null)`),
                asc(products.createdAt),
                asc(products.slug),
              ];

    const [rows, [counted]] = await Promise.all([
      db
        .select(cardColumns)
        .from(products)
        .innerJoin(variantAgg, eq(variantAgg.productId, products.id))
        .innerJoin(categories, eq(categories.id, products.categoryId))
        .where(where)
        .orderBy(...orderBy)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(products)
        .innerJoin(variantAgg, eq(variantAgg.productId, products.id))
        .innerJoin(categories, eq(categories.id, products.categoryId))
        .where(where),
    ]);

    return { products: rows.map(toCard), total: counted?.total ?? 0 };
  },
  ['catalog-products'],
  { tags: ['products'], revalidate: REVALIDATE_SECONDS },
);

/**
 * Product grid — active products with ≥ 1 active variant only.
 * `fromPricePaise` = min active-variant price; `inStock` = any active
 * variant with stock (spec §5.2). `total` feeds `meta.total`.
 */
export async function getProducts(
  input: ProductListInput,
): Promise<{ products: ProductCardView[]; total: number }> {
  return getProductsCached(input);
}

/* ------------------------------------------------------------------ */
/* getPublishedProductSlugs — sitemap enumeration                      */
/* ------------------------------------------------------------------ */

/** A published PDP entry for the sitemap: slug + last-touched instant. */
export interface PublishedProductSlug {
  slug: string;
  updatedAt: Date;
}

const getPublishedProductSlugsCached = unstable_cache(
  async (): Promise<PublishedProductSlug[]> => {
    // SAME visibility predicate as the storefront grid: active product with
    // ≥ 1 active variant (the inner join on variantAgg enforces the latter).
    return db
      .select({ slug: products.slug, updatedAt: products.updatedAt })
      .from(products)
      .innerJoin(variantAgg, eq(variantAgg.productId, products.id))
      .where(eq(products.isActive, true))
      .orderBy(asc(products.slug));
  },
  ['catalog-published-slugs'],
  { tags: ['products'], revalidate: REVALIDATE_SECONDS },
);

/**
 * Every indexable PDP slug (published + active, ≥ 1 active variant) with its
 * `updatedAt` for sitemap `lastModified`. Cached under the 'products' tag so
 * catalog mutations purge it alongside the grid.
 */
export async function getPublishedProductSlugs(): Promise<
  PublishedProductSlug[]
> {
  return getPublishedProductSlugsCached();
}

/* ------------------------------------------------------------------ */
/* getProductBySlug                                                    */
/* ------------------------------------------------------------------ */

function toNutritionFacts(value: unknown): Record<string, string> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = typeof raw === 'string' ? raw : String(raw);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Related: same category, top-rated, excl. self; fill from others to 4. */
async function fetchRelated(
  productId: string,
  categoryId: string,
): Promise<ProductCardView[]> {
  const LIMIT = 4;
  const sameCategory = await db
    .select(cardColumns)
    .from(products)
    .innerJoin(variantAgg, eq(variantAgg.productId, products.id))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(products.isActive, true),
        eq(products.categoryId, categoryId),
        ne(products.id, productId),
      ),
    )
    .orderBy(desc(products.ratingAvg), desc(products.ratingCount), asc(products.slug))
    .limit(LIMIT);

  if (sameCategory.length >= LIMIT) return sameCategory.map(toCard);

  const excludeIds = [productId, ...sameCategory.map((row) => row.id)];
  const fill = await db
    .select(cardColumns)
    .from(products)
    .innerJoin(variantAgg, eq(variantAgg.productId, products.id))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.isActive, true), notInArray(products.id, excludeIds)))
    .orderBy(desc(products.ratingAvg), desc(products.ratingCount), asc(products.slug))
    .limit(LIMIT - sameCategory.length);

  return [...sameCategory, ...fill].map(toCard);
}

/**
 * Frequently bought together: co-occurrence in `order_items`, falling back
 * to the top-rated 2 while no orders exist yet (spec §5.3).
 */
async function fetchFrequentlyBoughtTogether(
  productId: string,
): Promise<ProductCardView[]> {
  const LIMIT = 2;
  const oi1 = alias(orderItems, 'oi1');
  const oi2 = alias(orderItems, 'oi2');
  const v1 = alias(productVariants, 'v1');
  const v2 = alias(productVariants, 'v2');

  const coOccurring = await db
    .select({
      productId: v2.productId,
      cnt: sql<number>`count(*)::int`.as('cnt'),
    })
    .from(oi1)
    .innerJoin(v1, eq(v1.id, oi1.variantId))
    .innerJoin(oi2, and(eq(oi2.orderId, oi1.orderId), ne(oi2.id, oi1.id)))
    .innerJoin(v2, eq(v2.id, oi2.variantId))
    .where(and(eq(v1.productId, productId), ne(v2.productId, productId)))
    .groupBy(v2.productId)
    .orderBy(desc(sql`count(*)`))
    .limit(LIMIT);

  if (coOccurring.length > 0) {
    const ids = coOccurring.map((row) => row.productId);
    const rows = await db
      .select(cardColumns)
      .from(products)
      .innerJoin(variantAgg, eq(variantAgg.productId, products.id))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(and(eq(products.isActive, true), inArray(products.id, ids)))
      .limit(LIMIT);
    // Preserve the co-occurrence ranking.
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ranked = ids
      .map((id) => byId.get(id))
      .filter((row): row is CardRow => row !== undefined)
      .map(toCard);
    if (ranked.length > 0) return ranked;
  }

  // No orders yet — fall back to the top-rated 2, excluding self.
  const fallback = await db
    .select(cardColumns)
    .from(products)
    .innerJoin(variantAgg, eq(variantAgg.productId, products.id))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.isActive, true), ne(products.id, productId)))
    .orderBy(desc(products.ratingAvg), desc(products.ratingCount), asc(products.slug))
    .limit(LIMIT);
  return fallback.map(toCard);
}

async function fetchFssaiLicense(): Promise<string> {
  const [row] = await db
    .select({ value: storeSettings.value })
    .from(storeSettings)
    .where(eq(storeSettings.key, 'fssai_license_number'))
    .limit(1);
  // jsonb value — seeded as a bare number; accept string or number.
  if (typeof row?.value === 'string') return row.value;
  if (typeof row?.value === 'number') return String(row.value);
  return '';
}

async function fetchProductDetail(
  slug: string,
): Promise<ProductDetailView | null> {
  const [row] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      blurb: products.blurb,
      badge: products.badge,
      categoryId: products.categoryId,
      categorySlug: categories.slug,
      ratingAvg: products.ratingAvg,
      ratingCount: products.ratingCount,
      tone: products.tone,
      description: products.description,
      tastingNotes: products.tastingNotes,
      ingredients: products.ingredients,
      allergens: products.allergens,
      nutritionFacts: products.nutritionFacts,
      shelfLifeDays: products.shelfLifeDays,
      storageInstructions: products.storageInstructions,
      isVeg: products.isVeg,
      fromPricePaise: variantAgg.fromPricePaise,
      compareAtPricePaise: variantAgg.compareAtPricePaise,
      inStock: variantAgg.inStock,
    })
    .from(products)
    .innerJoin(variantAgg, eq(variantAgg.productId, products.id))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.isActive, true), eq(products.slug, slug)))
    .limit(1);

  if (!row) return null;

  const [variantRows, imageRows, fssaiLicense] = await Promise.all([
    db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        name: productVariants.name,
        pricePaise: productVariants.pricePaise,
        compareAtPricePaise: productVariants.compareAtPricePaise,
        weightGrams: productVariants.weightGrams,
        stockQuantity: productVariants.stockQuantity,
        lowStockThreshold: productVariants.lowStockThreshold,
        isDefault: productVariants.isDefault,
      })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, row.id),
          eq(productVariants.isActive, true),
        ),
      )
      .orderBy(asc(productVariants.position), asc(productVariants.name)),
    db
      .select({
        id: productImages.id,
        url: productImages.url,
        alt: productImages.alt,
        variantId: productImages.variantId,
      })
      .from(productImages)
      .where(eq(productImages.productId, row.id))
      .orderBy(asc(productImages.position), asc(productImages.createdAt)),
    fetchFssaiLicense().catch(() => ''),
  ]);

  // related / FBT degrade to [] — never fail the whole response (spec §5.3).
  const [related, frequentlyBoughtTogether] = await Promise.all([
    fetchRelated(row.id, row.categoryId).catch(
      (): ProductCardView[] => [],
    ),
    fetchFrequentlyBoughtTogether(row.id).catch(
      (): ProductCardView[] => [],
    ),
  ]);

  const variants: ProductVariantView[] = variantRows.map((variant) => {
    const inStock = variant.stockQuantity > 0;
    return {
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      pricePaise: variant.pricePaise,
      compareAtPricePaise: variant.compareAtPricePaise ?? null,
      weightGrams: variant.weightGrams,
      inStock,
      stockLow: inStock && variant.stockQuantity <= variant.lowStockThreshold,
      isDefault: variant.isDefault,
    };
  });

  const images: ProductImageView[] = imageRows.map((image) => ({
    id: image.id,
    url: image.url,
    alt: image.alt,
    variantId: image.variantId ?? null,
  }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    blurb: row.blurb,
    badge: row.badge,
    categorySlug: row.categorySlug,
    ratingAvg: Number(row.ratingAvg),
    ratingCount: row.ratingCount,
    tone: toTone(row.tone),
    fromPricePaise: row.fromPricePaise,
    compareAtPricePaise: row.compareAtPricePaise ?? null,
    inStock: row.inStock,
    description: row.description,
    tastingNotes: row.tastingNotes,
    ingredients: row.ingredients,
    allergens: row.allergens,
    nutritionFacts: toNutritionFacts(row.nutritionFacts),
    shelfLifeDays: row.shelfLifeDays,
    storageInstructions: row.storageInstructions,
    isVeg: row.isVeg,
    fssaiLicense,
    images,
    variants,
    related,
    frequentlyBoughtTogether,
  };
}

/**
 * PDP payload. `null` for unknown, inactive, or zero-active-variant
 * products (spec §5.3 — the page layer decides 404 vs 410 vs 301).
 * Cached per slug under tags ['products', 'product:{slug}'].
 */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailView | null> {
  if (!SLUG_RE.test(slug)) return null;
  const cached = unstable_cache(
    () => fetchProductDetail(slug),
    ['catalog-product', slug],
    { tags: ['products', `product:${slug}`], revalidate: REVALIDATE_SECONDS },
  );
  return cached();
}

/* ------------------------------------------------------------------ */
/* searchProducts                                                      */
/* ------------------------------------------------------------------ */

/**
 * pg_trgm quick search over `name || ' ' || blurb` (products_search_idx).
 * `q` is ALWAYS a bind parameter; active filters (product AND variant)
 * live in the WHERE clause (spec §5.5). < 2 effective chars ⇒ [] with no
 * DB query. Uncached — the route's CDN header is the only cache layer.
 */
export async function searchProducts(
  q: string,
  limit = 8,
): Promise<SearchHitView[]> {
  const text = sanitizeSearchText(q).slice(0, 80);
  if (text.length < 2) return [];
  const capped = Math.min(Math.max(Math.trunc(limit), 1), 20);

  const searchable = sql`(${products.name} || ' ' || ${products.blurb})`;
  const pattern = `%${escapeLike(text)}%`;

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      blurb: products.blurb,
      tone: products.tone,
      fromPricePaise: variantAgg.fromPricePaise,
      categorySlug: categories.slug,
    })
    .from(products)
    .innerJoin(variantAgg, eq(variantAgg.productId, products.id))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(products.isActive, true),
        or(
          sql`${searchable} % ${text}`,
          sql`${searchable} ilike ${pattern}`,
        ),
      ),
    )
    .orderBy(desc(sql`similarity(${searchable}, ${text})`), asc(products.name))
    .limit(capped);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    blurb: row.blurb,
    tone: toTone(row.tone),
    fromPricePaise: row.fromPricePaise,
    categorySlug: row.categorySlug,
  }));
}

/* ------------------------------------------------------------------ */
/* getLiveStock                                                        */
/* ------------------------------------------------------------------ */

/**
 * Live stock booleans for the PDP — NEVER cached; single IN query.
 * Booleans only, never quantities (spec §5.6, scraping surface).
 * Unknown/malformed ids are simply absent from the map; inactive variants
 * report `inStock: false`.
 */
export async function getLiveStock(
  variantIds: string[],
): Promise<Record<string, { inStock: boolean; stockLow: boolean }>> {
  const ids = [...new Set(variantIds.filter((id) => UUID_RE.test(id)))];
  if (ids.length === 0) return {};

  const rows = await db
    .select({
      id: productVariants.id,
      isActive: productVariants.isActive,
      stockQuantity: productVariants.stockQuantity,
      lowStockThreshold: productVariants.lowStockThreshold,
    })
    .from(productVariants)
    .where(inArray(productVariants.id, ids));

  const out: Record<string, { inStock: boolean; stockLow: boolean }> = {};
  for (const row of rows) {
    const inStock = row.isActive && row.stockQuantity > 0;
    out[row.id] = {
      inStock,
      stockLow: inStock && row.stockQuantity <= row.lowStockThreshold,
    };
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* getCatalogSettings                                                  */
/* ------------------------------------------------------------------ */

export interface CatalogSettings {
  /** `store_settings.free_shipping_threshold_paise` — PDP shipping note. */
  freeShippingThresholdPaise: number | null;
  /** `store_settings.gift_wrap_fee_paise` — PDP gift-wrap availability note. */
  giftWrapFeePaise: number | null;
  /** `store_settings.cod_enabled` (default false) — gates the PDP COD note. */
  codEnabled: boolean;
}

function toPaiseSetting(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** jsonb → boolean (true/false, 1/0, "true"/"false"/"1"/"0"); default via `??`. */
function toBoolSetting(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  return null;
}

const getCatalogSettingsCached = unstable_cache(
  async (): Promise<CatalogSettings> => {
    const rows = await db
      .select({ key: storeSettings.key, value: storeSettings.value })
      .from(storeSettings)
      .where(
        inArray(storeSettings.key, [
          'free_shipping_threshold_paise',
          'gift_wrap_fee_paise',
          'cod_enabled',
        ]),
      );
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    return {
      freeShippingThresholdPaise: toPaiseSetting(
        byKey.get('free_shipping_threshold_paise'),
      ),
      giftWrapFeePaise: toPaiseSetting(byKey.get('gift_wrap_fee_paise')),
      // Default OFF: absent key ⇒ COD disabled (prepaid-only launch).
      codEnabled: toBoolSetting(byKey.get('cod_enabled')) ?? false,
    };
  },
  ['catalog-settings'],
  { tags: ['settings'], revalidate: REVALIDATE_SECONDS },
);

/**
 * Catalog-facing `store_settings` values (read-only here; Admin owns
 * writes). Nullable — a missing key renders a degraded note, never a 500.
 */
export async function getCatalogSettings(): Promise<CatalogSettings> {
  return getCatalogSettingsCached();
}

/* ------------------------------------------------------------------ */
/* getFssaiLicense — legal display value (footer, PDP, invoices)       */
/* ------------------------------------------------------------------ */

const getFssaiLicenseCached = unstable_cache(
  async (): Promise<string | null> => {
    const [row] = await db
      .select({ value: storeSettings.value })
      .from(storeSettings)
      .where(eq(storeSettings.key, 'fssai_license_number'))
      .limit(1);
    return typeof row?.value === 'string' && row.value.trim() !== ''
      ? row.value.trim()
      : null;
  },
  ['fssai-license'],
  { tags: ['settings'], revalidate: REVALIDATE_SECONDS },
);

/**
 * The FSSAI licence number for legally-required display. A plain settings read
 * (no cookies) so it stays static-generation-safe; cached + `settings`-tagged.
 * Returns `null` if unset — the caller renders a graceful fallback, never a 500.
 */
export async function getFssaiLicense(): Promise<string | null> {
  return getFssaiLicenseCached();
}

/* ------------------------------------------------------------------ */
/* revalidateCatalog                                                   */
/* ------------------------------------------------------------------ */

/**
 * Purge all catalog caches — for admin mutations (admin-catalog-inventory
 * module) and ops tooling. Per-slug tags (`product:{slug}`) are covered by
 * the blanket 'products' tag on every product entry.
 */
export async function revalidateCatalog(): Promise<void> {
  revalidateTag('products', 'max');
  revalidateTag('categories', 'max');
}
