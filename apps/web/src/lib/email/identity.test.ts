/**
 * The email identity (identity-model.ts, pure) joins the brand pack with store_settings: the trade name,
 * suffix and palette are the pack's; the legal footer is store_settings-only
 * (null, never a default, until configured).
 */
import { describe, expect, it } from 'vitest';
import { buildEmailIdentity } from './identity-model';
import { orderCancelledEmail, type OrderEmailModel } from './templates';

const LEGAL = new Map<string, unknown>([
  ['seller_legal_name', 'Kakao Chocolates Private Limited'],
  ['seller_gstin', '27AABCK4321M1Z5'],
  ['seller_state_code', '27'],
  ['seller_address', 'Unit 12, Veera Desai Industrial Estate, Andheri West, Mumbai 400053, Maharashtra, India'],
  ['origin_pincode', '400053'],
  ['fssai_license_number', '11525023000841'],
  ['support_email', 'help@example.com'],
]);

describe('buildEmailIdentity', () => {
  it('takes the trade name, suffix, tagline and palette from the pack', () => {
    const id = buildEmailIdentity(LEGAL);
    expect(id.brandName).toBe('KAKOA');
    expect(id.subjectSuffix).toBe(' · KAKOA');
    expect(id.footerTagline).toBe('Handcrafted in small batches');
    expect(id.theme.ink).toBe('#1a1a1a');
    // The vertical's unit noun rides along so the delivered lede never hardcodes "piece".
    expect(id.unitNoun).toEqual({ one: 'piece', many: 'pieces' });
    expect(id.supportEmail).toBe('help@example.com');
  });

  it('carries the configured legal lines from store_settings', () => {
    const id = buildEmailIdentity(LEGAL);
    expect(id.legalName).toBe('Kakao Chocolates Private Limited');
    expect(id.legalAddress).toMatch(/Mumbai 400053/);
    expect(id.fssaiLicense).toBe('11525023000841');
  });

  it('leaves the legal lines null (and falls back only for support email) when unconfigured', () => {
    const id = buildEmailIdentity(new Map());
    expect(id.legalName).toBeNull();
    expect(id.legalAddress).toBeNull();
    expect(id.fssaiLicense).toBeNull();
    // Support email is the brand's OWN default — not legal identity.
    expect(id.supportEmail).toBe('support@kakoa.in');
  });

  it('a partially configured identity is treated as unconfigured (no half footer)', () => {
    const rows = new Map(LEGAL);
    rows.delete('seller_gstin');
    const id = buildEmailIdentity(rows);
    expect(id.legalName).toBeNull();
    expect(id.fssaiLicense).toBeNull();
  });

  it('renders into the shell: footer shows the legal line only when configured', () => {
    const model: OrderEmailModel = {
      orderNumber: 'KK-48210',
      paymentMode: 'cod',
      placedAt: new Date('2026-07-04T12:30:00.000Z'),
      items: [],
      subtotalPaise: 0,
      discountPaise: 0,
      shippingFeePaise: 0,
      codFeePaise: 0,
      giftWrapTotalPaise: 0,
      totalPaise: 0,
      shippingAddress: { fullName: 'A', line1: 'x', city: 'c', state: 's', pincode: '400001' },
      trackUrl: 'https://example.test/t',
    };
    const configured = orderCancelledEmail(model, buildEmailIdentity(LEGAL)).html;
    expect(configured).toContain('Kakao Chocolates Private Limited');
    expect(configured).toContain('FSSAI Lic. 11525023000841');
    expect(configured).toContain('help@example.com');

    const bare = orderCancelledEmail(model, buildEmailIdentity(new Map())).html;
    expect(bare).not.toContain('Kakao Chocolates');
    expect(bare).not.toContain('11525023000841');
    expect(bare).toContain('support@kakoa.in');
    expect(bare).toContain('Handcrafted in small batches');
  });
});
