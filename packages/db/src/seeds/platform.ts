/**
 * Brand-agnostic seed writer. A brand module exports a `BrandSeedSpec` (pure
 * data); `seedBrand` turns it into rows in the order the contract expects:
 * owner admin → system roles → store_settings → categories → products /
 * variants / images / initial_stock ledger → coupons.
 *
 * Idempotent: exits early when store_settings is already populated.
 */
import { randomUUID } from 'node:crypto';
import { resolvePreset } from '@platform/kernel';
import type { Db } from '../client';
import { seedSystemRoles } from '../seed-roles';
import {
  adminUsers,
  categories,
  coupons,
  inventoryAdjustments,
  productImages,
  productVariants,
  products,
  storeSettings,
} from '../schema/index';
import { storeSettingsRows, type BrandSeedSpec } from './spec';

export interface SeedSummary {
  skipped: boolean;
  settings: number;
  categories: number;
  products: number;
  variants: number;
  images: number;
  coupons: number;
}

const SKIPPED: SeedSummary = {
  skipped: true,
  settings: 0,
  categories: 0,
  products: 0,
  variants: 0,
  images: 0,
  coupons: 0,
};

export async function seedBrand(database: Db, spec: BrandSeedSpec): Promise<SeedSummary> {
  const alreadySeeded = await database
    .select({ key: storeSettings.key })
    .from(storeSettings)
    .limit(1);
  if (alreadySeeded.length > 0) return SKIPPED;

  // The tax class (gst_rate_bp / hsn_code) is the brand's vertical preset
  // `taxDefaults`, written explicitly — the columns have no database default.
  const preset = resolvePreset(spec.profile);
  const tax = preset.taxDefaults;
  if (tax.code === undefined) {
    throw new Error(`The ${preset.key} preset has no HSN code; the seed cannot write variants.`);
  }
  const hsnCode: string = tax.code;

  // 1. Owner admin — passwordless (email OTP), no credentials to seed.
  const ownerId = randomUUID();
  await database.insert(adminUsers).values({
    id: ownerId,
    email: spec.owner.email,
    name: spec.owner.name,
    role: 'owner',
  });

  // 1b. System roles (permission-based RBAC) + link the owner admin's role_id.
  await seedSystemRoles(database);

  // 2. store_settings (Contract §1.1).
  const settings = storeSettingsRows(spec.profile);
  await database.insert(storeSettings).values(
    Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      updatedBy: ownerId,
    })),
  );

  // 3. Categories (Contract §1.2).
  const categoryIds = new Map<string, string>();
  await database.insert(categories).values(
    spec.categories.map((c, i) => {
      const id = randomUUID();
      categoryIds.set(c.slug, id);
      return {
        id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl ?? null,
        position: i,
      };
    }),
  );

  // 4. Products + variants + gallery + initial_stock ledger rows.
  let productCount = 0;
  let variantCount = 0;
  let imageCount = 0;
  for (const p of spec.products) {
    const categoryId = categoryIds.get(p.category);
    if (!categoryId) throw new Error(`Unknown category slug: ${p.category}`);

    const productId = randomUUID();
    await database.insert(products).values({
      id: productId,
      slug: p.slug,
      name: p.name,
      categoryId,
      blurb: p.blurb,
      description: p.description,
      attributes: p.attributes,
      ingredients: p.ingredients,
      allergens: p.allergens,
      nutritionFacts: p.nutritionFacts,
      shelfLifeDays: p.shelfLifeDays,
      storageInstructions: p.storageInstructions,
      isVeg: p.isVeg,
      badge: p.badge ?? null,
      tone: p.tone,
    });
    productCount += 1;

    for (const v of p.variants) {
      const variantId = randomUUID();
      await database.insert(productVariants).values({
        id: variantId,
        productId,
        sku: v.sku,
        name: v.name,
        pricePaise: v.pricePaise,
        compareAtPricePaise: v.compareAtPricePaise ?? null,
        gstRateBp: v.gstRateBp ?? tax.rateBp,
        hsnCode,
        weightGrams: v.weightGrams,
        shipWeightGrams: v.shipWeightGrams,
        lengthCm: v.lengthCm ?? null,
        breadthCm: v.breadthCm ?? null,
        heightCm: v.heightCm ?? null,
        stockQuantity: v.stock,
        position: v.position,
        isDefault: v.isDefault,
      });
      variantCount += 1;

      // Ledger convention (§1.22): every stock change writes a ledger row.
      await database.insert(inventoryAdjustments).values({
        variantId,
        delta: v.stock,
        reason: 'initial_stock',
        adminUserId: ownerId,
        note: spec.ledgerNote,
        stockAfter: v.stock,
      });
    }

    // A product without seeded photos renders the tone-study placeholder until
    // real images are uploaded via the Media Library (admin → Products → Images).
    if (p.images !== undefined && p.images.length > 0) {
      await database.insert(productImages).values(
        p.images.map((image, position) => ({
          productId,
          url: image.url,
          alt: image.alt,
          position,
        })),
      );
      imageCount += p.images.length;
    }
  }

  // 5. Coupons (stamped with the owner admin).
  if (spec.coupons.length > 0) {
    await database
      .insert(coupons)
      .values(spec.coupons.map((coupon) => ({ ...coupon, createdBy: ownerId })));
  }

  return {
    skipped: false,
    settings: Object.keys(settings).length,
    categories: spec.categories.length,
    products: productCount,
    variants: variantCount,
    images: imageCount,
    coupons: spec.coupons.length,
  };
}
