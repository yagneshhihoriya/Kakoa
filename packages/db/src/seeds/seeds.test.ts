import { describe, expect, it } from 'vitest';
import { KAKOA, KHAKHRA, LEGAL_IDENTITY_KEYS } from '@kakoa/brands';
import { resolvePreset, type AttributeDef } from '@platform/kernel';
import { kakoaSeed } from './kakoa';
import { FLAVOURED_GST_RATE_BP, khakhraSeed } from './khakhra';
import {
  POLICY_KEYS,
  resolveOwner,
  resolveSeedBrand,
  storeSettingsRows,
  type BrandSeedSpec,
} from './spec';

const NO_ENV: Readonly<Record<string, string | undefined>> = {};
const SPECS: readonly BrandSeedSpec[] = [kakoaSeed(NO_ENV), khakhraSeed(NO_ENV)];

/**
 * Every catalogue row the seed writes, as text — minus the profile (tested in
 * @kakoa/brands) and the owner (the shared company mailbox).
 */
function seedText(spec: BrandSeedSpec): string {
  const { profile: _profile, owner: _owner, ...rows } = spec;
  return JSON.stringify(rows);
}

describe('every brand seed spec', () => {
  it.each(SPECS.map((s) => [s.profile.key, s] as const))(
    '%s — categories, SKUs, defaults and tones are internally consistent',
    (_key, spec) => {
      const categorySlugs = spec.categories.map((c) => c.slug);
      expect(new Set(categorySlugs).size).toBe(categorySlugs.length);

      const skus = spec.products.flatMap((p) => p.variants.map((v) => v.sku));
      expect(new Set(skus).size).toBe(skus.length);
      for (const sku of skus) expect(sku.startsWith(`${spec.profile.identifierPrefix}-`)).toBe(true);

      for (const product of spec.products) {
        expect(categorySlugs).toContain(product.category);
        expect(product.variants.filter((v) => v.isDefault)).toHaveLength(1);
        expect(product.variants.map((v) => v.position)).toEqual(
          product.variants.map((_v, i) => i),
        );
        expect(product.shelfLifeDays).toBeGreaterThan(0);
        for (const variant of product.variants) {
          expect(Number.isInteger(variant.pricePaise) && variant.pricePaise > 0).toBe(true);
          if (variant.compareAtPricePaise !== undefined) {
            expect(variant.compareAtPricePaise).toBeGreaterThan(variant.pricePaise);
          }
          expect(variant.weightGrams).toBeGreaterThan(0);
          expect(variant.shipWeightGrams).toBeGreaterThanOrEqual(variant.weightGrams);
        }
      }
    },
  );

  it('writes the 15-key store_settings set: six legal-identity rows + nine policy rows', () => {
    for (const spec of SPECS) {
      const rows = storeSettingsRows(spec.profile);
      expect(Object.keys(rows).sort()).toEqual([...LEGAL_IDENTITY_KEYS, ...POLICY_KEYS].sort());
      expect(rows.seller_gstin).toMatch(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/);
    }
  });

  it('both brands seed the SAME legal entity and support desk (one company, two trade names)', () => {
    const [kakoa, khakhra] = SPECS.map((s) => storeSettingsRows(s.profile));
    for (const key of [...LEGAL_IDENTITY_KEYS, 'support_phone', 'support_email']) {
      expect(khakhra?.[key]).toBe(kakoa?.[key]);
    }
    // The fixture object itself is shared — never a second literal.
    expect(KHAKHRA.seedLegalIdentity).toBe(KAKOA.seedLegalIdentity);
  });
});

