/**
 * Admin products read/write layer (admin-catalog-inventory.md, Phase 1).
 * Business-agnostic: the vertical preset's `attributeSchema` drives which
 * attributes exist; `validateAttributes` sanitizes input against it and stores
 * the result in the generic `products.attributes` jsonb. No chocolate specifics.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  adminAuditLog,
  categories,
  db,
  productImages,
  products,
  productVariants,
} from '@kakoa/db';
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import { isUuid, validateAttributes } from './product-validation';

// Re-exported so existing importers (routes) keep a single products entrypoint.
export { isUuid, validateAttributes } from './product-validation';

export const PRODUCT_PAGE_SIZE = 20;

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  categoryName: string | null;
  active: boolean;
  variantCount: number;
  fromPricePaise: number;
  totalStock: number;
}

export interface AdminProductList {
  rows: AdminProductRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function likeParam(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listProducts(input: {
  search?: string;
  categoryId?: string;
  status?: 'active' | 'inactive';
  page?: number;
}): Promise<AdminProductList> {
  const page = Math.min(1_000_000, Math.max(1, Math.floor(Number(input.page ?? 1)) || 1));
  const pageSize = PRODUCT_PAGE_SIZE;

  const conds: SQL[] = [];
  // Only apply a well-formed uuid filter; a malformed value is ignored, never
  // passed to the uuid column (which would raise 22P02 → unhandled 500).
  if (isUuid(input.categoryId)) conds.push(eq(products.categoryId, input.categoryId));
  if (input.status === 'active') conds.push(eq(products.isActive, true));
  if (input.status === 'inactive') conds.push(eq(products.isActive, false));
  const search = input.search?.trim();
  if (search) {
    const p = likeParam(search);
    conds.push(sql`(${products.name} ilike ${p} or ${products.slug} ilike ${p})`);
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      active: products.isActive,
      categoryName: categories.name,
      variantCount: sql<number>`count(${productVariants.id})::int`,
      fromPricePaise: sql<number>`coalesce(min(${productVariants.pricePaise}), 0)::int`,
      totalStock: sql<number>`coalesce(sum(${productVariants.stockQuantity}), 0)::int`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(
      productVariants,
      and(eq(productVariants.productId, products.id), eq(productVariants.isActive, true)),
    )
    .where(where)
    .groupBy(products.id, categories.name)
    .orderBy(asc(products.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      categoryName: r.categoryName,
      active: r.active,
      variantCount: Number(r.variantCount),
      fromPricePaise: Number(r.fromPricePaise),
      totalStock: Number(r.totalStock),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface AdminProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  active: boolean;
  attributes: Record<string, unknown>;
  updatedAt: string;
  variants: {
    id: string;
    sku: string;
    name: string;
    pricePaise: number;
    weightGrams: number;
    stockQuantity: number;
    isDefault: boolean;
    isActive: boolean;
  }[];
  images: { url: string; alt: string }[];
}

export async function getProductForEdit(
  id: string,
): Promise<AdminProductDetail | null> {
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!p) return null;

  const variants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      name: productVariants.name,
      pricePaise: productVariants.pricePaise,
      weightGrams: productVariants.weightGrams,
      stockQuantity: productVariants.stockQuantity,
      isDefault: productVariants.isDefault,
      isActive: productVariants.isActive,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .orderBy(asc(productVariants.position));

  const images = await db
    .select({ url: productImages.url, alt: productImages.alt })
    .from(productImages)
    .where(eq(productImages.productId, id))
    .orderBy(asc(productImages.position));

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    categoryId: p.categoryId,
    active: p.isActive,
    attributes: (p.attributes as Record<string, unknown>) ?? {},
    updatedAt: new Date(p.updatedAt).toISOString(),
    variants,
    images,
  };
}

export async function listCategoriesForSelect(): Promise<
  { id: string; name: string }[]
> {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.position), asc(categories.name));
}

export type ProductUpdateResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION_ERROR' | 'INVALID_TRANSITION'; message: string };

/**
 * Update a product's core fields + validated attributes. Optimistic concurrency
 * via `updatedAt` (stale write → CONFLICT). Audited in-tx.
 */
export async function updateProduct(
  id: string,
  patch: {
    name: string;
    description: string;
    categoryId: string;
    attributes: Record<string, unknown>;
    expectedUpdatedAt: string;
  },
  adminUserId: string,
): Promise<ProductUpdateResult> {
  const name = patch.name.trim();
  if (name.length < 2 || name.length > 120) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a product name (2–120 characters).' };
  }
  // Reject a malformed category id before it reaches the uuid column (22P02).
  if (!isUuid(patch.categoryId)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Select a valid category.' };
  }
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: products.id,
        name: products.name,
        categoryId: products.categoryId,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(eq(products.id, id))
      .for('update')
      .limit(1);
    if (!current) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that product." };
    if (new Date(current.updatedAt).toISOString() !== patch.expectedUpdatedAt) {
      return { ok: false, code: 'CONFLICT', message: 'This product changed since you opened it. Reload and try again.' };
    }
    // Authoritative gate: the category must exist AND be active. Prevents the FK
    // violation (23503) surfacing as a 500 and blocks silent reassignment to a
    // category hidden from the UI. (Allow keeping an already-inactive category
    // unchanged so an edit doesn't force a re-categorize.)
    if (patch.categoryId !== current.categoryId) {
      const [cat] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, patch.categoryId), eq(categories.isActive, true)))
        .limit(1);
      if (!cat) {
        return { ok: false, code: 'VALIDATION_ERROR', message: 'Select an active category.' };
      }
    }
    await tx
      .update(products)
      .set({
        name,
        description: patch.description.slice(0, 5000),
        categoryId: patch.categoryId,
        attributes: patch.attributes,
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, id));
    await tx.insert(adminAuditLog).values({
      adminUserId,
      action: 'product.update',
      entityType: 'product',
      entityId: id,
      before: { name: current.name, categoryId: current.categoryId },
      after: { name, categoryId: patch.categoryId },
    });
    return { ok: true };
  });
}

/**
 * Publish / unpublish a product (isActive). Publishing gates on ≥1 active
 * variant with a positive price + weight (admin-catalog-inventory.md publish
 * gate). Audited in-tx.
 */
export async function setProductActive(
  id: string,
  active: boolean,
  adminUserId: string,
): Promise<ProductUpdateResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: products.id, isActive: products.isActive })
      .from(products)
      .where(eq(products.id, id))
      .for('update')
      .limit(1);
    if (!current) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that product." };

    if (active) {
      const [ok] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, id),
            eq(productVariants.isActive, true),
            sql`${productVariants.pricePaise} > 0`,
            sql`${productVariants.weightGrams} > 0`,
          ),
        );
      if (Number(ok?.n ?? 0) === 0) {
        return {
          ok: false,
          code: 'INVALID_TRANSITION',
          message: 'Add at least one active variant with a price and weight before publishing.',
        };
      }
    }

    await tx
      .update(products)
      .set({ isActive: active, updatedAt: sql`now()` })
      .where(eq(products.id, id));
    await tx.insert(adminAuditLog).values({
      adminUserId,
      action: active ? 'product.publish' : 'product.unpublish',
      entityType: 'product',
      entityId: id,
      before: { isActive: current.isActive },
      after: { isActive: active },
    });
    return { ok: true };
  });
}
