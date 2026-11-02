/**
 * Unit tests for the pure settings validator. This is where Settings correctness
 * lives: ₹→paise conversion + int4-safe cap, every format regex, bool coercion,
 * int bounds, unknown-key rejection, threshold=0 allowed, first-error message,
 * and jsonb TYPE integrity (paise stored as a number, not a string).
 */
import { describe, expect, it } from 'vitest';
import { KAKOA, LEGAL_IDENTITY_KEYS } from '@kakoa/brands';
import {
  CATALOG_BY_KEY,
  MAX_PAISE,
  REQUIRED_SETTINGS_KEYS,
  SETTINGS_CATALOG,
  SETTINGS_DEFAULTS,
  SETTINGS_KEYS,
  THEME_TOKENS,
  flatKey,
  normalizeDayRange,
  normalizeSettingUrl,
  validateSettingsPatch,
} from './settings-schema';

describe('catalog', () => {
  it('has all 42 keys; policy keys carry a brand default, legal identity has none', () => {
    expect(SETTINGS_KEYS).toHaveLength(42);
    expect(new Set(SETTINGS_KEYS).size).toBe(SETTINGS_KEYS.length);
    for (const key of SETTINGS_KEYS) {
      if (REQUIRED_SETTINGS_KEYS.includes(key)) expect(SETTINGS_DEFAULTS[key]).toBeUndefined();
      else expect(SETTINGS_DEFAULTS[key]).toBeDefined();
    }
    expect(Object.keys(SETTINGS_DEFAULTS)).toHaveLength(36);
  });

  it('storefront / brand / policy / ops / shipping keys are namespaced so the readers resolve them first', () => {
    for (const key of [
      'storefront.announcement_segments',
      'storefront.home_hero_product_slug',
      'storefront.hero_image_url',
      'storefront.hero_image_mobile_url',
      'storefront.newsletter_offer',
      'brand.logo_url',
      'brand.og_image_url',
      'brand.social_instagram',
      'brand.social_facebook',
      'brand.social_pinterest',
      'brand.social_youtube',
      'policy.legal_effective_date',
      'policy.damage_report_window_hours',
      'policy.refund_sla_days',
      'policy.dispatch_sla_days',
      'policy.delivery_eta_days',
      'ops.alert_email',
      'ops.alert_phone',
      'shipping.shiprocket_pickup_location',
    ]) {
      expect(SETTINGS_KEYS).toContain(key);
    }
    expect(SETTINGS_DEFAULTS['storefront.home_hero_product_slug']).toBe('');
    expect(flatKey('storefront.newsletter_offer')).toBe('newsletter_offer');
    expect(flatKey('cod_enabled')).toBe('cod_enabled');
  });

  it('every brand.theme.* token is catalogued as a blank hex override', () => {
    for (const token of Object.keys(THEME_TOKENS)) {
      const field = CATALOG_BY_KEY.get(`brand.theme.${token}`);
      expect(field?.type).toBe('hex');
      expect(field?.default).toBe('');
    }
  });

  it("the storefront defaults are the brand profile's (ribbon, offer, SLAs, pickup)", () => {
    expect(SETTINGS_DEFAULTS['storefront.announcement_segments']).toEqual([
      ...KAKOA.defaults.announcement_segments,
    ]);
    expect(SETTINGS_DEFAULTS['storefront.newsletter_offer']).toBe(KAKOA.defaults.newsletter_offer);
    expect(SETTINGS_DEFAULTS['policy.legal_effective_date']).toBe(KAKOA.defaults.legal_effective_date);
    expect(SETTINGS_DEFAULTS['policy.refund_sla_days']).toBe('5–7');
    expect(SETTINGS_DEFAULTS['shipping.shiprocket_pickup_location']).toBe('Primary');
    expect(SETTINGS_DEFAULTS['brand.social_instagram']).toBe(KAKOA.social.instagram);
  });

  it('the required (no-default) keys are exactly the legal identity', () => {
    expect([...REQUIRED_SETTINGS_KEYS].sort()).toEqual([...LEGAL_IDENTITY_KEYS].sort());
    for (const f of SETTINGS_CATALOG) {
      // A field is either defaulted or required — never both, never neither.
      expect(f.required === true).toBe(f.default === undefined);
    }
    // No brand's GSTIN / legal name can leak out of the catalog.
    expect(JSON.stringify(SETTINGS_CATALOG)).not.toMatch(/27AABCK4321M1Z5|Kakao Chocolates/);
  });

  it('paise defaults are numbers, not strings', () => {
    expect(typeof SETTINGS_DEFAULTS.shipping_fee_standard_paise).toBe('number');
    expect(SETTINGS_DEFAULTS.shipping_fee_standard_paise).toBe(4900);
    expect(typeof SETTINGS_DEFAULTS.cod_enabled).toBe('boolean');
    expect(typeof SETTINGS_DEFAULTS.support_email).toBe('string');
  });
});

