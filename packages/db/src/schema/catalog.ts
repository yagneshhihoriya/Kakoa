/**
 * Catalog — Contract §1.2–1.5 (DATABASE_ERD.md §3.2–3.5).
 * categories, products, product_variants, product_images.
 * Catalog entities are soft-deleted only (`is_active`).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './helpers';

/** Table, not enum: admin adds seasonal collections without a migration. */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    position: integer('position').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [check('categories_slug_check', sql`${t.slug} ~ '^[a-z0-9-]+$'`)],
);

/** The sellable concept (Truffle Noir); price/stock/GST live on variants. */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    blurb: text('blurb').notNull().default(''),
    description: text('description').notNull().default(''),
    tastingNotes: text('tasting_notes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ingredients: text('ingredients').notNull().default(''),
    allergens: text('allergens').notNull().default(''),
    nutritionFacts: jsonb('nutrition_facts'),
    shelfLifeDays: integer('shelf_life_days'),
    storageInstructions: text('storage_instructions'),
    isVeg: boolean('is_veg').notNull().default(true), // FSSAI green/brown dot
    badge: text('badge'), // 'Best seller' | 'New' | 'Limited' | 'Vegan' | 'Seasonal'
    tone: text('tone').notNull().default('dark'),
    /**
     * Generic per-business product attributes (docs/admin-platform §2.4, A5).
     * Keyed by the active vertical preset's `attributeSchema` — the admin
     * Products form reads/writes these, so the catalog is business-agnostic
     * (chocolate/coffee/bakery/…) without schema changes per vertical.
     */
    attributes: jsonb('attributes').notNull().default(sql`'{}'::jsonb`),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 })
      .notNull()
      .default('0'), // DENORMALIZED: recomputed on review approve/reject
    ratingCount: integer('rating_count').notNull().default(0), // DENORMALIZED
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('products_slug_check', sql`${t.slug} ~ '^[a-z0-9-]+$'`),
    check('products_shelf_life_check', sql`${t.shelfLifeDays} > 0`),
    index('products_category_active_idx')
      .on(t.categoryId)
      .where(sql`${t.isActive}`),
    // pg_trgm search over name + blurb
    index('products_search_idx').using(
      'gin',
      sql`(${t.name} || ' ' || ${t.blurb}) gin_trgm_ops`,
    ),
  ],
);

/**
 * The purchasable SKU. Owns price (MRP, GST-inclusive), GST rate as data,
 * HSN, physicals for Shiprocket, and the authoritative stock counter
 * (oversell prevention via atomic conditional decrement, §1.28.1).
 */
export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull().unique(), // 'KK-TRN-16PC'
    name: text('name').notNull(), // '16-piece box', '70g bar'
    pricePaise: integer('price_paise').notNull(), // MRP, GST-inclusive
    compareAtPricePaise: integer('compare_at_price_paise'),
    gstRateBp: integer('gst_rate_bp').notNull().default(500),
    hsnCode: text('hsn_code').notNull().default('1806'),
    weightGrams: integer('weight_grams').notNull(), // net quantity (Legal Metrology)
    shipWeightGrams: integer('ship_weight_grams').notNull(), // packed weight
    lengthCm: numeric('length_cm', { precision: 6, scale: 2 }),
    breadthCm: numeric('breadth_cm', { precision: 6, scale: 2 }),
    heightCm: numeric('height_cm', { precision: 6, scale: 2 }),
    stockQuantity: integer('stock_quantity').notNull().default(0), // authoritative on-hand
    lowStockThreshold: integer('low_stock_threshold').notNull().default(10),
    position: integer('position').notNull().default(0),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('product_variants_price_check', sql`${t.pricePaise} > 0`),
    check(
      'product_variants_compare_at_check',
      sql`${t.compareAtPricePaise} > ${t.pricePaise}`,
    ),
    check(
      'product_variants_gst_rate_check',
      sql`${t.gstRateBp} BETWEEN 0 AND 2800`,
    ),
    check('product_variants_weight_check', sql`${t.weightGrams} > 0`),
    check('product_variants_stock_check', sql`${t.stockQuantity} >= 0`),
    index('product_variants_product_idx').on(t.productId),
    // exactly one default variant per product
    uniqueIndex('product_variants_one_default_idx')
      .on(t.productId)
      .where(sql`${t.isDefault}`),
    // admin low-stock list
    index('product_variants_low_stock_idx')
      .on(t.stockQuantity)
      .where(sql`${t.isActive} AND ${t.stockQuantity} <= 10`),
  ],
);

/** Gallery per product, optionally pinned to a variant. */
export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => productVariants.id, {
      onDelete: 'set null',
    }),
    url: text('url').notNull(),
    alt: text('alt').notNull().default(''),
    position: integer('position').notNull().default(0),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('product_images_product_pos_idx').on(t.productId, t.position)],
);
