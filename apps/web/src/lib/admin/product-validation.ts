/**
 * Pure product validation helpers — NO @kakoa/db import, so they're unit-testable
 * in isolation and safe to use from Edge/route code. `validateAttributes` is the
 * generic, business-agnostic mechanism that keeps the catalog vertical-neutral.
 */
import type { AttributeDef, Capability } from '@platform/kernel';

/** Postgres uuid shape — guard before comparing against a uuid column (else 22P02). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: unknown): s is string {
  return typeof s === 'string' && UUID_RE.test(s);
}

/** Slugify a name → `^[a-z0-9-]+$` (matches the products/categories check constraints). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface VariantInput {
  sku: string;
  name: string;
  pricePaise: number;
  weightGrams: number;
  stockQuantity: number;
  isActive: boolean;
  isDefault?: boolean;
  /**
   * Tax class. Optional on the wire: when absent the data layer writes the
   * vertical preset's `taxDefaults` (create) or keeps the stored value (update).
   */
  gstRateBp?: number;
  hsnCode?: string;
}

const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,59}$/;
/** HSN is 4, 6 or 8 digits (India GST) — same shape the Taxes module accepts. */
const HSN_RE = /^[0-9]{4,8}$/;
/** `product_variants_gst_rate_check`: 0…2800 bp (0%…28%). */
const GST_RATE_MAX_BP = 2800;

/**
 * Validate + coerce a variant payload against the product_variants check
 * constraints (price>0, weight>0, stock>=0, sku unique+shaped). Pure — the
 * route/data layer maps the message. Returns clean fields on success.
 */
export function validateVariantInput(
  input: unknown,
):
  | { ok: true; value: VariantInput }
  | { ok: false; message: string } {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, message: 'Invalid variant payload.' };
  }
  const b = input as Record<string, unknown>;

  const sku = typeof b.sku === 'string' ? b.sku.trim() : '';
  if (!SKU_RE.test(sku)) {
    return { ok: false, message: 'SKU must be 2–60 chars: letters, numbers, dot, dash or underscore.' };
  }
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < 1 || name.length > 80) {
    return { ok: false, message: 'Enter a variant name (1–80 characters).' };
  }
  const pricePaise = Number(b.pricePaise);
  if (!Number.isInteger(pricePaise) || pricePaise <= 0 || pricePaise > 100_000_00) {
    return { ok: false, message: 'Enter a price greater than ₹0 (and under ₹1,00,000).' };
  }
  const weightGrams = Number(b.weightGrams);
  if (!Number.isInteger(weightGrams) || weightGrams <= 0 || weightGrams > 100_000) {
    return { ok: false, message: 'Enter a net weight in grams (1–100000).' };
  }
  const stockQuantity = Number(b.stockQuantity);
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1_000_000) {
    return { ok: false, message: 'Enter a stock quantity (0 or more).' };
  }
  // Tax class — optional; absent / blank means "use the default / keep current".
  let gstRateBp: number | undefined;
  if (b.gstRateBp !== undefined && b.gstRateBp !== null && b.gstRateBp !== '') {
    const n = Number(b.gstRateBp);
    if (!Number.isInteger(n) || n < 0 || n > GST_RATE_MAX_BP) {
      return { ok: false, message: 'GST rate must be between 0% and 28%.' };
    }
    gstRateBp = n;
  }
  let hsnCode: string | undefined;
  if (typeof b.hsnCode === 'string' && b.hsnCode.trim() !== '') {
    const s = b.hsnCode.trim();
    if (!HSN_RE.test(s)) {
      return { ok: false, message: 'HSN code must be 4, 6 or 8 digits.' };
    }
    hsnCode = s;
  }
  return {
    ok: true,
    value: {
      sku,
      name,
      pricePaise,
      weightGrams,
      stockQuantity,
      isActive: b.isActive !== false,
      isDefault: b.isDefault === true,
      ...(gstRateBp !== undefined ? { gstRateBp } : {}),
      ...(hsnCode !== undefined ? { hsnCode } : {}),
    },
  };
}

