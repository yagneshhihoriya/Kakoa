import { describe, expect, it } from 'vitest';
import {
  createBusinessContext,
  resolveCapabilities,
  type BusinessProfile,
  type SettingsReader,
} from './business-context';

const NULL_SETTINGS: SettingsReader = {
  get: () => undefined,
  getBool: (_ns, _k, fb = false) => fb,
  getInt: (_ns, _k, fb = 0) => fb,
  getString: (_ns, _k, fb) => fb,
};

const PROFILE: BusinessProfile = {
  businessId: 'default',
  name: 'Kakao',
  currency: 'INR',
  country: 'IN',
  locale: 'en-IN',
  identifierPrefix: 'KK',
  vertical: 'chocolate',
};

describe('resolveCapabilities', () => {
  it('starts from the preset defaults', () => {
    const caps = resolveCapabilities('chocolate');
    expect(caps.has('veg-mark')).toBe(true);
    expect(caps.has('cold-chain')).toBe(true);
    expect(caps.has('menu')).toBe(false); // restaurant-only
  });

  it('applies per-business overrides (add and remove)', () => {
    const caps = resolveCapabilities('chocolate', {
      'cold-chain': false, // turn off
      subscriptions: true, // turn on
    });
    expect(caps.has('cold-chain')).toBe(false);
    expect(caps.has('subscriptions')).toBe(true);
    expect(caps.has('veg-mark')).toBe(true); // untouched default stays
  });
});

describe('createBusinessContext', () => {
  const ctx = createBusinessContext({
    profile: PROFILE,
    capabilities: resolveCapabilities('chocolate'),
    enabledModules: new Set(['orders']),
    settings: NULL_SETTINGS,
    grants: ['orders:read', 'orders:transition'],
  });

  it('exposes the resolved preset for the profile vertical', () => {
    expect(ctx.preset.key).toBe('chocolate');
    expect(ctx.businessId).toBe('default');
  });

  it('can() reflects the acting admin grants', () => {
    expect(ctx.can('orders:read')).toBe(true);
    expect(ctx.can('orders:refund')).toBe(false);
  });

  it('has() reflects enabled capabilities', () => {
    expect(ctx.has('veg-mark')).toBe(true);
    expect(ctx.has('menu')).toBe(false);
  });

  it("Owner wildcard grants everything through can()", () => {
    const owner = createBusinessContext({
      profile: PROFILE,
      capabilities: new Set(),
      enabledModules: new Set(),
      settings: NULL_SETTINGS,
      grants: ['*'],
    });
    expect(owner.can('roles:manage')).toBe(true);
    expect(owner.can('payments:refund')).toBe(true);
  });
});
