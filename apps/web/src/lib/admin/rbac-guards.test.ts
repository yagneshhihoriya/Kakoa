import { describe, expect, it } from 'vitest';
import {
  canGrantAll,
  canSetWildcard,
  isOwnerGrants,
  isSelfLockout,
  isValidRoleKey,
  sanitizePermissionGrants,
  validateRoleInput,
  wouldLeaveNoOwner,
} from './rbac-guards';

describe('§4.1 canGrantAll (no privilege escalation)', () => {
  it('owner (*) can grant anything', () => {
    expect(canGrantAll(['*'], ['orders:refund', 'roles:manage'])).toBe(true);
    expect(canGrantAll(['*'], [])).toBe(true);
  });
  it('non-owner can grant a subset of their own grants', () => {
    expect(canGrantAll(['orders:read', 'orders:transition'], ['orders:read'])).toBe(true);
    expect(canGrantAll(['orders:read', 'orders:transition'], ['orders:read', 'orders:transition'])).toBe(true);
  });
  it('non-owner cannot grant a permission they lack', () => {
    expect(canGrantAll(['orders:read'], ['orders:refund'])).toBe(false);
    expect(canGrantAll(['staff:manage'], ['roles:manage'])).toBe(false);
  });
  it('empty target set is always grantable', () => {
    expect(canGrantAll(['orders:read'], [])).toBe(true);
  });
});

describe('§4.7 wildcard + permission sanitisation', () => {
  it('only owners may set the wildcard', () => {
    expect(canSetWildcard(['*'])).toBe(true);
    expect(canSetWildcard(['staff:manage', 'roles:manage'])).toBe(false);
  });
  it('drops unknown / non-string permission strings', () => {
    expect(sanitizePermissionGrants(['orders:read', 'bogus:perm', 42, null], ['*'])).toEqual(['orders:read']);
  });
  it('keeps * only for an owner actor', () => {
    expect(sanitizePermissionGrants(['*', 'orders:read'], ['*'])).toEqual(['*', 'orders:read']);
    expect(sanitizePermissionGrants(['*', 'orders:read'], ['orders:read'])).toEqual(['orders:read']);
  });
  it('dedupes', () => {
    expect(sanitizePermissionGrants(['orders:read', 'orders:read'], ['*'])).toEqual(['orders:read']);
  });
  it('non-array → empty', () => {
    expect(sanitizePermissionGrants('orders:read', ['*'])).toEqual([]);
    expect(sanitizePermissionGrants(null, ['*'])).toEqual([]);
  });
  it('isOwnerGrants', () => {
    expect(isOwnerGrants(['*'])).toBe(true);
    expect(isOwnerGrants(['orders:read'])).toBe(false);
  });
});

describe('§4.2 wouldLeaveNoOwner (last-active-owner protection)', () => {
  it('blocks demoting/deactivating the sole owner', () => {
    expect(wouldLeaveNoOwner({ activeOwnerIds: ['a'], targetId: 'a', targetIsOwnerAfter: false })).toBe(true);
  });
  it('allows when another owner remains', () => {
    expect(wouldLeaveNoOwner({ activeOwnerIds: ['a', 'b'], targetId: 'a', targetIsOwnerAfter: false })).toBe(false);
  });
  it('allows when the target stays an owner', () => {
    expect(wouldLeaveNoOwner({ activeOwnerIds: ['a'], targetId: 'a', targetIsOwnerAfter: true })).toBe(false);
  });
  it('changing a non-owner never reduces owners', () => {
    expect(wouldLeaveNoOwner({ activeOwnerIds: ['a'], targetId: 'z', targetIsOwnerAfter: false })).toBe(false);
    expect(wouldLeaveNoOwner({ activeOwnerIds: [], targetId: 'z', targetIsOwnerAfter: false })).toBe(false);
  });
});

describe('§4.3 isSelfLockout', () => {
  const actor = { actorId: 'me', actorGrants: ['staff:manage', 'roles:manage'] as const };
  it('never triggers for a different target', () => {
    expect(isSelfLockout({ ...actor, targetId: 'other', deactivating: true, newGrants: null })).toBe(false);
  });
  it('blocks self-deactivate', () => {
    expect(isSelfLockout({ ...actor, targetId: 'me', deactivating: true, newGrants: null })).toBe(true);
  });
  it('blocks self role-change that removes own staff:manage or roles:manage', () => {
    expect(isSelfLockout({ ...actor, targetId: 'me', deactivating: false, newGrants: ['orders:read'] })).toBe(true);
    expect(isSelfLockout({ ...actor, targetId: 'me', deactivating: false, newGrants: ['staff:manage'] })).toBe(true); // drops roles:manage
  });
  it('allows self role-change that keeps both self-management perms', () => {
    expect(isSelfLockout({ ...actor, targetId: 'me', deactivating: false, newGrants: ['staff:manage', 'roles:manage', 'orders:read'] })).toBe(false);
  });
  it('unchanged role (newGrants null) with no deactivate is fine', () => {
    expect(isSelfLockout({ ...actor, targetId: 'me', deactivating: false, newGrants: null })).toBe(false);
  });
  it('owner editing self keeps * → not a lockout', () => {
    expect(isSelfLockout({ actorId: 'me', actorGrants: ['*'], targetId: 'me', deactivating: false, newGrants: ['*'] })).toBe(false);
  });
});

describe('role key + input validation', () => {
  it('accepts valid keys', () => {
    expect(isValidRoleKey('support_lead')).toBe(true);
    expect(isValidRoleKey('ops2')).toBe(true);
  });
  it('rejects invalid keys', () => {
    expect(isValidRoleKey('X')).toBe(false); // uppercase + too short
    expect(isValidRoleKey('1abc')).toBe(false); // starts with digit
    expect(isValidRoleKey('a')).toBe(false); // too short
    expect(isValidRoleKey('has space')).toBe(false);
    expect(isValidRoleKey('a'.repeat(32))).toBe(false); // too long
    expect(isValidRoleKey(123)).toBe(false);
  });
  it('validateRoleInput sanitises name/description/permissions', () => {
    const r = validateRoleInput({ name: '  Support  ', description: 'x'.repeat(300), permissions: ['orders:read', 'bogus'] }, ['*']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('Support');
      expect(r.value.description.length).toBe(200);
      expect(r.value.permissions).toEqual(['orders:read']);
    }
  });
  it('validateRoleInput rejects a too-short name', () => {
    expect(validateRoleInput({ name: 'A', permissions: [] }, ['*']).ok).toBe(false);
  });
  it('validateRoleInput strips * for a non-owner actor', () => {
    const r = validateRoleInput({ name: 'Ops', permissions: ['*', 'orders:read'] }, ['orders:read']);
    expect(r.ok && r.value.permissions).toEqual(['orders:read']);
  });
});
