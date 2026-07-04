/**
 * Admin Taxes (HANDOFF-Taxes.md) — the admin surface over the per-variant GST
 * rate data (`product_variants.gst_rate_bp` + `hsn_code`). It does NOT compute or
 * store CGST/SGST/IGST (that's `@kakoa/core/gst.ts`, used by quote/invoice) — it
 * only edits the RATE data. Rate changes are NOT retroactive (orders snapshot tax
 * at placement). Seller GST identity is read-only here (owned by Settings).
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  adminAuditLog,
  db,
  productVariants,
  products,
  storeSettings,
} from '@kakoa/db';
import { stateByCode } from '@kakoa/core';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import { withConstraintMapping } from './db-errors';
import { isUuid } from './product-validation';
import { validateTaxInput, validateRateBp } from './tax-validation';
import { SETTINGS_DEFAULTS } from './settings-schema';

export interface TaxGroup {
  hsnCode: string;
  gstRateBp: number;
  ratePct: number;
  variantCount: number;
  /** True when this HSN maps to more than one rate across the catalog. */
  inconsistent: boolean;
}

/**
 * Every (HSN, rate) combination in the catalog with its variant count. An HSN
 * that appears with more than one rate is flagged `inconsistent` (a single HSN
 * should carry one GST rate) so the UI can warn + offer a bulk fix.
 */
export async function listTaxGroups(): Promise<TaxGroup[]> {
  const rows = await db
    .select({
      hsnCode: productVariants.hsnCode,
      gstRateBp: productVariants.gstRateBp,
      variantCount: count(),
    })
    .from(productVariants)
    .groupBy(productVariants.hsnCode, productVariants.gstRateBp)
    .orderBy(asc(productVariants.hsnCode), asc(productVariants.gstRateBp));

  // Count distinct rates per HSN to flag inconsistency.
  const ratesPerHsn = new Map<string, number>();
  for (const r of rows) {
    ratesPerHsn.set(r.hsnCode, (ratesPerHsn.get(r.hsnCode) ?? 0) + 1);
  }

  return rows.map((r) => ({
    hsnCode: r.hsnCode,
    gstRateBp: Number(r.gstRateBp),
    ratePct: Number(r.gstRateBp) / 100,
    variantCount: Number(r.variantCount),
    inconsistent: (ratesPerHsn.get(r.hsnCode) ?? 0) > 1,
  }));
}

export interface TaxVariantRow {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  gstRateBp: number;
  ratePct: number;
  hsnCode: string;
  isActive: boolean;
}

/** Variants under an HSN — for the drill-down / per-variant edit. */
export async function listVariantsForHsn(hsnCode: string): Promise<TaxVariantRow[]> {
  const rows = await db
    .select({
      variantId: productVariants.id,
      productName: products.name,
      variantName: productVariants.name,
      sku: productVariants.sku,
      gstRateBp: productVariants.gstRateBp,
      hsnCode: productVariants.hsnCode,
      isActive: productVariants.isActive,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.hsnCode, hsnCode))
    .orderBy(asc(products.name), asc(productVariants.name));

  return rows.map((r) => ({
    variantId: r.variantId,
    productName: r.productName,
    variantName: r.variantName,
    sku: r.sku,
    gstRateBp: Number(r.gstRateBp),
    ratePct: Number(r.gstRateBp) / 100,
    hsnCode: r.hsnCode,
    isActive: r.isActive,
  }));
}

export interface SellerTaxIdentity {
  gstin: string;
  stateCode: string;
  stateName: string | null;
  legalName: string;
}

