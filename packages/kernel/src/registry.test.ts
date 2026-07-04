import { describe, expect, it } from 'vitest';
import {
  ModuleRegistry,
  type AdminModule,
} from './registry';
import {
  createBusinessContext,
  resolveCapabilities,
  type BusinessProfile,
  type SettingsReader,
} from './business-context';
import type { PermissionGrant } from './roles';
import type { Capability } from './capabilities';

/* ---- test fixtures ---- */

function settings(map: Record<string, unknown> = {}): SettingsReader {
  const k = (ns: string, key: string) => `${ns}.${key}`;
  return {
    get: <T,>(ns: string, key: string): T | undefined => map[k(ns, key)] as T | undefined,
    getBool: (ns, key, fb = false) => {
      const v = map[k(ns, key)];
      return typeof v === 'boolean' ? v : fb;
    },
    getInt: (ns, key, fb = 0) => {
      const v = map[k(ns, key)];
      return typeof v === 'number' ? v : fb;
    },
    getString: (ns, key, fb) => {
      const v = map[k(ns, key)];
      return typeof v === 'string' ? v : fb;
    },
  };
}

const PROFILE: BusinessProfile = {
  businessId: 'default',
  name: 'Test Co',
  currency: 'INR',
  country: 'IN',
  locale: 'en-IN',
  identifierPrefix: 'TC',
  vertical: 'chocolate',
};

function ctx(opts: {
  grants: readonly PermissionGrant[];
  caps?: Set<Capability>;
  settingsMap?: Record<string, unknown>;
}) {
  return createBusinessContext({
    profile: PROFILE,
    capabilities: opts.caps ?? resolveCapabilities('chocolate'),
    enabledModules: new Set(),
    settings: settings(opts.settingsMap),
    grants: opts.grants,
  });
}

const ordersModule: AdminModule = {
  key: 'orders',
  title: 'Orders',
  group: 'commerce',
  order: 1,
  enabledByDefault: true,
  permissions: [{ key: 'orders:read', label: 'Read orders' }],
  nav: [{ label: 'Orders', href: '/admin/orders', permission: 'orders:read' }],
  widgets: [{ key: 'revenue', permission: 'dashboard:read' }],
};

const shippingModule: AdminModule = {
  key: 'shipping',
  title: 'Shipping',
  group: 'commerce',
  order: 2,
  enabledByDefault: true,
  requiresCapabilities: ['weight-shipping'],
  permissions: [{ key: 'shipping:read', label: 'Read shipping' }],
  nav: [{ label: 'Shipping', href: '/admin/shipping', permission: 'shipping:read' }],
};

const reviewsModule: AdminModule = {
  key: 'reviews',
  title: 'Reviews',
  group: 'commerce',
  order: 3,
  enabledByDefault: false, // off unless a business enables it
  permissions: [{ key: 'reviews:moderate', label: 'Moderate reviews' }],
  nav: [{ label: 'Reviews', href: '/admin/reviews', permission: 'reviews:moderate' }],
};

function registry(): ModuleRegistry {
  return new ModuleRegistry()
    .register(ordersModule)
    .register(shippingModule)
    .register(reviewsModule);
}

/* ---- tests ---- */

describe('ModuleRegistry.register', () => {
  it('throws on a duplicate module key', () => {
    const r = new ModuleRegistry().register(ordersModule);
    expect(() => r.register(ordersModule)).toThrow(/Duplicate/);
  });
  it('aggregates the permission catalog from all modules', () => {
    expect(registry().permissionCatalog().map((p) => p.key)).toEqual([
      'orders:read',
      'shipping:read',
      'reviews:moderate',
    ]);
  });
});

describe('ModuleRegistry.compose — permission filtering', () => {
  it('Owner (wildcard) sees enabled modules', () => {
    const composed = registry().compose(ctx({ grants: ['*'] }));
    const keys = composed.modules.map((m) => m.key);
    expect(keys).toContain('orders');
    expect(keys).toContain('shipping'); // chocolate has weight-shipping
    expect(keys).not.toContain('reviews'); // enabledByDefault=false
  });

  it('hides a module when the admin lacks every nav permission', () => {
    const composed = registry().compose(ctx({ grants: ['shipping:read'] }));
    expect(composed.modules.map((m) => m.key)).toEqual(['shipping']);
    expect(composed.nav.map((n) => n.href)).toEqual(['/admin/shipping']);
  });
});

describe('ModuleRegistry.compose — capability gating', () => {
  it('hides a capability-gated module when the capability is off', () => {
    const noShip = resolveCapabilities('chocolate', { 'weight-shipping': false });
    const composed = registry().compose(ctx({ grants: ['*'], caps: noShip }));
    expect(composed.modules.map((m) => m.key)).not.toContain('shipping');
  });
});

describe('ModuleRegistry.compose — settings override', () => {
  it('a business can enable a default-off module via settings', () => {
    const composed = registry().compose(
      ctx({ grants: ['*'], settingsMap: { 'module.reviews.enabled': true } }),
    );
    expect(composed.modules.map((m) => m.key)).toContain('reviews');
  });
  it('a business can disable a default-on module via settings', () => {
    const composed = registry().compose(
      ctx({ grants: ['*'], settingsMap: { 'module.orders.enabled': false } }),
    );
    expect(composed.modules.map((m) => m.key)).not.toContain('orders');
  });
});

describe('ModuleRegistry.compose — widgets', () => {
  it('includes a widget only when permitted', () => {
    const withDash = registry().compose(ctx({ grants: ['orders:read', 'dashboard:read'] }));
    expect(withDash.widgets.map((w) => w.key)).toContain('revenue');
    const noDash = registry().compose(ctx({ grants: ['orders:read'] }));
    expect(noDash.widgets.map((w) => w.key)).not.toContain('revenue');
  });
});
