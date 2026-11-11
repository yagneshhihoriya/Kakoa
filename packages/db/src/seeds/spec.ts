/**
 * The shape of a brand seed — pure data a brand module (kakoa.ts, khakhra.ts)
 * exports and the writer (platform.ts) inserts. Nothing here touches the
 * database, so a spec can be unit-tested without a DATABASE_URL.
 */
import { BRAND_KEYS, isBrandKey, type BrandKey, type BrandProfile } from '@kakoa/brands';
import type { coupons } from '../schema/index';
import { legalIdentityRows } from './legal-identity';

export interface CategorySeed {
  slug: string;
  name: string;
  description: string;
  /** Collection tile image; omitted → the preset swatch fallback. */
  imageUrl?: string;
}

export interface VariantSeed {
  sku: string;
  name: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  /** Per-variant GST override (basis points); omitted → the preset's `taxDefaults.rateBp`. */
  gstRateBp?: number;
  weightGrams: number;
  shipWeightGrams: number;
  lengthCm?: string;
  breadthCm?: string;
  heightCm?: string;
  stock: number;
  isDefault: boolean;
  position: number;
}

export interface ProductImageSeed {
  url: string;
  alt: string;
}

export interface ProductSeed {
  slug: string;
  name: string;
  /** Slug of one of the spec's categories. */
  category: string;
  blurb: string;
  description: string;
  /** Preset attributes (docs/admin-platform §2.4) — written to products.attributes as-is. */
  attributes: Readonly<Record<string, unknown>>;
  ingredients: string;
  allergens: string;
  nutritionFacts: unknown;
  shelfLifeDays: number;
  storageInstructions: string;
  isVeg: boolean;
  badge?: string;
  /** A swatch key of the brand's resolved preset (`presentation.swatches`). */
  tone: string;
  /** Gallery rows (product_images); omitted → the tone-study placeholder. */
  images?: readonly ProductImageSeed[];
  variants: readonly VariantSeed[];
}

/** A coupon row minus `createdBy` (the writer stamps the owner admin). */
export type CouponSeed = Omit<typeof coupons.$inferInsert, 'createdBy'>;

export interface SeedOwner {
  email: string;
  name: string;
}

export interface BrandSeedSpec {
  profile: BrandProfile;
  owner: SeedOwner;
  categories: readonly CategorySeed[];
  products: readonly ProductSeed[];
  coupons: readonly CouponSeed[];
  /** `inventory_adjustments.note` on every initial_stock ledger row. */
  ledgerNote: string;
}

/**
 * The policy / fee / support rows every brand seed writes from its profile
 * `defaults` (Contract §1.1). Together with the six legal-identity keys this
 * is the 15-key set the storefront and admin were built against.
 */
export const POLICY_KEYS = [
  'shipping_fee_standard_paise',
  'shipping_fee_express_paise',
  'free_shipping_threshold_paise',
  'cod_fee_paise',
  'cod_enabled',
  'gift_wrap_fee_paise',
  'payment_expiry_minutes',
  'support_phone',
  'support_email',
] as const satisfies readonly (keyof BrandProfile['defaults'])[];

/**
 * The store_settings rows for a brand: the legal identity (seed-only block of
 * the profile — the runtime has no fallback for those keys) plus the policy
 * keys above, sourced from the profile so the seed and the admin catalog can
 * never disagree.
 */
export function storeSettingsRows(
  profile: BrandProfile,
): Record<string, string | number | boolean> {
  return {
    ...legalIdentityRows(profile),
    ...Object.fromEntries(POLICY_KEYS.map((key) => [key, profile.defaults[key]])),
  };
}

/**
 * The owner admin the seed creates: `SEED_OWNER_EMAIL` when set (any brand),
 * else the brand module's fallback. Passwordless (email OTP) — no credential.
 */
export function resolveOwner(
  env: Readonly<Record<string, string | undefined>>,
  fallback: SeedOwner,
): SeedOwner {
  const email = env.SEED_OWNER_EMAIL?.trim();
  return email !== undefined && email !== '' ? { email, name: fallback.name } : fallback;
}

/** `--brand <key>` from argv, else BRAND_KEY; a readable error names the keys. */
export function resolveSeedBrand(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): BrandKey {
  const flag = argv.indexOf('--brand');
  const raw = flag === -1 ? env.BRAND_KEY : argv[flag + 1];
  if (isBrandKey(raw)) return raw;
  throw new Error(
    `Seed needs a brand: pass --brand <key> or set BRAND_KEY (one of ${BRAND_KEYS.join(', ')}; got ${
      raw === undefined || raw === '' ? 'nothing' : JSON.stringify(raw)
    })`,
  );
}