/** Seller GST identity from `store_settings` (read-only; edited in Settings). */
export async function getSellerTaxIdentity(): Promise<SellerTaxIdentity> {
  const keys = ['seller_gstin', 'seller_state_code', 'seller_legal_name'];
  const rows = await db
    .select({ key: storeSettings.key, value: storeSettings.value })
    .from(storeSettings)
    .where(inArray(storeSettings.key, keys));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const str = (key: string): string => {
    const v = byKey.has(key) ? byKey.get(key) : SETTINGS_DEFAULTS[key];
    return typeof v === 'string' ? v : String(v ?? '');
  };

  const stateCode = str('seller_state_code');
  return {
    gstin: str('seller_gstin'),
    stateCode,
    stateName: stateByCode(stateCode)?.name ?? null,
    legalName: str('seller_legal_name'),
  };
}

export type TaxUpdateResult =
  | { ok: true; gstRateBp: number; hsnCode: string }
  | { ok: false; code: 'NOT_FOUND' | 'VALIDATION_ERROR'; message: string };

/**
 * Update one variant's GST rate + HSN. Validated (0…2800 bp, HSN `^[0-9]{4,8}$`)
 * before the DB; the `gst_rate_bp` CHECK is the race-safe backstop via
 * `withConstraintMapping`. Audited in-tx. NOT retroactive.
 */
export async function updateVariantTax(
  variantId: string,
  input: unknown,
  adminUserId: string,
): Promise<TaxUpdateResult> {
  if (!isUuid(variantId)) {
    return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that variant." };
  }
  const validated = validateTaxInput(input);
  if (!validated.ok) {
    return { ok: false, code: 'VALIDATION_ERROR', message: validated.message };
  }
  const { gstRateBp, hsnCode } = validated.value;

  return withConstraintMapping(() =>
    db.transaction(async (tx): Promise<TaxUpdateResult> => {
      const [current] = await tx
        .select({
          id: productVariants.id,
          gstRateBp: productVariants.gstRateBp,
          hsnCode: productVariants.hsnCode,
        })
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .for('update')
        .limit(1);
      if (!current) {
        return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that variant." };
      }

      await tx
        .update(productVariants)
        .set({ gstRateBp, hsnCode, updatedAt: sql`now()` })
        .where(eq(productVariants.id, variantId));
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'tax.update',
        entityType: 'variant',
        entityId: variantId,
        before: { gstRateBp: Number(current.gstRateBp), hsnCode: current.hsnCode },
        after: { gstRateBp, hsnCode },
      });
      return { ok: true, gstRateBp, hsnCode };
    }),
  );
}

export type BulkTaxResult =
  | { ok: true; affected: number; gstRateBp: number; hsnCode: string }
  | { ok: false; code: 'VALIDATION_ERROR'; message: string };

/**
 * Set `gst_rate_bp` for ALL variants of an HSN in one tx (fixes an inconsistent
 * HSN group in a click). A zero-variant HSN is a clean no-op. Audited in-tx.
 */
export async function bulkSetHsnRate(
  hsnCode: string,
  gstRateBpRaw: unknown,
  adminUserId: string,
): Promise<BulkTaxResult> {
  const hsn = typeof hsnCode === 'string' ? hsnCode.trim() : '';
  if (!/^[0-9]{4,8}$/.test(hsn)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'HSN code must be 4, 6 or 8 digits.' };
  }
  const gstRateBp = validateRateBp(gstRateBpRaw);
  if (gstRateBp === null) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'GST rate must be between 0% and 28%.' };
  }

  return withConstraintMapping(() =>
    db.transaction(async (tx): Promise<BulkTaxResult> => {
      const updated = await tx
        .update(productVariants)
        .set({ gstRateBp, updatedAt: sql`now()` })
        .where(eq(productVariants.hsnCode, hsn))
        .returning({ id: productVariants.id });
      const affected = updated.length;

      // Audit even a no-op (0 affected) so the action is always traceable.
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'tax.bulk_update',
        entityType: 'variant',
        entityId: null,
        before: null,
        after: { hsnCode: hsn, gstRateBp, affected },
      });
      return { ok: true, affected, gstRateBp, hsnCode: hsn };
    }),
  );
}