/** Storefront content columns editable in the admin (drive the PDP). */
export interface ProductContentInput {
  blurb: string;
  ingredients: string;
  allergens: string;
  nutritionFacts: Record<string, string> | null;
  shelfLifeDays: number | null;
  storageInstructions: string | null;
  isVeg: boolean;
  badge: string | null;
  tone: string;
}

export const PRODUCT_BADGES = ['Best seller', 'New', 'Limited', 'Vegan', 'Seasonal'] as const;

/** The placeholder swatch palette a tone must belong to (preset `presentation`). */
export interface TonePalette {
  /** Valid `products.tone` values (the preset's swatch keys). */
  readonly options: readonly string[];
  /** Stored when the body's tone is missing or unknown. */
  readonly fallback: string;
}

/**
 * Coerce/sanitize the PDP content fields from an untrusted body. Never throws —
 * every field is clamped to a safe default (empty / null), so a partial payload
 * is fine. The tone is validated against the vertical preset's swatch keys.
 * Pure + unit-testable.
 */
export function coerceProductContent(input: unknown, palette: TonePalette): ProductContentInput {
  const b = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
  const strOrNull = (v: unknown, max: number): string | null => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s === '' ? null : s.slice(0, max);
  };

  let nutritionFacts: Record<string, string> | null = null;
  if (b.nutritionFacts !== null && typeof b.nutritionFacts === 'object' && !Array.isArray(b.nutritionFacts)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(b.nutritionFacts as Record<string, unknown>).slice(0, 20)) {
      const key = k.trim().slice(0, 60);
      const val = (typeof v === 'string' ? v : String(v ?? '')).trim().slice(0, 60);
      if (key !== '' && val !== '') out[key] = val;
    }
    if (Object.keys(out).length > 0) nutritionFacts = out;
  }

  const shelf = Number(b.shelfLifeDays);
  const shelfLifeDays = Number.isInteger(shelf) && shelf > 0 && shelf <= 3650 ? shelf : null;

  const badgeRaw = typeof b.badge === 'string' ? b.badge.trim() : '';
  const badge = (PRODUCT_BADGES as readonly string[]).includes(badgeRaw) ? badgeRaw : null;

  const toneRaw = typeof b.tone === 'string' ? b.tone : '';
  const tone = palette.options.includes(toneRaw) ? toneRaw : palette.fallback;

  return {
    blurb: str(b.blurb, 300),
    ingredients: str(b.ingredients, 2000),
    allergens: str(b.allergens, 500),
    nutritionFacts,
    shelfLifeDays,
    storageInstructions: strOrNull(b.storageInstructions, 500),
    isVeg: b.isVeg !== false,
    badge,
    tone,
  };
}

/**
 * Sanitize/validate an attributes object against the vertical preset's schema.
 * Unknown keys are dropped; attributes gated on a disabled capability are
 * dropped; each value is coerced/validated per its declared type + options.
 * Pure — only ever writes trusted schema keys (no __proto__/constructor path).
 */
export function validateAttributes(
  schema: readonly AttributeDef[],
  capabilities: ReadonlySet<Capability>,
  input: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof input !== 'object' || input === null) return out;
  const src = input as Record<string, unknown>;
  for (const def of schema) {
    if (def.capability !== undefined && !capabilities.has(def.capability)) continue;
    const v = src[def.key];
    if (v === undefined || v === null || v === '') continue;
    switch (def.type) {
      case 'number': {
        const n = Number(v);
        if (Number.isFinite(n)) out[def.key] = n;
        break;
      }
      case 'boolean':
        out[def.key] = Boolean(v);
        break;
      case 'enum':
        if (typeof v === 'string' && (def.options ?? []).includes(v)) out[def.key] = v;
        break;
      case 'multi-enum':
        if (Array.isArray(v)) {
          out[def.key] = v.filter(
            (x): x is string => typeof x === 'string' && (def.options ?? []).includes(x),
          );
        }
        break;
      case 'text':
      case 'rich':
        if (typeof v === 'string') out[def.key] = v.slice(0, 5000);
        break;
    }
  }
  return out;
}
