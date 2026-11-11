import { describe, expect, it } from 'vitest';
import { PRESETS, resolvePreset } from '@platform/kernel';
import {
  BRANDS,
  BRAND_KEYS,
  KAKOA,
  KHAKHRA,
  LEGAL_IDENTITY_KEYS,
  brandProfileSchema,
  getBrandProfile,
  isBrandKey,
  resolveBrandKey,
} from './index';

describe('brand registry', () => {
  it('registers exactly the BRAND_KEYS, each under its own key', () => {
    expect(Object.keys(BRANDS).sort()).toEqual([...BRAND_KEYS].sort());
    for (const key of BRAND_KEYS) expect(getBrandProfile(key).key).toBe(key);
  });

  it('every shipped profile passes the zod contract', () => {
    for (const profile of Object.values(BRANDS)) {
      const result = brandProfileSchema.safeParse(profile);
      expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
    }
  });

  it('every profile names a shipped vertical and its overrides resolve', () => {
    for (const profile of Object.values(BRANDS)) {
      expect(PRESETS[profile.vertical].key).toBe(profile.vertical);
      expect(resolvePreset(profile).key).toBe(profile.vertical);
    }
  });

  it('identifier prefixes and cookie prefixes are unique across brands', () => {
    const profiles = Object.values(BRANDS);
    expect(new Set(profiles.map((p) => p.identifierPrefix)).size).toBe(profiles.length);
    expect(new Set(profiles.map((p) => p.cookiePrefix)).size).toBe(profiles.length);
  });
});

describe('KAKOA profile', () => {
  it('carries the identity the storefront rendered before the move', () => {
    expect(KAKOA.name).toBe('KAKOA');
    expect(KAKOA.identifierPrefix).toBe('KK');
    expect(KAKOA.cookiePrefix).toBe('kakoa');
    expect(KAKOA.vertical).toBe('chocolate');
    expect(KAKOA.themeColor).toBe('#2A1D12');
    expect(KAKOA.backgroundColor).toBe('#FEF6EB');
    expect(KAKOA.defaults.shipping_fee_standard_paise).toBe(4900);
    expect(KAKOA.defaults.cod_enabled).toBe(false);
    expect(KAKOA.defaults.support_email).toBe('support@kakoa.in');
    expect(KAKOA.seedLegalIdentity?.seller_gstin).toBe('27AABCK4321M1Z5');
  });

  it('resolves to the untuned chocolate preset (no presetOverrides)', () => {
    expect(resolvePreset(KAKOA)).toBe(PRESETS.chocolate);
  });
});

