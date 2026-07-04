import { describe, expect, it } from 'vitest';
import {
  PERMISSION_CATALOG,
  PERMISSION_KEYS,
  isPermission,
  permissionsByResource,
} from './permissions';

describe('permission catalog', () => {
  it('has no duplicate keys', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
  });

  it('every key is a valid resource:action pair', () => {
    for (const key of PERMISSION_KEYS) {
      expect(key).toMatch(/^[a-z]+:[a-z-]+$/);
    }
  });

  it('isPermission accepts catalogued keys and rejects others', () => {
    expect(isPermission('orders:refund')).toBe(true);
    expect(isPermission('orders:destroy-planet')).toBe(false);
  });

  it('the derived catalog splits resource/action and flags sensitivity', () => {
    const refund = PERMISSION_CATALOG.find((p) => p.key === 'orders:refund')!;
    expect(refund.resource).toBe('orders');
    expect(refund.action).toBe('refund');
    expect(refund.sensitive).toBe(true);
    const read = PERMISSION_CATALOG.find((p) => p.key === 'orders:read')!;
    expect(read.sensitive).toBe(false);
  });

  it('groups permissions by resource', () => {
    const grouped = permissionsByResource();
    expect(grouped['orders']?.map((p) => p.key)).toContain('orders:refund');
    expect(Object.keys(grouped)).toContain('settings');
  });
});
