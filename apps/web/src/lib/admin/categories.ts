/**
 * Admin categories (admin-catalog-inventory.md, Phase 1). The category taxonomy
 * is DATA (a table), so admins add/rename/reorder/archive without a migration —
 * generic across every vertical. Mutations `revalidateTag('categories')` so the
 * cached storefront reflects changes. Audited in-tx.
 *
 * SERVER-ONLY: uses @kakoa/db + next/cache.
 */
import { adminAuditLog, categories, db, products } from '@kakoa/db';
import { asc, eq, sql } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { withConstraintMapping } from './db-errors';

export interface AdminCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  active: boolean;
  productCount: number;
}

export type CategoryResult =
  | { ok: true; id: string }
  | { ok: false; code: 'VALIDATION_ERROR' | 'CONFLICT' | 'NOT_FOUND'; message: string };

/** Slugify a name → `^[a-z0-9-]+$` (matches the DB check constraint). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function listCategories(): Promise<AdminCategoryRow[]> {
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      position: categories.position,
      active: categories.isActive,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.position), asc(categories.name));
  return rows.map((r) => ({ ...r, productCount: Number(r.productCount) }));
}

export async function createCategory(
  input: { name: string; description?: string },
  adminUserId: string,
): Promise<CategoryResult> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a category name (2–60 characters).' };
  }
  const base = slugify(name);
  if (base === '') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Category name must contain letters or numbers.' };
  }
  // Race-safe backstop: a concurrent same-name create that slips past the slug
  // SELECT becomes a clean VALIDATION_ERROR rather than a unique(slug) 500.
  return withConstraintMapping(() =>
    db.transaction(async (tx) => {
    // Unique slug: append -2, -3, … if taken.
    let slug = base;
    for (let n = 2; ; n += 1) {
      const [exists] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
      if (!exists) break;
      slug = `${base}-${n}`;
    }
    const [maxRow] = await tx
      .select({ maxPos: sql<number>`coalesce(max(${categories.position}), 0)::int` })
      .from(categories);
    const [row] = await tx
      .insert(categories)
      .values({
        slug,
        name,
        description: input.description?.slice(0, 500) ?? null,
        position: Number(maxRow?.maxPos ?? 0) + 1,
      })
      .returning({ id: categories.id });
    if (!row) return { ok: false, code: 'VALIDATION_ERROR', message: 'Could not create the category.' };
    await tx.insert(adminAuditLog).values({
      adminUserId,
      action: 'category.create',
      entityType: 'category',
      entityId: row.id,
      before: null,
      after: { slug, name },
    });
    revalidateTag('categories', 'max');
    return { ok: true, id: row.id };
    }),
  );
}

export async function updateCategory(
  id: string,
  input: { name: string; description?: string; position?: number; active?: boolean },
  adminUserId: string,
): Promise<CategoryResult> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a category name (2–60 characters).' };
  }
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: categories.id, name: categories.name, isActive: categories.isActive })
      .from(categories)
      .where(eq(categories.id, id))
      .for('update')
      .limit(1);
    if (!current) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that category." };

    const position =
      typeof input.position === 'number' && Number.isFinite(input.position)
        ? Math.max(0, Math.floor(input.position))
        : undefined;
    await tx
      .update(categories)
      .set({
        name,
        description: input.description?.slice(0, 500) ?? null,
        ...(position !== undefined ? { position } : {}),
        ...(typeof input.active === 'boolean' ? { isActive: input.active } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(categories.id, id));
    await tx.insert(adminAuditLog).values({
      adminUserId,
      action: 'category.update',
      entityType: 'category',
      entityId: id,
      before: { name: current.name, isActive: current.isActive },
      after: { name, isActive: input.active ?? current.isActive },
    });
    revalidateTag('categories', 'max');
    return { ok: true, id };
  });
}
