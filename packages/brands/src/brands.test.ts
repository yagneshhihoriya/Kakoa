import { describe, expect, it } from 'vitest';
import { PRESETS, resolvePreset } from '@platform/kernel';
import {
  BRANDS,
  BRAND_KEYS,
  KAKOA,
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
  });

  it('resolves to the untuned chocolate preset (no presetOverrides)', () => {
    expect(resolvePreset(KAKOA)).toBe(PRESETS.chocolate);
  });
});

describe('resolveBrandKey', () => {
  it('accepts a registered key', () => {
    expect(resolveBrandKey({ BRAND_KEY: 'kakoa' })).toBe('kakoa');
    expect(isBrandKey('kakoa')).toBe(true);
  });

  it('rejects unset, empty and unknown keys with a readable error', () => {
    expect(() => resolveBrandKey({})).toThrow(/BRAND_KEY must be one of: kakoa \(got nothing\)/);
    expect(() => resolveBrandKey({ BRAND_KEY: '' })).toThrow(/got nothing/);
    expect(() => resolveBrandKey({ BRAND_KEY: 'Kakoa' })).toThrow(/got "Kakoa"/);
    expect(isBrandKey('khakhra')).toBe(false);
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
      defaults: { ...KAKOA.defaults, seller_gstin: 'nope' },
    };
    const result = brandProfileSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toEqual(
        expect.arrayContaining(['identifierPrefix', 'themeColor', 'defaults.seller_gstin']),
      );
    }
  });
});
