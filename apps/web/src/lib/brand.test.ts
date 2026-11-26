import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRANDS, BRAND_KEYS, KAKOA, brandProfileSchema } from '@kakoa/brands';
import { PRESETS } from '@platform/kernel';
import {
  EXAMPLE_ORDER_NUMBER,
  ORDER_NUMBER_PREFIX,
  SWATCH_KEYS,
  assertBrandMatchesEnv,
  brand,
  cookieName,
  emailIdentity,
  isOrderNumber,
  lookupRequestSchema,
  orderNumberSchema,
  preset,
  presetHas,
  returnReasonLabel,
  swatchFor,
  toTone,
  vocabulary,
} from './brand';

/**
 * Runs against the kakoa pack (vitest aliases `@brand` the way tsconfig does).
 * The env-reading helpers are exercised against a complete fake env so no
 * .env file is ever read here.
 */
const FAKE_ENV = {
  BRAND_KEY: 'kakoa',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  OTP_PEPPER: 'x'.repeat(32),
  SESSION_SECRET: 'y'.repeat(32),
  APP_ENV: 'local',
};

describe('brand pack', () => {
  it('re-exports the registered kakoa profile and a complete pack', () => {
    expect(brand.profile).toBe(KAKOA);
    expect(brandProfileSchema.safeParse(brand.profile).success).toBe(true);
    expect(brand.copy.titleTagline).toBe('Small-Batch Chocolate');
    expect(brand.og.alt).toContain(brand.profile.name);
    // Infini is CC BY-ND — the attribution obligation travels with the pack.
    expect(brand.fontAttribution?.text).toMatch(/Infini/);
    expect(brand.fontAttribution?.href).toMatch(/^https:\/\/creativecommons\.org\//);
    // Email chrome is literal colour (clients cannot read CSS vars).
    expect(brand.email.theme.ink).toMatch(/^#[0-9a-f]{6}$/i);
    expect(brand.email.footerTagline).toBe('Handcrafted in small batches');
  });
});

describe('vertical preset', () => {
  it('resolves the kakoa profile to the chocolate preset and exposes its vocabulary', () => {
    expect(preset).toBe(PRESETS.chocolate);
    expect(vocabulary.coldChain).toBe(true);
    expect(vocabulary.noun.many).toBe('chocolates');
    expect(presetHas('veg-mark')).toBe(true);
    expect(presetHas('menu')).toBe(false);
  });

  it('toTone keeps a known swatch key and falls back to the default swatch, never throwing', () => {
    expect(SWATCH_KEYS).toEqual(['dark', 'milk', 'ruby', 'caramel', 'white', 'matcha']);
    expect(toTone('milk')).toBe('milk');
    expect(toTone('raspberry')).toBe('dark'); // seeded value outside the palette
    expect(toTone('')).toBe('dark');
    expect(toTone(null)).toBe('dark');
    expect(toTone(undefined)).toBe('dark');
    expect(swatchFor('nope')).toEqual(swatchFor('dark'));
    expect(swatchFor('caramel').from).toBe('#e0a457');
  });

  it('relabels the fixed return_reason enum from the preset', () => {
    expect(returnReasonLabel('damaged_or_melted')).toBe('Damaged or melted');
    expect(returnReasonLabel('some_future_reason')).toBe('some future reason');
  });
});

describe('order numbers', () => {
  it('binds the pack prefix: KK keeps the historical KK-ddddd contract', () => {
    expect(ORDER_NUMBER_PREFIX).toBe('KK');
    expect(EXAMPLE_ORDER_NUMBER).toBe('KK-48210');
    expect(orderNumberSchema.parse(' KK-48210 ')).toBe('KK-48210');
    expect(isOrderNumber('KK-48210')).toBe(true);
    expect(isOrderNumber('KK-4821')).toBe(false);
    expect(isOrderNumber('KH-48210')).toBe(false);
    expect(lookupRequestSchema.safeParse({ orderNumber: 'KH-48210', phone: '9876543210' }).success).toBe(false);
    expect(lookupRequestSchema.safeParse({ orderNumber: 'KK-48210', phone: '9876543210' }).success).toBe(true);
  });
});

describe('cookieName', () => {
  it('derives the historical cookie names from the cookie prefix', () => {
    expect(cookieName('session')).toBe('kakoa_session');
    expect(cookieName('cart')).toBe('kakoa_cart');
    expect(cookieName('admin')).toBe('kakoa_admin');
    expect(cookieName('cookie_consent')).toBe('kakoa_cookie_consent');
  });
});

describe('emailIdentity / assertBrandMatchesEnv', () => {
  const saved = { ...process.env };
  const withEnv = <T,>(env: Record<string, string>, run: () => T): T => {
    for (const key of Object.keys(saved)) delete process.env[key];
    Object.assign(process.env, env);
    try {
      return run();
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  };

  it('falls back to the profile From name and reports the sender address', () => {
    const id = withEnv(FAKE_ENV, emailIdentity);
    expect(id).toEqual({
      fromName: 'KAKOA',
      from: null,
      subjectSuffix: ' · KAKOA',
      smsPrefix: 'KAKOA: ',
    });
  });

  it('EMAIL_FROM_NAME overrides the display name', () => {
    const id = withEnv(
      { ...FAKE_ENV, EMAIL_FROM: 'orders@example.com', EMAIL_FROM_NAME: 'KAKOA Orders' },
      emailIdentity,
    );
    expect(id.fromName).toBe('KAKOA Orders');
    expect(id.from).toBe('orders@example.com');
  });

  it('the boot assert passes when BRAND_KEY names the bundled pack', () => {
    expect(() => withEnv(FAKE_ENV, assertBrandMatchesEnv)).not.toThrow();
  });
});

/**
 * The repo enumerates its brands in four places that cannot import each
 * other: the registry (packages/brands), the seed dispatcher, the brand-gate
 * script and the CI matrix. The first two are typed against BRAND_KEYS; this
 * keeps the two text files in step, so registering a brand without gating and
 * building it fails a test instead of passing silently.
 */
describe('brand enumerations outside TypeScript', () => {
  const read = (relative: string) =>
    readFileSync(fileURLToPath(new URL(`../../../../${relative}`, import.meta.url)), 'utf8');

  it('scripts/brand-gate.sh exempts exactly the registered seed files and anchors every identifier prefix', () => {
    const gate = read('scripts/brand-gate.sh');
    expect(gate).toContain(`\nBRAND_KEYS='${BRAND_KEYS.join('|')}'\n`);
    const prefixes = Object.values(BRANDS).map((profile) => profile.identifierPrefix);
    expect(gate).toContain(`SKU_PATTERN='\\b(${prefixes.join('|')})-[A-Z0-9]'`);
  });

  it('.github/workflows/ci.yml builds every registered brand', () => {
    const matrix = /^\s*brand:\s*\[([^\]]+)\]\s*$/m.exec(read('.github/workflows/ci.yml'));
    expect(matrix?.[1]?.split(',').map((key) => key.trim()).sort()).toEqual([...BRAND_KEYS].sort());
  });
});