describe('slug', () => {
  it('accepts blank (unset) and a well-formed slug, lowercasing on the way in', () => {
    const blank = validateSettingsPatch({ 'storefront.home_hero_product_slug': '  ' });
    expect(blank.ok).toBe(true);
    if (blank.ok) expect(blank.value['storefront.home_hero_product_slug']).toBe('');
    const r = validateSettingsPatch({ 'storefront.home_hero_product_slug': ' Midnight-72-Dark ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value['storefront.home_hero_product_slug']).toBe('midnight-72-dark');
  });

  it('rejects anything that is not a slug', () => {
    expect(validateSettingsPatch({ 'storefront.home_hero_product_slug': 'has space' }).ok).toBe(false);
    expect(validateSettingsPatch({ 'storefront.home_hero_product_slug': '/product/x' }).ok).toBe(false);
    expect(validateSettingsPatch({ 'storefront.home_hero_product_slug': 'x'.repeat(121) }).ok).toBe(false);
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

describe('url (https:// or same-origin path; blank = unset)', () => {
  it('accepts blank, https and /uploads paths; keeps the value verbatim', () => {
    const blank = validateSettingsPatch({ 'storefront.hero_image_url': '  ' });
    expect(blank.ok).toBe(true);
    if (blank.ok) expect(blank.value['storefront.hero_image_url']).toBe('');
    const https = validateSettingsPatch({ 'brand.logo_url': ' https://media.example.com/logo.png ' });
    expect(https.ok).toBe(true);
    if (https.ok) expect(https.value['brand.logo_url']).toBe('https://media.example.com/logo.png');
    const local = validateSettingsPatch({ 'brand.og_image_url': '/uploads/og.png' });
    expect(local.ok).toBe(true);
  });

  it('rejects http://, javascript:, protocol-relative and junk', () => {
    expect(validateSettingsPatch({ 'brand.social_instagram': 'http://instagram.com/x' }).ok).toBe(false);
    expect(validateSettingsPatch({ 'brand.social_instagram': 'javascript:alert(1)' }).ok).toBe(false);
    expect(validateSettingsPatch({ 'brand.social_instagram': '//evil.example' }).ok).toBe(false);
    expect(normalizeSettingUrl('not a url')).toBeNull();
    expect(normalizeSettingUrl('x'.repeat(2049))).toBeNull();
  });
});

describe('hex (#RRGGBB; blank = pack colour)', () => {
  it('accepts blank and #RRGGBB (uppercased), rejects shorthand and names', () => {
    const blank = validateSettingsPatch({ 'brand.theme.ink': '' });
    expect(blank.ok).toBe(true);
    if (blank.ok) expect(blank.value['brand.theme.ink']).toBe('');
    const ok = validateSettingsPatch({ 'brand.theme.ink': ' #2a1d12 ' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value['brand.theme.ink']).toBe('#2A1D12');
    expect(validateSettingsPatch({ 'brand.theme.ink': '#fff' }).ok).toBe(false);
    expect(validateSettingsPatch({ 'brand.theme.ink': 'red' }).ok).toBe(false);
    expect(validateSettingsPatch({ 'brand.theme.ink': 'url(x)' }).ok).toBe(false);
  });
});

describe('json-list (announcement segments)', () => {
  it('accepts an array or newline-separated text, trimming and dropping blank lines', () => {
    const arr = validateSettingsPatch({ 'storefront.announcement_segments': [' Free shipping ', 'Small batches'] });
    expect(arr.ok).toBe(true);
    if (arr.ok) expect(arr.value['storefront.announcement_segments']).toEqual(['Free shipping', 'Small batches']);
    const text = validateSettingsPatch({ 'storefront.announcement_segments': 'One\n\n  Two  \r\nThree' });
    expect(text.ok).toBe(true);
    if (text.ok) expect(text.value['storefront.announcement_segments']).toEqual(['One', 'Two', 'Three']);
  });

  it('enforces the item count and line length; rejects non-string items', () => {
    expect(validateSettingsPatch({ 'storefront.announcement_segments': [] }).ok).toBe(false);
    expect(validateSettingsPatch({ 'storefront.announcement_segments': Array(7).fill('x') }).ok).toBe(false);
    expect(validateSettingsPatch({ 'storefront.announcement_segments': ['y'.repeat(81)] }).ok).toBe(false);
    expect(validateSettingsPatch({ 'storefront.announcement_segments': [1, 2] }).ok).toBe(false);
    expect(validateSettingsPatch({ 'storefront.announcement_segments': 42 }).ok).toBe(false);
  });
});

describe('day-range (SLA windows as printed)', () => {
  it('accepts "N" and "N–M", normalising a hyphen to an en dash', () => {
    expect(normalizeDayRange('2')).toBe('2');
    expect(normalizeDayRange(' 1-2 ')).toBe('1–2');
    expect(normalizeDayRange('5 – 7')).toBe('5–7');
    const r = validateSettingsPatch({ 'policy.refund_sla_days': '5-7' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value['policy.refund_sla_days']).toBe('5–7');
    const n = validateSettingsPatch({ 'policy.dispatch_sla_days': 2 });
    expect(n.ok).toBe(true);
    if (n.ok) expect(n.value['policy.dispatch_sla_days']).toBe('2');
  });

  it('rejects backwards ranges, words and empty values', () => {
    expect(normalizeDayRange('7–5')).toBeNull();
    expect(normalizeDayRange('two')).toBeNull();
    expect(normalizeDayRange('')).toBeNull();
    expect(validateSettingsPatch({ 'policy.delivery_eta_days': '3-1' }).ok).toBe(false);
  });
});

describe('optional email / phone (ops alerts)', () => {
  it('stores blank as "" for optional fields but still validates a value', () => {
    const blank = validateSettingsPatch({ 'ops.alert_email': '', 'ops.alert_phone': ' ' });
    expect(blank.ok).toBe(true);
    if (blank.ok) {
      expect(blank.value['ops.alert_email']).toBe('');
      expect(blank.value['ops.alert_phone']).toBe('');
    }
    expect(validateSettingsPatch({ 'ops.alert_email': 'nope' }).ok).toBe(false);
    expect(validateSettingsPatch({ 'ops.alert_phone': '12345' }).ok).toBe(false);
  });

  it('the support contacts stay required (blank rejected)', () => {
    expect(validateSettingsPatch({ support_email: '' }).ok).toBe(false);
    expect(validateSettingsPatch({ support_phone: '' }).ok).toBe(false);
  });
});
