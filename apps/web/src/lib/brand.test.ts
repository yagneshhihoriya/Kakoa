import { describe, expect, it } from 'vitest';
import { KAKOA, brandProfileSchema } from '@kakoa/brands';
import { assertBrandMatchesEnv, brand, cookieName, emailIdentity } from './brand';

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
