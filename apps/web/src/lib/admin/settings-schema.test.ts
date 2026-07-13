/**
 * Unit tests for the pure settings validator. This is where Settings correctness
 * lives: ₹→paise conversion + int4-safe cap, every format regex, bool coercion,
 * int bounds, unknown-key rejection, threshold=0 allowed, first-error message,
 * and jsonb TYPE integrity (paise stored as a number, not a string).
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_PAISE,
  SETTINGS_DEFAULTS,
  SETTINGS_KEYS,
  validateSettingsPatch,
} from './settings-schema';

describe('catalog', () => {
  it('has all 18 keys with defaults', () => {
    expect(SETTINGS_KEYS).toHaveLength(18);
    for (const key of SETTINGS_KEYS) {
      expect(SETTINGS_DEFAULTS[key]).toBeDefined();
    }
  });

  it('paise defaults are numbers, not strings', () => {
    expect(typeof SETTINGS_DEFAULTS.shipping_fee_standard_paise).toBe('number');
    expect(SETTINGS_DEFAULTS.shipping_fee_standard_paise).toBe(4900);
    expect(typeof SETTINGS_DEFAULTS.cod_enabled).toBe('boolean');
    expect(typeof SETTINGS_DEFAULTS.seller_legal_name).toBe('string');
  });
});

describe('validateSettingsPatch — envelope', () => {
  it('rejects non-object / array / null', () => {
    expect(validateSettingsPatch(null).ok).toBe(false);
    expect(validateSettingsPatch('x').ok).toBe(false);
    expect(validateSettingsPatch([]).ok).toBe(false);
  });

  it('rejects an empty patch', () => {
    expect(validateSettingsPatch({}).ok).toBe(false);
  });

  it('rejects an unknown key (never persisted)', () => {
    const r = validateSettingsPatch({ not_a_real_key: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('Unknown setting');
  });
});

describe('int-paise (₹ → paise, jsonb number)', () => {
  it('converts rupees to an integer paise NUMBER', () => {
    const r = validateSettingsPatch({ shipping_fee_standard_paise: 49 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.shipping_fee_standard_paise).toBe(4900);
      expect(typeof r.value.shipping_fee_standard_paise).toBe('number');
    }
  });

  it('rounds fractional rupees to whole paise', () => {
    const r = validateSettingsPatch({ cod_fee_paise: 49.5 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cod_fee_paise).toBe(4950);
  });

  it('allows a free-shipping threshold of ₹0', () => {
    const r = validateSettingsPatch({ free_shipping_threshold_paise: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.free_shipping_threshold_paise).toBe(0);
  });

  it('rejects negative and caps at int4-safe MAX_PAISE (no 22003)', () => {
    expect(validateSettingsPatch({ cod_fee_paise: -1 }).ok).toBe(false);
    // MAX_PAISE is in paise; sending it as rupees would be 100x over the cap.
    const over = validateSettingsPatch({ cod_fee_paise: MAX_PAISE });
    expect(over.ok).toBe(false);
    const okEdge = validateSettingsPatch({ cod_fee_paise: MAX_PAISE / 100 });
    expect(okEdge.ok).toBe(true);
  });

  it('rejects non-numeric rupees', () => {
    expect(validateSettingsPatch({ cod_fee_paise: 'abc' }).ok).toBe(false);
  });
});

describe('int bounds (payment_expiry_minutes 5…1440)', () => {
  it('accepts an in-range integer', () => {
    const r = validateSettingsPatch({ payment_expiry_minutes: 45 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.payment_expiry_minutes).toBe(45);
  });

  it('rejects 0, negative, huge, and non-integers', () => {
    expect(validateSettingsPatch({ payment_expiry_minutes: 0 }).ok).toBe(false);
    expect(validateSettingsPatch({ payment_expiry_minutes: 4 }).ok).toBe(false);
    expect(validateSettingsPatch({ payment_expiry_minutes: 1441 }).ok).toBe(false);
    expect(validateSettingsPatch({ payment_expiry_minutes: 30.5 }).ok).toBe(false);
  });
});

describe('bool coercion', () => {
  it('accepts booleans and common jsonb-ish forms', () => {
    for (const [input, expected] of [
      [true, true],
      [false, false],
      ['true', true],
      ['false', false],
      [1, true],
      [0, false],
    ] as const) {
      const r = validateSettingsPatch({ cod_enabled: input });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.cod_enabled).toBe(expected);
        expect(typeof r.value.cod_enabled).toBe('boolean');
      }
    }
  });

  it('rejects a non-boolean value', () => {
    expect(validateSettingsPatch({ cod_enabled: 'maybe' }).ok).toBe(false);
  });
});

describe('format regexes', () => {
  it('GSTIN valid/invalid (uppercased)', () => {
    const ok = validateSettingsPatch({ seller_gstin: '27aabck4321m1z5' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.seller_gstin).toBe('27AABCK4321M1Z5');
    expect(validateSettingsPatch({ seller_gstin: 'BADGSTIN' }).ok).toBe(false);
  });

  it('state code two digits within 01–37', () => {
    expect(validateSettingsPatch({ seller_state_code: '27' }).ok).toBe(true);
    expect(validateSettingsPatch({ seller_state_code: '00' }).ok).toBe(false);
    expect(validateSettingsPatch({ seller_state_code: '38' }).ok).toBe(false);
    expect(validateSettingsPatch({ seller_state_code: '7' }).ok).toBe(false);
  });

  it('pincode ^[1-9][0-9]{5}$', () => {
    expect(validateSettingsPatch({ origin_pincode: '400053' }).ok).toBe(true);
    expect(validateSettingsPatch({ origin_pincode: '000053' }).ok).toBe(false);
    expect(validateSettingsPatch({ origin_pincode: '4000' }).ok).toBe(false);
  });

  it('FSSAI 14 digits', () => {
    expect(validateSettingsPatch({ fssai_license_number: '11525023000841' }).ok).toBe(true);
    expect(validateSettingsPatch({ fssai_license_number: '123' }).ok).toBe(false);
  });

  it('phone +91[6-9]XXXXXXXXX', () => {
    expect(validateSettingsPatch({ support_phone: '+919820012345' }).ok).toBe(true);
    expect(validateSettingsPatch({ support_phone: '+915820012345' }).ok).toBe(false);
    expect(validateSettingsPatch({ support_phone: '9820012345' }).ok).toBe(false);
  });

  it('email RFC-ish + length', () => {
    const ok = validateSettingsPatch({ support_email: 'Support@Kakoa.IN' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.support_email).toBe('support@kakoa.in');
    expect(validateSettingsPatch({ support_email: 'nope' }).ok).toBe(false);
  });
});

describe('string bounds', () => {
  it('enforces min/max length', () => {
    expect(validateSettingsPatch({ seller_legal_name: 'A' }).ok).toBe(false);
    expect(validateSettingsPatch({ seller_legal_name: 'Acme Chocolates Pvt Ltd' }).ok).toBe(true);
    expect(validateSettingsPatch({ seller_address: 'abcd' }).ok).toBe(false);
  });
});

describe('partial + first-error', () => {
  it('validates multiple keys and returns the first failure', () => {
    const r = validateSettingsPatch({
      seller_state_code: '27',
      origin_pincode: 'bad',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('PIN code');
  });

  it('passes a valid multi-key patch through with typed values', () => {
    const r = validateSettingsPatch({
      cod_enabled: true,
      cod_fee_paise: 49,
      support_email: 'help@kakoa.in',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        cod_enabled: true,
        cod_fee_paise: 4900,
        support_email: 'help@kakoa.in',
      });
    }
  });
});
