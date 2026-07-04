import { describe, expect, it } from 'vitest';
import { PERMISSION_KEYS, type Permission } from './permissions';
import {
  SYSTEM_ROLES,
  expandPermissions,
  grantsPermission,
  roleCan,
  systemRole,
  LEGACY_ROLE_TO_PRESET,
} from './roles';

const owner = systemRole('owner')!;
const admin = systemRole('admin')!;
const manager = systemRole('manager')!;
const staff = systemRole('staff')!;
const viewer = systemRole('viewer')!;

describe('grantsPermission / wildcard', () => {
  it('the wildcard grants every permission (Owner)', () => {
    for (const p of PERMISSION_KEYS) {
      expect(grantsPermission(['*'], p)).toBe(true);
    }
  });
  it('a concrete grant matches only that permission', () => {
    expect(grantsPermission(['orders:read'], 'orders:read')).toBe(true);
    expect(grantsPermission(['orders:read'], 'orders:refund')).toBe(false);
  });
});

describe('expandPermissions', () => {
  it("expands '*' to the full catalog", () => {
    expect(expandPermissions(['*'])).toEqual(PERMISSION_KEYS);
  });
  it('drops the wildcard token from a concrete list', () => {
    expect(expandPermissions(['orders:read', 'orders:refund'])).toEqual([
      'orders:read',
      'orders:refund',
    ]);
  });
});

describe('system role presets', () => {
  it('Owner can do everything', () => {
    for (const p of PERMISSION_KEYS) expect(roleCan(owner, p)).toBe(true);
  });

  it('forms a strict privilege hierarchy owner ⊇ admin ⊇ manager ⊇ staff ⊇ viewer', () => {
    const set = (r: typeof admin) => new Set(expandPermissions(r.permissions));
    const a = set(admin);
    const m = set(manager);
    const s = set(staff);
    const v = set(viewer);
    const subset = (small: Set<Permission>, big: Set<Permission>) =>
      [...small].every((p) => big.has(p));
    expect(subset(v, s)).toBe(true);
    expect(subset(s, m)).toBe(true);
    expect(subset(m, a)).toBe(true);
    // owner is '*' so trivially a superset of admin
    expect(a.size).toBeLessThan(PERMISSION_KEYS.length); // admin is NOT everything
  });

  it('keeps money/identity/governance actions above Staff', () => {
    // Staff cannot refund, view PII, manage coupons, write settings, manage roles.
    for (const p of [
      'orders:refund',
      'payments:refund',
      'customers:pii-view',
      'coupons:manage',
      'settings:write',
      'roles:manage',
      'audit:read',
    ] as Permission[]) {
      expect(roleCan(staff, p)).toBe(false);
    }
  });

  it('reserves roles/audit/data-requests for Owner only (not even Admin)', () => {
    for (const p of ['roles:manage', 'audit:read', 'customers:data-request'] as Permission[]) {
      expect(roleCan(admin, p)).toBe(false);
      expect(roleCan(owner, p)).toBe(true);
    }
  });

  it('Viewer is strictly read-only (no :write/:manage/:transition/:refund/:adjust)', () => {
    for (const p of expandPermissions(viewer.permissions)) {
      expect(p.split(':')[1]).toMatch(/^(read)$/);
    }
  });

  it('every granted permission is a real catalogued key', () => {
    for (const role of SYSTEM_ROLES) {
      for (const p of expandPermissions(role.permissions)) {
        expect(PERMISSION_KEYS).toContain(p);
      }
    }
  });
});

describe('legacy back-compat', () => {
  it('maps the old owner/staff enum to the new presets', () => {
    expect(LEGACY_ROLE_TO_PRESET.owner).toBe('owner');
    expect(LEGACY_ROLE_TO_PRESET.staff).toBe('staff');
    expect(systemRole(LEGACY_ROLE_TO_PRESET.owner)).toBeDefined();
    expect(systemRole(LEGACY_ROLE_TO_PRESET.staff)).toBeDefined();
  });
});