describe('kakoa seed (the pre-split content, verbatim)', () => {
  const spec = kakoaSeed(NO_ENV);

  it('keeps the Phase 0 counts, owner, coupons and ledger note', () => {
    expect(spec.profile).toBe(KAKOA);
    expect(spec.owner).toEqual({ email: 'owner@kakoa.in', name: 'Kakao Owner' });
    expect(spec.categories.map((c) => c.slug)).toEqual(['bars', 'pralines', 'signature', 'gifts']);
    expect(spec.products).toHaveLength(10);
    expect(spec.products.flatMap((p) => p.variants)).toHaveLength(12);
    expect(spec.coupons.map((c) => c.code)).toEqual(['WELCOME10', 'FREESHIP', 'KAKAO50']);
    expect(spec.ledgerNote).toBe('Phase 0 seed');
    // Tasting notes became the comma-joined `tasting_notes` attribute (migration 0006).
    expect(spec.products[0]?.attributes).toEqual({ tasting_notes: 'Cocoa, Dried fig, Espresso' });
    // No per-variant GST overrides: every variant inherits the chocolate preset's class.
    expect(spec.products.flatMap((p) => p.variants).every((v) => v.gstRateBp === undefined)).toBe(true);
  });
});

describe('khakhra seed (starter catalogue)', () => {
  const spec = khakhraSeed(NO_ENV);
  const preset = resolvePreset(KHAKHRA);

  it('seeds six flavour families with pack-size variants, no coupons', () => {
    expect(spec.profile).toBe(KHAKHRA);
    expect(spec.products.map((p) => p.slug)).toEqual([
      'plain-khakhra',
      'methi-khakhra',
      'masala-khakhra',
      'jeera-khakhra',
      'multigrain-khakhra',
      'family-combo',
    ]);
    expect(spec.products.flatMap((p) => p.variants)).toHaveLength(16);
    expect(spec.coupons).toEqual([]);
    for (const sku of spec.products.flatMap((p) => p.variants.map((v) => v.sku))) {
      expect(sku).toMatch(/^KH-[A-Z]+-(200|400|1KG|FAMILY)$/);
    }
  });

  it('takes its categories from the resolved preset taxonomy, each with a tile image', () => {
    expect(spec.categories.map(({ imageUrl: _url, ...rest }) => rest)).toEqual(
      preset.categoryTaxonomy,
    );
    for (const category of spec.categories) {
      expect(category.imageUrl).toMatch(/^https:\/\/placehold\.co\//);
    }
    expect(spec.categories.map((c) => c.slug)).toContain('gift-packs');
  });

  it('plain lines inherit HSN 1905 at NIL; seasoned lines carry the documented 500 bp', () => {
    expect(preset.taxDefaults).toMatchObject({ code: '1905', rateBp: 0 });
    const gst = (slug: string): (number | undefined)[] =>
      spec.products.find((p) => p.slug === slug)?.variants.map((v) => v.gstRateBp) ?? [];
    expect(gst('plain-khakhra')).toEqual([undefined, undefined, undefined]);
    expect(gst('multigrain-khakhra')).toEqual([undefined, undefined, undefined]);
    for (const slug of ['methi-khakhra', 'masala-khakhra', 'jeera-khakhra']) {
      expect(gst(slug)).toEqual([500, 500, 500]);
    }
    expect(gst('family-combo')).toEqual([FLAVOURED_GST_RATE_BP]);
  });

  it('is shelf-stable at room temperature: 90 days, dry storage, no cold-chain vocabulary', () => {
    for (const product of spec.products) {
      // Tones are snacks swatch keys (KAKOA's verbatim data keeps two off-palette
      // tones that `toTone` coerces at render time — asserted in lib/brand.test).
      expect(Object.keys(preset.presentation.swatches)).toContain(product.tone);
      expect(product.shelfLifeDays).toBe(90);
      expect(product.storageInstructions).toMatch(/airtight container, away from moisture/);
      expect(product.isVeg).toBe(true);
    }
    expect(seedText(spec)).not.toMatch(
      /ships cold|ice pack|insulat|melt|refrigerat|cold[- ]chain|chocolate|cocoa|cacao|KAKOA/i,
    );
  });

  it('declares wheat on every product and sesame where it is an ingredient', () => {
    for (const product of spec.products) {
      const declared = product.attributes.allergens;
      expect(Array.isArray(declared) && declared.includes('Wheat (gluten)')).toBe(true);
      // The free-text field is the cross-contact advisory only; the PDP prints
      // "Contains …" from attributes.allergens, so the advisory must not repeat it.
      expect(product.allergens).toMatch(/^Made on lines that also handle/);
      expect(product.allergens).not.toMatch(/^Contains/i);
      const hasSesame = /sesame/i.test(product.ingredients);
      expect(Array.isArray(declared) && declared.includes('Sesame')).toBe(hasSesame);
    }
  });

  it('writes attribute values the resolved preset schema accepts', () => {
    const byKey = new Map<string, AttributeDef>(preset.attributeSchema.map((d) => [d.key, d]));
    for (const product of spec.products) {
      for (const [key, value] of Object.entries(product.attributes)) {
        const def = byKey.get(key);
        expect(def, `${product.slug}.${key} is not a preset attribute`).toBeDefined();
        if (def === undefined) continue;
        switch (def.type) {
          case 'enum':
            expect(def.options).toContain(value);
            break;
          case 'multi-enum':
            expect(Array.isArray(value)).toBe(true);
            for (const option of value as unknown[]) expect(def.options).toContain(option);
            break;
          default:
            expect(typeof value).toBe('string');
        }
      }
      expect(product.attributes.region).toBe('Gujarat');
    }
  });

  it('carries per-100 g label placeholders and two placeholder gallery images per product', () => {
    for (const product of spec.products) {
      const nutrition = product.nutritionFacts as Record<string, string>;
      expect(nutrition.basis).toBe('per 100 g');
      expect(nutrition.Energy).toMatch(/^\d+ kcal$/);
      expect(product.images).toHaveLength(2);
      for (const image of product.images ?? []) {
        expect(image.url).toMatch(/^https:\/\/placehold\.co\//);
        expect(image.alt).not.toBe('');
      }
    }
  });

  it('khakhra boxes are large and light: parcel dims grow with the pack and ship weight is realistic', () => {
    const plain = spec.products.find((p) => p.slug === 'plain-khakhra');
    const dims = plain?.variants.map((v) => Number(v.lengthCm) * Number(v.breadthCm) * Number(v.heightCm)) ?? [];
    expect(dims).toEqual([...dims].sort((a, b) => a - b));
    expect(plain?.variants.map((v) => v.weightGrams)).toEqual([200, 400, 1000]);
    expect(plain?.variants.map((v) => v.pricePaise)).toEqual([14900, 27900, 64900]);
  });
});

describe('dispatch helpers', () => {
  it('resolveOwner honours SEED_OWNER_EMAIL and otherwise keeps the brand fallback', () => {
    const fallback = { email: 'owner@kakoa.in', name: 'Kakao Owner' };
    expect(resolveOwner({}, fallback)).toEqual(fallback);
    expect(resolveOwner({ SEED_OWNER_EMAIL: '  ' }, fallback)).toEqual(fallback);
    expect(resolveOwner({ SEED_OWNER_EMAIL: 'me@example.com' }, fallback)).toEqual({
      email: 'me@example.com',
      name: 'Kakao Owner',
    });
    expect(khakhraSeed({}).owner.email).toBe(kakoaSeed({}).owner.email);
  });

  it('resolveSeedBrand prefers --brand over BRAND_KEY and names the keys on failure', () => {
    expect(resolveSeedBrand(['--brand', 'khakhra'], { BRAND_KEY: 'kakoa' })).toBe('khakhra');
    expect(resolveSeedBrand([], { BRAND_KEY: 'kakoa' })).toBe('kakoa');
    expect(() => resolveSeedBrand([], {})).toThrow(/kakoa, khakhra.*got nothing/);
    expect(() => resolveSeedBrand(['--brand', 'tea'], {})).toThrow(/"tea"/);
  });
});
