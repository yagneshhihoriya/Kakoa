/**
 * The legal identity has NO code default: a missing store_settings row must
 * surface as "not configured", never as another brand's value.
 */
import { describe, expect, it } from 'vitest';
import {
  LEGAL_IDENTITY_KEYS,
  legalIdentityMessage,
  resolveLegalIdentity,
} from './legal-identity';

const FULL = new Map<string, unknown>([
  ['seller_legal_name', 'Acme Foods Private Limited'],
  ['seller_gstin', '24AAACA1234A1Z5'],
  ['seller_state_code', '24'],
  ['seller_address', '1 Market Road, Ahmedabad 380001, Gujarat, India'],
  ['origin_pincode', '380001'],
  ['fssai_license_number', '10025023000841'],
  ['support_email', 'ignored@example.com'],
]);

describe('resolveLegalIdentity', () => {
  it('is configured when every legal key has a non-empty row (extra keys ignored)', () => {
    const r = resolveLegalIdentity(FULL);
    expect(r.configured).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.legalName).toBe('Acme Foods Private Limited');
    expect(r.gstin).toBe('24AAACA1234A1Z5');
    expect(r.stateCode).toBe('24');
    expect(r.originPincode).toBe('380001');
    expect(r.fssai).toBe('10025023000841');
  });

  it('reports every missing key and renders the missing values as empty — no brand default', () => {
    const r = resolveLegalIdentity(new Map());
    expect(r.configured).toBe(false);
    expect(r.missing).toEqual([...LEGAL_IDENTITY_KEYS]);
    expect(r.gstin).toBe('');
    expect(r.legalName).toBe('');
    expect(JSON.stringify(r)).not.toContain('27AABCK4321M1Z5');
    expect(JSON.stringify(r)).not.toContain('Kakao');
  });

  it('treats an empty / whitespace / non-string row as missing', () => {
    const rows = new Map<string, unknown>(FULL);
    rows.set('seller_gstin', '   ');
    rows.set('fssai_license_number', true);
    const r = resolveLegalIdentity(rows);
    expect(r.configured).toBe(false);
    expect(r.missing).toEqual(['seller_gstin', 'fssai_license_number']);
    expect(r.gstin).toBe('');
    // The present keys still come through verbatim.
    expect(r.stateCode).toBe('24');
  });

  it('builds an operator message naming the missing fields', () => {
    expect(legalIdentityMessage(['seller_gstin', 'seller_state_code'])).toBe(
      'Legal identity not configured — set GSTIN, GST state code in Admin → Settings (Business identity / Legal).',
    );
  });
});
