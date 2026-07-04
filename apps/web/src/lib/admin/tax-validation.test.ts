/**
 * Unit tests for the pure GST rate / HSN validator — rate bounds (0…2800 bp),
 * HSN shape (`^[0-9]{4,8}$`), and the bp↔% conversion.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_GST_RATE_BP,
  isValidHsn,
  ratePctFromBp,
  validateHsnParam,
  validateRateBp,
  validateTaxInput,
} from './tax-validation';

describe('validateTaxInput — rate bounds', () => {
  it('accepts the India GST rates (0/5/12/18/28%)', () => {
    for (const bp of [0, 500, 1200, 1800, 2800]) {
      const r = validateTaxInput({ gstRateBp: bp, hsnCode: '1806' });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.gstRateBp).toBe(bp);
    }
  });

  it('rejects a rate above the 2800 bp ceiling', () => {
    expect(validateTaxInput({ gstRateBp: MAX_GST_RATE_BP + 1, hsnCode: '1806' }).ok).toBe(false);
    expect(validateTaxInput({ gstRateBp: 5000, hsnCode: '1806' }).ok).toBe(false);
  });

  it('rejects negative and non-integer rates', () => {
    expect(validateTaxInput({ gstRateBp: -1, hsnCode: '1806' }).ok).toBe(false);
    expect(validateTaxInput({ gstRateBp: 5.5, hsnCode: '1806' }).ok).toBe(false);
    expect(validateTaxInput({ gstRateBp: Number.NaN, hsnCode: '1806' }).ok).toBe(false);
  });
});

describe('validateTaxInput — HSN shape', () => {
  it('accepts 4/6/8-digit HSN and trims', () => {
    expect(validateTaxInput({ gstRateBp: 500, hsnCode: '1806' }).ok).toBe(true);
    expect(validateTaxInput({ gstRateBp: 500, hsnCode: '180690' }).ok).toBe(true);
    expect(validateTaxInput({ gstRateBp: 500, hsnCode: '18069010' }).ok).toBe(true);
    const trimmed = validateTaxInput({ gstRateBp: 500, hsnCode: '  1806 ' });
    expect(trimmed.ok).toBe(true);
    if (trimmed.ok) expect(trimmed.value.hsnCode).toBe('1806');
  });

  it('rejects malformed HSN (too short, too long, non-numeric)', () => {
    expect(validateTaxInput({ gstRateBp: 500, hsnCode: '180' }).ok).toBe(false);
    expect(validateTaxInput({ gstRateBp: 500, hsnCode: '123456789' }).ok).toBe(false);
    expect(validateTaxInput({ gstRateBp: 500, hsnCode: '18O6' }).ok).toBe(false);
    expect(validateTaxInput({ gstRateBp: 500, hsnCode: '' }).ok).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(validateTaxInput(null).ok).toBe(false);
    expect(validateTaxInput('1806').ok).toBe(false);
  });
});

describe('helpers', () => {
  it('ratePctFromBp converts basis points to percent', () => {
    expect(ratePctFromBp(500)).toBe(5);
    expect(ratePctFromBp(1800)).toBe(18);
    expect(ratePctFromBp(0)).toBe(0);
  });

  it('isValidHsn matches 4/6/8 digits only', () => {
    expect(isValidHsn('1806')).toBe(true);
    expect(isValidHsn('18069010')).toBe(true);
    expect(isValidHsn('18')).toBe(false);
    expect(isValidHsn(1806)).toBe(false);
  });

  it('validateHsnParam returns the trimmed code or null', () => {
    expect(validateHsnParam(' 1806 ')).toBe('1806');
    expect(validateHsnParam('bad')).toBeNull();
  });

  it('validateRateBp bounds the value', () => {
    expect(validateRateBp(500)).toBe(500);
    expect(validateRateBp(2800)).toBe(2800);
    expect(validateRateBp(2801)).toBeNull();
    expect(validateRateBp(-1)).toBeNull();
    expect(validateRateBp(5.5)).toBeNull();
  });
});
