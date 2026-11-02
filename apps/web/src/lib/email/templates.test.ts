/**
 * Unit tests for the transactional email templates + provider selection
 * (launch-gate). DB-free and provider-free: the templates are pure, and the
 * provider selection only reads env. Two guarantees under test:
 *
 *   1. Attacker-controlled fields (gift message, customer name, product name)
 *      are HTML-ENCODED in the rendered body — no raw `<script>` survives.
 *   2. Money totals render through `formatPaise` (the ₹ INR display form).
 *   3. `getEmailProvider()` selects the FakeEmailProvider when no RESEND_API_KEY
 *      is configured (so prod-without-a-key never silently no-ops as the fake,
 *      but local/test always resolves to the in-memory provider).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  esc,
  orderCancelledEmail,
  orderConfirmationEmail,
  orderFulfilmentEmail,
  wrapEmailBody,
  type EmailIdentityModel,
  type OrderEmailModel,
} from './templates';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const XSS = '<script>alert(1)</script>';

/** A non-KAKOA identity so brand leaks into the templates are caught. */
const ID: EmailIdentityModel = {
  brandName: 'ACME',
  subjectSuffix: ' · ACME',
  supportEmail: 'care@acme.test',
  legalName: 'Acme Foods Private Limited',
  legalAddress: '1 Market Road, Ahmedabad 380001, Gujarat, India',
  fssaiLicense: '10025023000841',
  footerTagline: 'Baked fresh weekly',
  unitNoun: { one: 'loaf', many: 'loaves' },
  theme: { ink: '#111111', cream: '#fffdf7', muted: '#777777', line: '#dddddd', card: '#ffffff' },
};

