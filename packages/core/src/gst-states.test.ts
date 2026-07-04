import { describe, expect, it } from 'vitest';

import {
  GST_STATES,
  STATE_CODE_RE,
  isValidStateCode,
  stateByCode,
  stateByName,
} from './gst-states';

describe('GST_STATES', () => {
  it('covers all 38 numeric codes plus 97 (39 entries)', () => {
    expect(GST_STATES).toHaveLength(39);
  });

  it('has unique codes and unique names', () => {
    const codes = new Set(GST_STATES.map((s) => s.code));
    const names = new Set(GST_STATES.map((s) => s.name.toLowerCase()));
    expect(codes.size).toBe(GST_STATES.length);
    expect(names.size).toBe(GST_STATES.length);
  });

  it('every code is two digits 01–38 or 97', () => {
    for (const s of GST_STATES) {
      expect(s.code).toMatch(STATE_CODE_RE);
    }
  });

  it('pins the well-known canonical codes', () => {
    expect(stateByCode('07')?.name).toBe('Delhi');
    expect(stateByCode('27')?.name).toBe('Maharashtra');
    expect(stateByCode('29')?.name).toBe('Karnataka');
    expect(stateByCode('33')?.name).toBe('Tamil Nadu');
    expect(stateByCode('97')?.name).toBe('Other Territory');
  });
});

describe('stateByCode', () => {
  it('returns undefined for unknown / malformed codes', () => {
    expect(stateByCode('39')).toBeUndefined();
    expect(stateByCode('00')).toBeUndefined();
    expect(stateByCode('7')).toBeUndefined();
    expect(stateByCode('')).toBeUndefined();
  });
});

describe('stateByName', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(stateByName('maharashtra')?.code).toBe('27');
    expect(stateByName('  Tamil Nadu  ')?.code).toBe('33');
    expect(stateByName('KARNATAKA')?.code).toBe('29');
  });

  it('returns undefined for a name not on the list', () => {
    expect(stateByName('Atlantis')).toBeUndefined();
    expect(stateByName('')).toBeUndefined();
  });
});

describe('isValidStateCode', () => {
  it('accepts canonical codes', () => {
    expect(isValidStateCode('01')).toBe(true);
    expect(isValidStateCode('27')).toBe(true);
    expect(isValidStateCode('38')).toBe(true);
    expect(isValidStateCode('97')).toBe(true);
  });

  it('rejects regex-passing-but-not-listed and malformed codes', () => {
    // 39 is not in the list even though a naive `\d{2}` would pass.
    expect(isValidStateCode('39')).toBe(false);
    expect(isValidStateCode('99')).toBe(false);
    expect(isValidStateCode('00')).toBe(false);
    expect(isValidStateCode('7')).toBe(false);
    expect(isValidStateCode('271')).toBe(false);
    expect(isValidStateCode('')).toBe(false);
  });
});
