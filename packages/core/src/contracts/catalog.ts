/**
 * Catalog contracts — Contract §2.2 (PROJECT_PLAN.md §3.0) +
 * docs/modules/product-catalog.md §1/§5.
 *
 * zod schemas are the single source of truth for every catalog DTO; TS
 * types are `z.infer` only. All money fields are integer paise; rendering
 * goes through `formatPaise` / `@kakoa/ui` Price exclusively.
 */

import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

/** Matches DB CHECK `slug ~ '^[a-z0-9-]+$'` (categories/products). */
const slugSchema = z.string().regex(/^[a-z0-9-]+$/);

/** Integer paise (MRP, GST-inclusive). DB CHECK `price_paise > 0`. */
const paiseSchema = z.number().int().positive();

/**
 * Placeholder swatch key (`products.tone`, text column). An opaque string here:
 * the vertical preset's `presentation.swatches` names the valid keys and the
 * storefront falls back to the preset's default swatch for anything else, so
 * the contract never has to know a vertical's palette.
 */
export const productToneSchema = z.string().min(1);
export type ProductTone = z.infer<typeof productToneSchema>;

export const PRODUCT_SORTS = [
  'featured',
  'price_asc',
  'price_desc',
  'rating',
] as const;
export const productSortSchema = z.enum(PRODUCT_SORTS);
export type ProductSort = z.infer<typeof productSortSchema>;

/* ------------------------------------------------------------------ */
/* Category                                                            */
/* ------------------------------------------------------------------ */

export const categorySchema = z.object({
  id: z.string().uuid(),
  slug: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  /** Tile image (`categories.image_url`); null → the preset swatch fallback. */
  imageUrl: z.string().nullable(),
});
export type CategoryView = z.infer<typeof categorySchema>;

/* ------------------------------------------------------------------ */
/* Product card (grid / related / FBT)                                 */
/* ------------------------------------------------------------------ */

export const productCardSchema = z.object({
  id: z.string().uuid(),
  slug: slugSchema,
  name: z.string(),
  blurb: z.string(),
  badge: z.string().nullable(),
  categorySlug: slugSchema,
  ratingAvg: z.number().min(0).max(5),
  ratingCount: z.number().int().min(0),
  tone: productToneSchema,
  fromPricePaise: paiseSchema,
  compareAtPricePaise: paiseSchema.nullable(),
  inStock: z.boolean(),
  /** Primary (lowest-position) product image URL, or null to use a placeholder. */
  imageUrl: z.string().nullable(),
});
export type ProductCardView = z.infer<typeof productCardSchema>;

/* ------------------------------------------------------------------ */
/* Product detail (PDP)                                                */
/* ------------------------------------------------------------------ */

export const productVariantViewSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  pricePaise: paiseSchema,
  compareAtPricePaise: paiseSchema.nullable(),
  weightGrams: z.number().int().positive(),
  inStock: z.boolean(),
  stockLow: z.boolean(),
  isDefault: z.boolean(),
});
export type ProductVariantView = z.infer<typeof productVariantViewSchema>;

export const productImageViewSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  alt: z.string(),
  variantId: z.string().uuid().nullable(),
});
export type ProductImageView = z.infer<typeof productImageViewSchema>;

export const productDetailSchema = productCardSchema.extend({
  description: z.string(),
  ingredients: z.string(),
  allergens: z.string(),
  /**
   * Allergens declared through the preset's `allergens` multi-enum attribute
   * (`attributes.allergens`) — `[]` when the vertical has no `allergens`
   * capability or the product declares none. `allergens` above remains the
   * free-text advisory ("Made on lines that also handle…").
   */
  declaredAllergens: z.array(z.string()),
  nutritionFacts: z.record(z.string(), z.string()).nullable(),
  shelfLifeDays: z.number().int().positive().nullable(),
  storageInstructions: z.string().nullable(),
  isVeg: z.boolean(),
  /** Vertical-preset attributes flagged showOnPdp, resolved to label/value/unit. */
  pdpAttributes: z.array(
    z.object({ label: z.string(), value: z.string(), unit: z.string().nullable() }),
  ),
  /** "What you'll get" editorial copy — `attributes.whatYoullGet`; null when unset. */
  whatYoullGet: z.string().nullable(),
  /** Per-product Shipping copy — `attributes.shipping`; null → the standard note. */
  shippingInfo: z.string().nullable(),
  /** From `store_settings` — Legal Metrology / FSSAI display. */
  fssaiLicense: z.string(),
  /** Approved customer reviews (newest first), reviewer name display-safe. */
  reviews: z.array(
    z.object({
      id: z.string(),
      author: z.string(),
      rating: z.number().int().min(1).max(5),
      title: z.string().nullable(),
      body: z.string(),
      dateIso: z.string(),
    }),
  ),
  images: z.array(productImageViewSchema),
  variants: z.array(productVariantViewSchema),
  /** Same category, top-rated, excl. self. Degrades to `[]`. */
  related: z.array(productCardSchema),
  /** Co-occurrence in order_items, fallback best sellers. Degrades to `[]`. */
  frequentlyBoughtTogether: z.array(productCardSchema),
});
export type ProductDetailView = z.infer<typeof productDetailSchema>;

/* ------------------------------------------------------------------ */
/* Search (trgm-backed quick search)                                   */
/* ------------------------------------------------------------------ */

export const searchHitSchema = z.object({
  id: z.string().uuid(),
  slug: slugSchema,
  name: z.string(),
  blurb: z.string(),
  tone: productToneSchema,
  fromPricePaise: paiseSchema,
  categorySlug: slugSchema,
});
export type SearchHitView = z.infer<typeof searchHitSchema>;

/* ------------------------------------------------------------------ */
/* Product list input (query params, module spec §1.1)                 */
/* ------------------------------------------------------------------ */

export const productListInputSchema = z
  .object({
    category: z
      .string()
      .regex(/^[a-z0-9-]{1,60}$/, 'Invalid category filter.')
      .optional(),
    sort: productSortSchema.default('featured'),
    page: z.coerce
      .number()
      .int('Page must be a whole number between 1 and 500.')
      .min(1, 'Page must be a whole number between 1 and 500.')
      .max(500, 'Page must be a whole number between 1 and 500.')
      .default(1),
    pageSize: z.coerce
      .number()
      .int('Page size must be between 1 and 48.')
      .min(1, 'Page size must be between 1 and 48.')
      .max(48, 'Page size must be between 1 and 48.')
      .default(24),
    q: z
      .string()
      .trim()
      .max(60, 'Search text is too long (max 60 characters).')
      .optional(),
  })
  .strict();
/** Parsed shape (defaults applied). */
export type ProductListInput = z.infer<typeof productListInputSchema>;
/** Pre-parse shape (all fields optional) — what callers may pass. */
export type ProductListQuery = z.input<typeof productListInputSchema>;
