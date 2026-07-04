import { describe, expect, it } from 'vitest';

import { maskPhone, normalizePhoneE164 } from './phone';

describe('normalizePhoneE164', () => {
  const accepted: Array<[string, string]> = [
    // spec §1.1 examples
    ['98765 43210', '+919876543210'],
    ['098765-43210', '+919876543210'],
    // testing matrix §9
    ['91 9876543210', '+919876543210'],
    ['+91(98765)43210', '+919876543210'],
    // prefix / separator variants
    ['9876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+91-98765-43210', '+919876543210'],
    ['+91.98765.43210', '+919876543210'],
    ['0 98765 43210', '+919876543210'],
    // already normalized passthrough
    ['+919876543210', '+919876543210'],
    // every valid series digit 6–9
    ['6000000000', '+916000000000'],
    ['7000000000', '+917000000000'],
    ['8000000000', '+918000000000'],
    ['9000000000', '+919000000000'],
  ];

  it.each(accepted)('normalizes %j → %j', (raw, expected) => {
    expect(normalizePhoneE164(raw)).toBe(expected);
  });

  const rejected: Array<[string, string]> = [
    ['+91 5876543210', 'series 5 not allowed'],
    ['5876543210', 'bare series 5'],
    ['9876543', 'too short (7 digits)'],
    ['98765432', '8 digits'],
    ['987654321', '9 digits'],
    ['98765432100', '11 digits'],
    ['+9198765432100', '11 national digits'],
    ['+929876543210', 'wrong country code +92'],
    ['929876543210', '92 prefix, not +91'],
    ['00919876543210', 'double-zero international prefix'],
    ['098765432', 'leading zero but short'],
    ['abcdefghij', 'non-numeric'],
    ['+91 98765 4321a', 'trailing letter'],
    ['', 'empty string'],
    ['   ', 'whitespace only'],
  ];

  it.each(rejected)('rejects %j (%s)', (raw) => {
    expect(normalizePhoneE164(raw)).toBeNull();
  });

  it('returns null for non-string input', () => {
    // @ts-expect-error runtime guard against non-string callers
    expect(normalizePhoneE164(null)).toBeNull();
    // @ts-expect-error runtime guard against non-string callers
    expect(normalizePhoneE164(undefined)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('masks a normalized number to first-2 + last-3 (spec §2.5)', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98•••••210');
  });

  it('masks with different digits', () => {
    expect(maskPhone('+916123456789')).toBe('+91 61•••••789');
  });

  it('returns the input unchanged when not a valid +91 mobile', () => {
    expect(maskPhone('not-a-phone')).toBe('not-a-phone');
    expect(maskPhone('+929876543210')).toBe('+929876543210');
  });

  it('round-trips: normalize then mask', () => {
    const normalized = normalizePhoneE164('98765 43210');
    expect(normalized).not.toBeNull();
    expect(maskPhone(normalized!)).toBe('+91 98•••••210');
  });
});
