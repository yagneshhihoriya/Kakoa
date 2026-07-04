import { describe, expect, it } from 'vitest';

import { stateByCode } from './gst-states';
import {
  PINCODE_STATE_OVERRIDES,
  PINCODE_STATE_PREFIXES,
  stateCodeFromPincode,
} from './pincode';

describe('PINCODE_STATE_PREFIXES / overrides', () => {
  it('every mapped code is a canonical GST state code', () => {
    for (const code of Object.values(PINCODE_STATE_PREFIXES)) {
      expect(stateByCode(code)).toBeDefined();
    }
    for (const code of Object.values(PINCODE_STATE_OVERRIDES)) {
      expect(stateByCode(code)).toBeDefined();
    }
  });

  it('keys are two-digit / three-digit numeric prefixes', () => {
    for (const key of Object.keys(PINCODE_STATE_PREFIXES)) {
      expect(key).toMatch(/^[1-9][0-9]$/);
    }
    for (const key of Object.keys(PINCODE_STATE_OVERRIDES)) {
      expect(key).toMatch(/^[1-9][0-9]{2}$/);
    }
  });
});

describe('stateCodeFromPincode — known prefixes → correct GST code', () => {
  const cases: ReadonlyArray<[string, string, string]> = [
    ['110001', '07', 'Delhi'],
    ['400001', '27', 'Maharashtra'],
    ['560001', '29', 'Karnataka'],
    ['600001', '33', 'Tamil Nadu'],
    ['700001', '19', 'West Bengal'],
    ['380001', '24', 'Gujarat'],
    ['500001', '36', 'Telangana'],
    ['302001', '08', 'Rajasthan'],
    ['226001', '09', 'Uttar Pradesh'],
    ['800001', '10', 'Bihar'],
    ['682001', '31', 'Lakshadweep'],
    ['737101', '11', 'Sikkim'],
    ['744101', '35', 'Andaman & Nicobar Islands'],
    ['682555', '31', 'Lakshadweep'], // override beats the 68→Kerala two-digit rule
  ];

  for (const [pin, code, name] of cases) {
    it(`${pin} → ${code} (${name})`, () => {
      expect(stateCodeFromPincode(pin)).toBe(code);
      expect(stateByCode(code)?.name).toBe(name);
    });
  }

  it('non-override 68x resolves to Kerala (32), not Lakshadweep', () => {
    expect(stateCodeFromPincode('682')).toBe(null); // too short
    expect(stateCodeFromPincode('680001')).toBe('32');
  });

  it('tolerates surrounding whitespace', () => {
    expect(stateCodeFromPincode('  110001 ')).toBe('07');
  });
});

describe('stateCodeFromPincode — unknown / invalid → null', () => {
  it('returns null for an unmapped-but-valid prefix', () => {
    // 35xxxx: no circle 35 in the map.
    expect(stateCodeFromPincode('350001')).toBe(null);
  });

  it('returns null for a leading-zero PIN (invalid India PIN)', () => {
    expect(stateCodeFromPincode('012345')).toBe(null);
  });

  it('returns null for wrong length', () => {
    expect(stateCodeFromPincode('40001')).toBe(null);
    expect(stateCodeFromPincode('4000012')).toBe(null);
  });

  it('returns null for non-digit input', () => {
    expect(stateCodeFromPincode('4000AB')).toBe(null);
    expect(stateCodeFromPincode('')).toBe(null);
  });

  it('returns null for non-string input', () => {
    expect(stateCodeFromPincode(undefined as unknown as string)).toBe(null);
    expect(stateCodeFromPincode(400001 as unknown as string)).toBe(null);
  });
});