describe('KHAKHRA profile', () => {
  it('carries the working identity the owner chose', () => {
    expect(KHAKHRA.key).toBe('khakhra');
    expect(KHAKHRA.name).toBe('Khakhra House');
    expect(KHAKHRA.shortName).toBe('Khakhra');
    expect(KHAKHRA.identifierPrefix).toBe('KH');
    expect(KHAKHRA.cookiePrefix).toBe('khakhra');
    expect(KHAKHRA.email.fromName).toBe('Khakhra House');
    expect(KHAKHRA.locale).toBe('en-IN');
    expect(KHAKHRA.availableLanguages).toEqual(['en', 'gu', 'hi']);
    expect(KHAKHRA.features).toEqual({ journal: false, locator: false, gifting: true, giftWrap: true });
    expect(KHAKHRA.social).toEqual({});
  });

  it('passes the zod contract', () => {
    const result = brandProfileSchema.safeParse(getBrandProfile('khakhra'));
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
  });

  it('mirrors the KAKOA fee policy with COD off', () => {
    const fees = (p: typeof KAKOA | typeof KHAKHRA) => [
      p.defaults.shipping_fee_standard_paise,
      p.defaults.shipping_fee_express_paise,
      p.defaults.free_shipping_threshold_paise,
      p.defaults.gift_wrap_fee_paise,
      p.defaults.cod_enabled,
    ];
    expect(fees(KHAKHRA)).toEqual(fees(KAKOA));
    expect(fees(KHAKHRA)).toEqual([4900, 14900, 99900, 4900, false]);
  });

  it('is the same legal entity as KAKOA — one shared fixture, never a second literal', () => {
    expect(KHAKHRA.seedLegalIdentity).toBe(KAKOA.seedLegalIdentity);
    expect(KHAKHRA.defaults.support_phone).toBe(KAKOA.defaults.support_phone);
    expect(KHAKHRA.defaults.support_email).toBe(KAKOA.defaults.support_email);
    expect(KHAKHRA.defaults.support_hours).toBe(KAKOA.defaults.support_hours);
    for (const key of LEGAL_IDENTITY_KEYS) expect(key in KHAKHRA.defaults).toBe(false);
  });

  it('never ships a cold-chain claim (every string value, legal identity aside)', () => {
    const { seedLegalIdentity: _entity, ...own } = KHAKHRA;
    const leaves: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'string') leaves.push(value.toLowerCase());
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(own);
    expect(leaves.length).toBeGreaterThan(40);
    for (const banned of ['cold', 'ice pack', 'insulat', 'melt', 'chocolate']) {
      expect(leaves.filter((s) => s.includes(banned)), `profile says "${banned}"`).toEqual([]);
    }
  });

  it('resolves to the snacks preset tuned for khakhra', () => {
    const preset = resolvePreset(KHAKHRA);
    expect(preset.key).toBe('snacks');
    expect(preset.label).toBe('Khakhra');
    expect(preset.taxDefaults).toEqual({
      category: 'Khakhra / bakery products',
      rateBp: 0,
      codeSystem: 'HSN',
      code: '1905',
    });
    expect(preset.capabilities).not.toContain('cold-chain');
    expect(preset.capabilities).toEqual(expect.arrayContaining(['variants', 'allergens', 'veg-mark', 'hsn-codes']));
    expect(preset.storefront.coldChain).toBe(false);
    expect(preset.storefront.noun).toEqual({ one: 'khakhra', many: 'khakhras', collective: 'khakhra' });
    expect(preset.storefront.unitNoun).toEqual({ one: 'pack', many: 'packs' });
    expect(preset.storefront.packaging.trustLabel).toBe('Packed crisp, ships anywhere in India');
    expect(preset.storefront.packaging.pdpBullet).toContain('{unit}');
    expect(preset.storefront.returnReasonLabels).toMatchObject({
      damaged_or_melted: 'Damaged or crushed',
      wrong_item: 'Wrong item received',
    });

    const options = (key: string) => preset.attributeSchema.find((a) => a.key === key)?.options;
    expect(options('pack_size')).toEqual(['200 g', '400 g', '1 kg']);
    expect(options('flavour')).toEqual(['Plain', 'Methi', 'Masala', 'Jeera', 'Pudina', 'Multigrain']);
    expect(options('spice_level')).toEqual(['Mild', 'Medium', 'Hot']);
    expect(options('allergens')).toEqual(['Wheat (gluten)', 'Sesame', 'Milk', 'Nuts', 'Soy']);
    // The override patched option lists in place — the preset's other attribute
    // fields (group, showOnPdp, capability) survive.
    const flavour = preset.attributeSchema.find((a) => a.key === 'flavour');
    expect(flavour).toMatchObject({ group: 'Flavour', showOnPdp: true });
    expect(preset.attributeSchema.find((a) => a.key === 'allergens')?.capability).toBe('allergens');
    expect(preset.attributeSchema.map((a) => a.key)).toEqual(
      PRESETS.snacks.attributeSchema.map((a) => a.key),
    );

    expect(preset.categoryTaxonomy?.map((c) => [c.slug, c.name])).toEqual([
      ['plain-classic', 'Plain & Everyday'],
      ['masala-flavoured', 'Masala & Flavoured'],
      ['multigrain-health', 'Multigrain & Millet'],
      ['gift-packs', 'Gift Packs & Combos'],
    ]);
    expect(KHAKHRA.nav.primary.map((l) => l.href)).toContain('/shop?category=gift-packs');
    expect(preset.presentation.defaultSwatch).toBe('wheat');
  });
});

describe('resolveBrandKey', () => {
  it('accepts a registered key', () => {
    expect(resolveBrandKey({ BRAND_KEY: 'kakoa' })).toBe('kakoa');
    expect(resolveBrandKey({ BRAND_KEY: 'khakhra' })).toBe('khakhra');
    expect(isBrandKey('kakoa')).toBe(true);
    expect(isBrandKey('khakhra')).toBe(true);
  });

  it('rejects unset, empty and unknown keys with a readable error', () => {
    expect(() => resolveBrandKey({})).toThrow(/BRAND_KEY must be one of: kakoa, khakhra \(got nothing\)/);
    expect(() => resolveBrandKey({ BRAND_KEY: '' })).toThrow(/got nothing/);
    expect(() => resolveBrandKey({ BRAND_KEY: 'Kakoa' })).toThrow(/got "Kakoa"/);
    expect(isBrandKey('bakery')).toBe(false);
    expect(isBrandKey(undefined)).toBe(false);
  });

  it('has no silent default — a brand must be named explicitly', () => {
    expect(() => resolveBrandKey({ BRAND_KEY: undefined })).toThrow();
  });
});

describe('brandProfileSchema', () => {
  it('rejects a malformed GSTIN / prefix / colour', () => {
    const bad = {
      ...KAKOA,
      identifierPrefix: 'kk',
      themeColor: 'cocoa',
      seedLegalIdentity: { ...KAKOA.seedLegalIdentity, seller_gstin: 'nope' },
    };
    const result = brandProfileSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toEqual(
        expect.arrayContaining(['identifierPrefix', 'themeColor', 'seedLegalIdentity.seller_gstin']),
      );
    }
  });

  it('keeps legal identity OUT of the runtime defaults (seed-only block)', () => {
    for (const key of LEGAL_IDENTITY_KEYS) {
      expect(key in KAKOA.defaults).toBe(false);
    }
    expect(LEGAL_IDENTITY_KEYS).toEqual([
      'seller_legal_name',
      'seller_gstin',
      'seller_state_code',
      'seller_address',
      'origin_pincode',
      'fssai_license_number',
    ]);
    // A brand may omit the block entirely (identity entered via the admin).
    const { seedLegalIdentity: _omitted, ...withoutSeed } = KAKOA;
    expect(brandProfileSchema.safeParse(withoutSeed).success).toBe(true);
  });
});