function model(overrides: Partial<OrderEmailModel> = {}): OrderEmailModel {
  return {
    orderNumber: 'KK-48210',
    paymentMode: 'prepaid',
    placedAt: new Date('2026-07-04T12:30:00.000Z'),
    items: [
      {
        productName: 'Dark Truffle Box',
        variantName: 'Box of 12',
        quantity: 2,
        lineTotalPaise: 111000,
        giftMessage: XSS,
      },
    ],
    subtotalPaise: 111000,
    discountPaise: 10000,
    shippingFeePaise: 5000,
    codFeePaise: 0,
    giftWrapTotalPaise: 3000,
    totalPaise: 109000,
    shippingAddress: {
      fullName: 'Aditi Rao',
      line1: '12 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400020',
    },
    trackUrl:
      'https://kakao.example/account/track?order=KK-48210&accessToken=tok',
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* esc()                                                              */
/* ------------------------------------------------------------------ */

describe('esc', () => {
  it('encodes all five HTML-significant characters', () => {
    expect(esc(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
  it('encodes & first so entities are not double-mangled', () => {
    expect(esc('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });
});

/* ------------------------------------------------------------------ */
/* orderConfirmationEmail                                             */
/* ------------------------------------------------------------------ */

describe('orderConfirmationEmail', () => {
  it('escapes the attacker-controlled gift message (no raw <script>)', () => {
    const { html } = orderConfirmationEmail(model(), ID);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes product name and customer name', () => {
    const { html } = orderConfirmationEmail(
      model({
        items: [
          {
            productName: XSS,
            variantName: 'v',
            quantity: 1,
            lineTotalPaise: 1000,
            giftMessage: null,
          },
        ],
        shippingAddress: {
          fullName: XSS,
          line1: 'x',
          city: 'c',
          state: 's',
          pincode: '400001',
        },
      }),
      ID,
    );
    expect(html).not.toContain('<script>');
  });

  it('formats every money figure via formatPaise (₹ + Indian grouping)', () => {
    const { html } = orderConfirmationEmail(model(), ID);
    expect(html).toContain('₹1,110.00'); // subtotal / line total (111000 paise)
    expect(html).toContain('₹1,090.00'); // grand total (109000 paise)
    expect(html).toContain('-₹100.00'); // discount 10000 paise, negated
  });

  it('uses "Payment received" for prepaid and "Order placed" for COD', () => {
    expect(orderConfirmationEmail(model({ paymentMode: 'prepaid' }), ID).subject).toContain(
      'Payment received',
    );
    const cod = orderConfirmationEmail(model({ paymentMode: 'cod' }), ID);
    expect(cod.subject).toContain('Order placed');
    expect(cod.text).toContain('confirm the details by phone');
  });

  it('embeds the tracking link and order number', () => {
    const { html, text } = orderConfirmationEmail(model(), ID);
    expect(html).toContain(
      'https://kakao.example/account/track?order=KK-48210&amp;accessToken=tok',
    );
    expect(text).toContain(
      'https://kakao.example/account/track?order=KK-48210&accessToken=tok',
    );
    expect(html).toContain('KK-48210');
  });

  it('omits zero add-on rows (no COD fee line when 0)', () => {
    const { html } = orderConfirmationEmail(model({ codFeePaise: 0 }), ID);
    expect(html).not.toContain('COD fee');
  });
});

/* ------------------------------------------------------------------ */
/* orderCancelledEmail                                               */
/* ------------------------------------------------------------------ */

describe('orderCancelledEmail', () => {
  it('renders a cancellation subject and escapes dynamic fields', () => {
    const { subject, html } = orderCancelledEmail(
      model({
        items: [
          {
            productName: XSS,
            variantName: 'v',
            quantity: 1,
            lineTotalPaise: 1000,
            giftMessage: XSS,
          },
        ],
      }),
      ID,
    );
    expect(subject).toContain('cancelled');
    expect(html).not.toContain('<script>');
  });

  it('mentions a refund for prepaid and no charge for COD', () => {
    expect(orderCancelledEmail(model({ paymentMode: 'prepaid' }), ID).text).toContain(
      'refunded',
    );
    expect(orderCancelledEmail(model({ paymentMode: 'cod' }), ID).text).toContain(
      'nothing was charged',
    );
  });
});

/* ------------------------------------------------------------------ */
/* Identity — nothing brand-shaped is hardcoded                       */
/* ------------------------------------------------------------------ */

describe('brand identity', () => {
  it('paints the wordmark, subject suffix, support email and legal footer from the identity', () => {
    const { subject, html } = orderConfirmationEmail(model(), ID);
    expect(subject).toBe('Payment received — order KK-48210 · ACME');
    expect(html).toContain('>ACME</span>');
    expect(html).toContain('mailto:care@acme.test');
    expect(html).toContain('Acme Foods Private Limited &middot; 1 Market Road');
    expect(html).toContain('FSSAI Lic. 10025023000841 &middot; Baked fresh weekly');
    expect(html).toContain('#111111'); // theme ink, not the KAKOA default
    expect(html).not.toMatch(/KAKOA|kakoa|Kakao|1a1a1a/);
  });

  it('omits the legal + licence lines when the identity is not configured', () => {
    const bare: EmailIdentityModel = {
      ...ID,
      legalName: null,
      legalAddress: null,
      fssaiLicense: null,
      footerTagline: null,
    };
    const { html } = orderConfirmationEmail(model(), bare);
    expect(html).not.toContain('Acme Foods');
    expect(html).not.toContain('FSSAI');
    expect(html).toContain('This is an automated message about your order.');
  });

  it('interpolates the brand name into fulfilment ledes and subjects', () => {
    const shipped = orderFulfilmentEmail(
      { orderNumber: 'KK-48210', customerName: 'Aditi', stage: 'shipped', awb: null, courierName: null, etaText: null, trackUrl: 'https://x.test/t' },
      ID,
    );
    expect(shipped.subject).toBe('Shipped — order KK-48210 is on its way · ACME');
    expect(shipped.text).toContain('your ACME box has shipped');
    const delivered = orderFulfilmentEmail(
      { orderNumber: 'KK-48210', customerName: 'Aditi', stage: 'delivered', awb: 'AWB1', courierName: 'Mock', etaText: null, trackUrl: 'https://x.test/t' },
      ID,
    );
    expect(delivered.subject).toBe('Delivered — order KK-48210 · ACME');
    expect(delivered.html).toContain('Your ACME order has been delivered');
  });

  it('wraps an override body in the same identity shell', () => {
    const html = wrapEmailBody('Hi &lt;b&gt;', ID);
    expect(html).toContain('Hi &lt;b&gt;');
    expect(html).toContain('>ACME</span>');
    expect(html).toContain('care@acme.test');
  });

  it('escapes identity strings (an owner-entered legal name cannot inject markup)', () => {
    const { html } = orderCancelledEmail(model(), { ...ID, legalName: XSS, brandName: 'A<B' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A&lt;B');
  });
});

/* ------------------------------------------------------------------ */
/* Provider selection                                                */
/* ------------------------------------------------------------------ */

describe('getEmailProvider', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.BRAND_KEY = 'kakoa';
    process.env.DATABASE_URL = 'postgres://u:p@localhost:5432/db';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://kakao.example';
    process.env.OTP_PEPPER = 'x'.repeat(32);
    process.env.SESSION_SECRET = 'y'.repeat(32);
    process.env.APP_ENV = 'local';
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('selects the FakeEmailProvider when no RESEND_API_KEY is set', async () => {
    const { getEmailProvider, resetEmailProvider, FakeEmailProvider } =
      await import('@kakoa/integrations');
    resetEmailProvider();
    expect(getEmailProvider()).toBeInstanceOf(FakeEmailProvider);
    resetEmailProvider();
  });

  it('the fake provider records the email and returns a fake id', async () => {
    const {
      getEmailProvider,
      resetEmailProvider,
      getSentEmails,
      clearSentEmails,
    } = await import('@kakoa/integrations');
    resetEmailProvider();
    clearSentEmails();
    const before = getSentEmails().length;
    const res = await getEmailProvider().send({
      to: 'a@b.com',
      subject: 'hi',
      html: '<p>hi</p>',
      idempotencyKey: 'order-confirm-1',
    });
    expect(res.providerMessageId).toMatch(/^fake-/);
    expect(getSentEmails().length).toBe(before + 1);
    resetEmailProvider();
    clearSentEmails();
  });
});
