import { describe, expect, it } from 'vitest';
import type { AttributeDef, Capability } from '@platform/kernel';
import { isUuid, validateAttributes } from './product-validation';

describe('isUuid', () => {
  it('accepts a well-formed uuid (any case)', () => {
    expect(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
    expect(isUuid('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe(true);
  });
  it('rejects malformed / non-string values (would raise 22P02 against a uuid column)', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('123')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(42)).toBe(false);
    // SQL-injection-shaped string is not uuid-shaped → filtered out.
    expect(isUuid("' OR 1=1 --")).toBe(false);
  });
});

describe('validateAttributes (the generic, business-agnostic mechanism)', () => {
  const schema: readonly AttributeDef[] = [
    { key: 'cocoa_pct', label: 'Cocoa %', type: 'number' },
    { key: 'origin', label: 'Origin', type: 'text' },
    { key: 'tone', label: 'Tone', type: 'enum', options: ['dark', 'milk', 'white'] },
    { key: 'notes', label: 'Notes', type: 'multi-enum', options: ['Cocoa', 'Berry', 'Nutty'] },
    { key: 'organic', label: 'Organic', type: 'boolean' },
    { key: 'lab', label: 'Lab report', type: 'rich', capability: 'lab-reports' as Capability },
  ];
  const caps = new Set<Capability>();

  it('drops unknown keys (no prototype pollution surface)', () => {
    const out = validateAttributes(schema, caps, {
      origin: 'Madagascar',
      junk_key: 'x',
      __proto__: { polluted: true },
    });
    expect(out).toEqual({ origin: 'Madagascar' });
    expect(('junk_key' in out)).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('coerces numbers and rejects non-finite', () => {
    expect(validateAttributes(schema, caps, { cocoa_pct: '72' }).cocoa_pct).toBe(72);
    expect(validateAttributes(schema, caps, { cocoa_pct: 'abc' }).cocoa_pct).toBeUndefined();
  });

  it('whitelists enum + filters multi-enum to declared options', () => {
    expect(validateAttributes(schema, caps, { tone: 'dark' }).tone).toBe('dark');
    expect(validateAttributes(schema, caps, { tone: 'chartreuse' }).tone).toBeUndefined();
    expect(validateAttributes(schema, caps, { notes: ['Berry', 'Poison', 'Cocoa'] }).notes).toEqual([
      'Berry',
      'Cocoa',
    ]);
  });

  it('drops attributes gated on a disabled capability, keeps them when enabled', () => {
    expect(validateAttributes(schema, caps, { lab: 'report' }).lab).toBeUndefined();
    const withCap = new Set<Capability>(['lab-reports' as Capability]);
    expect(validateAttributes(schema, withCap, { lab: 'report' }).lab).toBe('report');
  });

  it('caps text length at 5000 chars', () => {
    const out = validateAttributes(schema, caps, { origin: 'x'.repeat(6000) });
    expect((out.origin as string).length).toBe(5000);
  });
});
