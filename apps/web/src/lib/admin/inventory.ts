/**
 * Admin inventory (admin-catalog-inventory.md, Phase 1). A read view over stock
 * plus AUDITABLE manual adjustments. `product_variants.stock_quantity` is the
 * authoritative counter; every manual change writes an `inventory_adjustments`
 * ledger row (reason ∈ the manual set) IN THE SAME TX, so the on-hand number and
 * its history never diverge — mirroring how checkout/cancel already write the
 * ledger for order-caused moves. Business-agnostic (SKU + counts, no chocolate).
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  adminAuditLog,
  adminUsers,
  db,
  inventoryAdjustments,
  productVariants,
  products,
} from '@kakoa/db';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { revalidateCatalog } from '@/lib/catalog/queries';
import { withConstraintMapping } from './db-errors';
import { isUuid } from './product-validation';

export const INVENTORY_PAGE_SIZE = 30;

/** Reasons an ADMIN may cite; order-caused reasons are written only by the order flows. */
export const MANUAL_REASONS = ['manual_adjustment', 'stock_correction', 'damage_writeoff'] as const;
export type ManualReason = (typeof MANUAL_REASONS)[number];

export const REASON_LABEL: Record<string, string> = {
  initial_stock: 'Initial stock',
  order_placed: 'Order placed',
  order_cancelled: 'Order cancelled',
  payment_expired: 'Payment expired',
  rto_restock: 'RTO restock',
  return_restock: 'Return restock',
  manual_adjustment: 'Manual adjustment',
  stock_correction: 'Stock correction',
  damage_writeoff: 'Damage / write-off',
};

function likeParam(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export interface InventoryRow {
  variantId: string;
  sku: string;
  productId: string;
  productName: string;
  variantName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  productActive: boolean;
  low: boolean;
  out: boolean;
}

export interface InventoryList {
  rows: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listInventory(input: {
  search?: string;
  filter?: 'all' | 'low' | 'out';
  page?: number;
}): Promise<InventoryList> {
  const page = Math.min(1_000_000, Math.max(1, Math.floor(Number(input.page ?? 1)) || 1));
  const pageSize = INVENTORY_PAGE_SIZE;

  const conds: SQL[] = [];
  if (input.filter === 'out') conds.push(sql`${productVariants.stockQuantity} = 0`);
  if (input.filter === 'low') {
    conds.push(sql`${productVariants.stockQuantity} <= ${productVariants.lowStockThreshold}`);
  }
  const search = input.search?.trim();
  if (search) {
    const p = likeParam(search);
    conds.push(sql`(${products.name} ilike ${p} or ${productVariants.sku} ilike ${p})`);
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      productId: products.id,
      productName: products.name,
      variantName: productVariants.name,
      stockQuantity: productVariants.stockQuantity,
      lowStockThreshold: productVariants.lowStockThreshold,
      isActive: productVariants.isActive,
      productActive: products.isActive,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(where)
    // Most-urgent first: lowest on-hand, then by product.
    .orderBy(asc(productVariants.stockQuantity), asc(products.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      ...r,
      stockQuantity: Number(r.stockQuantity),
      lowStockThreshold: Number(r.lowStockThreshold),
      low: Number(r.stockQuantity) <= Number(r.lowStockThreshold),
      out: Number(r.stockQuantity) === 0,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type AdjustResult =
  | { ok: true; stockAfter: number; delta: number }
  | { ok: false; code: 'NOT_FOUND' | 'VALIDATION_ERROR'; message: string };

/**
 * Set a variant's on-hand to `newQuantity`. The delta is computed UNDER the row
 * lock (race-safe), a ledger row records it with the cited manual reason, and an
 * audit row is written — all in one tx. No-op (same quantity) is rejected.
 */
export async function adjustStock(
  input: { variantId: string; newQuantity: number; reason: string; note?: string },
  adminUserId: string,
): Promise<AdjustResult> {
  if (!isUuid(input.variantId)) {
    return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that variant." };
  }
  if (!(MANUAL_REASONS as readonly string[]).includes(input.reason)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Choose a valid adjustment reason.' };
  }
  const newQuantity = Number(input.newQuantity);
  if (!Number.isInteger(newQuantity) || newQuantity < 0 || newQuantity > 10_000_000) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a new quantity (0 or more).' };
  }
  const note = input.note?.trim().slice(0, 500) || null;

  const result = await withConstraintMapping<AdjustResult>(() =>
    db.transaction(async (tx): Promise<AdjustResult> => {
      const [current] = await tx
        .select({ id: productVariants.id, stock: productVariants.stockQuantity })
        .from(productVariants)
        .where(eq(productVariants.id, input.variantId))
        .for('update')
        .limit(1);
      if (!current) return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that variant." };

      const delta = newQuantity - Number(current.stock);
      if (delta === 0) {
        return { ok: false, code: 'VALIDATION_ERROR', message: `Stock is already ${newQuantity}.` };
      }

      await tx
        .update(productVariants)
        .set({ stockQuantity: newQuantity, updatedAt: sql`now()` })
        .where(eq(productVariants.id, input.variantId));
      await tx.insert(inventoryAdjustments).values({
        variantId: input.variantId,
        delta,
        reason: input.reason as ManualReason,
        orderId: null,
        adminUserId,
        note,
        stockAfter: newQuantity,
      });
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'inventory.adjust',
        entityType: 'variant',
        entityId: input.variantId,
        before: { stock: Number(current.stock) },
        after: { stock: newQuantity, delta, reason: input.reason },
      });
      return { ok: true, stockAfter: newQuantity, delta };
    }),
  );
  // Stock change flips PLP "sold out" badges + cached PDP availability metadata.
  if (result.ok) await revalidateCatalog();
  return result;
}

export interface LedgerRow {
  id: string;
  delta: number;
  reason: string;
  reasonLabel: string;
  note: string | null;
  stockAfter: number;
  orderId: string | null;
  adminEmail: string | null;
  createdAt: string;
}

/** Recent ledger rows for a variant (newest first) — the audit trail. */
export async function getVariantLedger(variantId: string, limit = 12): Promise<LedgerRow[]> {
  if (!isUuid(variantId)) return [];
  const rows = await db
    .select({
      id: inventoryAdjustments.id,
      delta: inventoryAdjustments.delta,
      reason: inventoryAdjustments.reason,
      note: inventoryAdjustments.note,
      stockAfter: inventoryAdjustments.stockAfter,
      orderId: inventoryAdjustments.orderId,
      adminEmail: adminUsers.email,
      createdAt: inventoryAdjustments.createdAt,
    })
    .from(inventoryAdjustments)
    .leftJoin(adminUsers, eq(adminUsers.id, inventoryAdjustments.adminUserId))
    .where(eq(inventoryAdjustments.variantId, variantId))
    .orderBy(desc(inventoryAdjustments.createdAt))
    .limit(Math.min(50, Math.max(1, limit)));
  return rows.map((r) => ({
    id: r.id,
    delta: Number(r.delta),
    reason: r.reason,
    reasonLabel: REASON_LABEL[r.reason] ?? r.reason,
    note: r.note,
    stockAfter: Number(r.stockAfter),
    orderId: r.orderId,
    adminEmail: r.adminEmail,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}
