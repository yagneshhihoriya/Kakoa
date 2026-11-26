/**
 * Transactional email templates (storefront launch-gate).
 *
 * Pure render functions: `(model, identity) → { subject, html, text }`. No DB,
 * no env, no I/O — so they are trivially unit-testable and `send.ts` owns all
 * data loading. The brand is NOT imported here either: everything brand-shaped
 * (wordmark, subject suffix, support email, legal footer, palette) arrives in
 * the `EmailIdentityModel` that lib/email/identity.ts assembles from the brand
 * pack + store_settings.
 *
 * Design constraints:
 *   - Inline styles only (email clients strip <style> / external CSS).
 *   - Mobile-safe: a single centered table, max-width 600, fluid below that.
 *   - Palette from the brand pack's `email.theme` (clients cannot read CSS vars).
 *   - SECURITY: every attacker-influenced string (customer name, gift message,
 *     product/variant names, address) is HTML-ENCODED via `esc()` before it is
 *     interpolated into the HTML body. Order totals/dates come from trusted
 *     formatters. This email is an untrusted-input sink; unescaped interpolation
 *     would be a stored-XSS / markup-injection vector.
 */
import { formatIST, formatPaise } from '@kakoa/core';
import type { BrandEmailCopy, BrandEmailTheme } from '@/brands/contract';

/* ------------------------------------------------------------------ */
/* Identity — who the email is from (brand pack + store_settings)      */
/* ------------------------------------------------------------------ */

/**
 * Everything brand-shaped a template needs. Assembled by
 * `lib/email/identity.ts` (server) — the legal lines come from store_settings
 * and are `null` until the owner configures them, in which case the footer
 * simply omits them (never another brand's details).
 */
export interface EmailIdentityModel {
  /** Trade name — the wordmark and copy such as "your KAKOA box". */
  brandName: string;
  /** Appended to every transactional subject, e.g. ' · KAKOA'. */
  subjectSuffix: string;
  /** Where "Questions about your order?" points. */
  supportEmail: string;
  /** Registered legal name + address line for the footer; null when not configured. */
  legalName: string | null;
  legalAddress: string | null;
  /** FSSAI licence for the footer; null when not configured. */
  fssaiLicense: string | null;
  /** Short brand line after the licence (pack copy); null omits it. */
  footerTagline: string | null;
  /** What one unit of the product is called ('piece', 'pack') — vertical vocabulary. */
  unitNoun: { one: string; many: string };
  theme: BrandEmailTheme;
  /** The pack's opening lines per mail (lib/email/identity-model.ts fills it). */
  copy: BrandEmailCopy;
}

/* ------------------------------------------------------------------ */
/* Model — assembled by send.ts from the order + items rows            */
/* ------------------------------------------------------------------ */

export interface OrderEmailItem {
  productName: string;
  variantName: string;
  quantity: number;
  /** Line total in paise (unit × qty + gift wrap), GST-inclusive. */
  lineTotalPaise: number;
  giftMessage: string | null;
}

export interface OrderEmailAddress {
  fullName: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderEmailModel {
  orderNumber: string;
  /** 'prepaid' → "Payment received"; 'cod' → "Order placed" copy. */
  paymentMode: 'prepaid' | 'cod';
  placedAt: Date;
  items: OrderEmailItem[];
  subtotalPaise: number;
  discountPaise: number;
  shippingFeePaise: number;
  codFeePaise: number;
  giftWrapTotalPaise: number;
  totalPaise: number;
  shippingAddress: OrderEmailAddress;
  /** Absolute `${SITE_URL}/account/track?order=…&accessToken=…` tracking link. */
  trackUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/* HTML escaping — the single output-encoding sink                     */
/* ------------------------------------------------------------------ */

/**
 * Encode the five HTML-significant characters. Applied to EVERY dynamic string
 * placed into the HTML body (customer/gift/product/address text is
 * attacker-controllable). The order of replacements matters: `&` first.
 */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ */
/* Shared chrome                                                       */
/* ------------------------------------------------------------------ */

/** Outer wrapper: brand page colour → centered 600px card with the legal footer. */
function shell(inner: string, id: EmailIdentityModel): string {
  const t = id.theme;
  const legalLine =
    id.legalName !== null
      ? `${esc(id.legalName)}${id.legalAddress !== null ? ` &middot; ${esc(id.legalAddress)}` : ''}<br/>`
      : '';
  const licenceParts = [
    id.fssaiLicense !== null ? `FSSAI Lic. ${esc(id.fssaiLicense)}` : null,
    id.footerTagline !== null ? esc(id.footerTagline) : null,
  ].filter((part): part is string => part !== null);
  const licenceLine = licenceParts.length > 0 ? `${licenceParts.join(' &middot; ')}<br/>` : '';
  return `<!-- ${esc(id.brandName)} transactional email -->
<div style="margin:0;padding:0;background:${t.cream};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.cream};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${t.card};border:1px solid ${t.line};border-radius:12px;overflow:hidden;font-family:Georgia,'Times New Roman',serif;color:${t.ink};">
          <tr>
            <td style="padding:28px 32px 8px 32px;text-align:center;">
              <span style="font-size:22px;letter-spacing:6px;font-weight:700;color:${t.ink};">${esc(id.brandName)}</span>
            </td>
          </tr>
          ${inner}
          <tr>
            <td style="padding:24px 32px 32px 32px;border-top:1px solid ${t.line};text-align:center;">
              <p style="margin:0 0 8px 0;font-size:12.5px;line-height:1.6;color:${t.ink};font-family:Arial,Helvetica,sans-serif;">
                Questions about your order? Email
                <a href="mailto:${esc(id.supportEmail)}" style="color:${t.ink};font-weight:bold;text-decoration:underline;">${esc(id.supportEmail)}</a>
              </p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:${t.muted};font-family:Arial,Helvetica,sans-serif;">
                ${legalLine}${licenceLine}This is an automated message about your order.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
}

/**
 * Wrap an admin/override body (already HTML-escaped) in the brand shell. Blank
 * lines split paragraphs; single newlines become `<br/>`. Used by editable
 * notification-template overrides + the send-test so overridden copy still
 * renders in the brand chrome.
 */
export function wrapEmailBody(escapedBody: string, id: EmailIdentityModel): string {
  const paras = escapedBody
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== '')
    .map((block) => para(block.replace(/\n/g, '<br/>'), id.theme));
  const inner = `
    <tr>
      <td style="padding:8px 32px 24px 32px;">
        ${paras.join('\n')}
      </td>
    </tr>`;
  return shell(inner, id);
}

/** A body paragraph in the sans stack (better email rendering than serif). */
function para(html: string, t: BrandEmailTheme): string {
  return `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${t.ink};font-family:Arial,Helvetica,sans-serif;">${html}</p>`;
}

/** One money row of the totals block. `strong` bolds the grand total. */
function totalRow(label: string, valuePaise: number, t: BrandEmailTheme, strong = false): string {
  const weight = strong ? '700' : '400';
  const size = strong ? '16px' : '14px';
  return `<tr>
    <td style="padding:6px 0;font-size:${size};font-weight:${weight};color:${t.ink};font-family:Arial,Helvetica,sans-serif;">${esc(label)}</td>
    <td align="right" style="padding:6px 0;font-size:${size};font-weight:${weight};color:${t.ink};font-family:Arial,Helvetica,sans-serif;">${formatPaise(valuePaise)}</td>
  </tr>`;
}

/** Item lines table — product/variant/gift text is escaped; totals formatted. */
function itemsTable(items: OrderEmailItem[], t: BrandEmailTheme): string {
  const rows = items
    .map((item) => {
      const name = esc(item.productName);
      const variant = esc(item.variantName);
      const gift =
        item.giftMessage !== null && item.giftMessage.trim() !== ''
          ? `<div style="margin-top:4px;font-size:12px;font-style:italic;color:${t.muted};font-family:Arial,Helvetica,sans-serif;">Gift note: &ldquo;${esc(item.giftMessage)}&rdquo;</div>`
          : '';
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${t.line};font-size:14px;color:${t.ink};font-family:Arial,Helvetica,sans-serif;">
          <div style="font-weight:600;">${name}</div>
          <div style="font-size:12px;color:${t.muted};">${variant} &middot; Qty ${String(item.quantity)}</div>
          ${gift}
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${t.line};font-size:14px;color:${t.ink};font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">
          ${formatPaise(item.lineTotalPaise)}
        </td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

/** Snapshotted delivery address block (all fields escaped). */
function addressBlock(a: OrderEmailAddress, t: BrandEmailTheme): string {
  const parts = [
    esc(a.fullName),
    esc(a.line1),
    a.line2 !== undefined && a.line2 !== '' ? esc(a.line2) : null,
    a.landmark !== undefined && a.landmark !== '' ? esc(a.landmark) : null,
    `${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}`,
  ].filter((p): p is string => p !== null);
  return `<div style="font-size:14px;line-height:1.6;color:${t.ink};font-family:Arial,Helvetica,sans-serif;">${parts.join('<br/>')}</div>`;
}

/** The full totals block (subtotal → grand total), skipping zero add-ons. */
function totalsBlock(m: OrderEmailModel, t: BrandEmailTheme): string {
  const rows = [totalRow('Subtotal', m.subtotalPaise, t)];
  if (m.discountPaise > 0) rows.push(totalRow('Discount', -m.discountPaise, t));
  rows.push(totalRow('Shipping', m.shippingFeePaise, t));
  if (m.giftWrapTotalPaise > 0)
    rows.push(totalRow('Gift wrap', m.giftWrapTotalPaise, t));
  if (m.codFeePaise > 0) rows.push(totalRow('COD fee', m.codFeePaise, t));
  rows.push(
    `<tr><td colspan="2" style="padding:6px 0;border-top:1px solid ${t.line};"></td></tr>`,
  );
  rows.push(totalRow('Total', m.totalPaise, t, true));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>`;
}

/** Centered ink "Track your order" button. */
function trackButton(trackUrl: string, t: BrandEmailTheme): string {
  // The URL is app-composed (site url + query) — safe to attribute-encode.
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 0 auto;">
    <tr>
      <td align="center" style="border-radius:8px;background:${t.ink};">
        <a href="${esc(trackUrl)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:${t.cream};text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Track your order</a>
      </td>
    </tr>
  </table>`;
}

/* ------------------------------------------------------------------ */
/* Plain-text alternative (also escapes nothing — text/plain is inert) */
/* ------------------------------------------------------------------ */

function itemsText(items: OrderEmailItem[]): string {
  return items
    .map((i) => {
      const gift =
        i.giftMessage !== null && i.giftMessage.trim() !== ''
          ? `\n    Gift note: "${i.giftMessage}"`
          : '';
      return `  - ${i.productName} (${i.variantName}) x${String(i.quantity)}  ${formatPaise(i.lineTotalPaise)}${gift}`;
    })
    .join('\n');
}

function addressText(a: OrderEmailAddress): string {
  return [
    a.fullName,
    a.line1,
    a.line2 !== undefined && a.line2 !== '' ? a.line2 : null,
    a.landmark !== undefined && a.landmark !== '' ? a.landmark : null,
    `${a.city}, ${a.state} ${a.pincode}`,
  ]
    .filter((p): p is string => p !== null)
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* Order confirmation                                                  */
/* ------------------------------------------------------------------ */

/**
 * "We've got your order" — sent after placement (COD) / payment confirmation
 * (prepaid). Prepaid reads "Payment received"; COD reads "Order placed — we'll
 * confirm by phone" (COD orders are still `cod_pending_confirmation`).
 */
export function orderConfirmationEmail(m: OrderEmailModel, id: EmailIdentityModel): RenderedEmail {
  const t = id.theme;
  const paid = m.paymentMode === 'prepaid';
  const headline = paid ? 'Payment received' : 'Order placed';
  const lede = paid ? id.copy.confirmation.paidLede : id.copy.confirmation.codLede;
  const subject = `${headline} — order ${m.orderNumber}${id.subjectSuffix}`;

  const inner = `
    <tr>
      <td style="padding:8px 32px 24px 32px;">
        <h1 style="margin:16px 0 4px 0;font-size:24px;font-weight:700;color:${t.ink};font-family:Georgia,'Times New Roman',serif;text-align:center;">${esc(headline)}</h1>
        <p style="margin:0 0 20px 0;font-size:13px;color:${t.muted};text-align:center;font-family:Arial,Helvetica,sans-serif;">Order ${esc(m.orderNumber)} &middot; ${esc(formatIST(m.placedAt))}</p>
        ${para(esc(m.shippingAddress.fullName) + ',', t)}
        ${para(esc(lede), t)}
        ${itemsTable(m.items, t)}
        <div style="height:20px;"></div>
        ${totalsBlock(m, t)}
        <div style="height:28px;"></div>
        <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${t.muted};font-family:Arial,Helvetica,sans-serif;">Delivering to</p>
        ${addressBlock(m.shippingAddress, t)}
        <div style="height:28px;"></div>
        ${trackButton(m.trackUrl, t)}
      </td>
    </tr>`;

  const text = [
    `${headline} — order ${m.orderNumber}`,
    formatIST(m.placedAt),
    '',
    `${m.shippingAddress.fullName},`,
    lede.replace(/\s+/g, ' '),
    '',
    'Items:',
    itemsText(m.items),
    '',
    `Subtotal: ${formatPaise(m.subtotalPaise)}`,
    m.discountPaise > 0 ? `Discount: ${formatPaise(-m.discountPaise)}` : null,
    `Shipping: ${formatPaise(m.shippingFeePaise)}`,
    m.giftWrapTotalPaise > 0
      ? `Gift wrap: ${formatPaise(m.giftWrapTotalPaise)}`
      : null,
    m.codFeePaise > 0 ? `COD fee: ${formatPaise(m.codFeePaise)}` : null,
    `Total: ${formatPaise(m.totalPaise)}`,
    '',
    'Delivering to:',
    addressText(m.shippingAddress),
    '',
    `Track your order: ${m.trackUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return { subject, html: shell(inner, id), text };
}

/* ------------------------------------------------------------------ */
/* Order cancellation                                                  */
/* ------------------------------------------------------------------ */

/**
 * "Your order was cancelled" — sent after a customer cancellation. A prepaid
 * refund note is added by copy only (the refund itself is the payments module).
 */
export function orderCancelledEmail(m: OrderEmailModel, id: EmailIdentityModel): RenderedEmail {
  const t = id.theme;
  const subject = `Order ${m.orderNumber} cancelled${id.subjectSuffix}`;
  const refundLine =
    m.paymentMode === 'prepaid'
      ? `Any amount paid will be refunded to your original payment method — this usually takes 5–7 business days.`
      : `As this was a Cash on Delivery order, nothing was charged.`;

  const inner = `
    <tr>
      <td style="padding:8px 32px 24px 32px;">
        <h1 style="margin:16px 0 4px 0;font-size:24px;font-weight:700;color:${t.ink};font-family:Georgia,'Times New Roman',serif;text-align:center;">Order cancelled</h1>
        <p style="margin:0 0 20px 0;font-size:13px;color:${t.muted};text-align:center;font-family:Arial,Helvetica,sans-serif;">Order ${esc(m.orderNumber)} &middot; ${esc(formatIST(m.placedAt))}</p>
        ${para(esc(m.shippingAddress.fullName) + ',', t)}
        ${para(`We've cancelled order <strong>${esc(m.orderNumber)}</strong> as requested. ${esc(refundLine)}`, t)}
        ${itemsTable(m.items, t)}
        <div style="height:20px;"></div>
        ${totalsBlock(m, t)}
        <div style="height:24px;"></div>
        ${para(`Changed your mind? You're always welcome back at ${esc(id.brandName)}.`, t)}
      </td>
    </tr>`;

  const text = [
    `Order ${m.orderNumber} cancelled`,
    formatIST(m.placedAt),
    '',
    `${m.shippingAddress.fullName},`,
    `We've cancelled order ${m.orderNumber} as requested. ${refundLine}`,
    '',
    'Items:',
    itemsText(m.items),
    '',
    `Total: ${formatPaise(m.totalPaise)}`,
  ].join('\n');

  return { subject, html: shell(inner, id), text };
}

/* ------------------------------------------------------------------ */
/* Fulfilment updates (shipped / out for delivery / delivered)         */
/* ------------------------------------------------------------------ */

export type FulfilmentStage = 'shipped' | 'out_for_delivery' | 'delivered';

export interface FulfilmentEmailModel {
  orderNumber: string;
  customerName: string;
  stage: FulfilmentStage;
  /** Courier tracking number, once assigned. */
  awb: string | null;
  courierName: string | null;
  /** Human ETA line, e.g. "Expected by Fri, 10 Jul" (optional). */
  etaText: string | null;
  /** Absolute `${SITE_URL}/account/track?order=…&accessToken=…` link. */
  trackUrl: string;
}

/**
 * Stage headline + subject; the lede is the pack's (`id.copy.fulfilment`),
 * given the trade name and the vertical's unit noun. `n` is the order number,
 * `sfx` the subject suffix.
 */
const FULFILMENT_COPY: Record<
  FulfilmentStage,
  {
    headline: string;
    lede: (copy: BrandEmailCopy['fulfilment'], brand: string, unit: string) => string;
    subject: (n: string, sfx: string) => string;
  }
> = {
  shipped: {
    headline: 'Your order is on its way',
    lede: (copy, brand) => copy.shippedLede(brand),
    subject: (n, sfx) => `Shipped — order ${n} is on its way${sfx}`,
  },
  out_for_delivery: {
    headline: 'Out for delivery today',
    lede: (copy, brand) => copy.outForDeliveryLede(brand),
    subject: (n, sfx) => `Out for delivery — order ${n}${sfx}`,
  },
  delivered: {
    headline: 'Delivered — enjoy!',
    lede: (copy, brand, unit) => copy.deliveredLede(brand, unit),
    subject: (n, sfx) => `Delivered — order ${n}${sfx}`,
  },
};

/**
 * A fulfilment-stage update email (shipped / out-for-delivery / delivered) with
 * the AWB + courier + a track button. All dynamic strings are `esc()`-encoded.
 */
export function orderFulfilmentEmail(m: FulfilmentEmailModel, id: EmailIdentityModel): RenderedEmail {
  const t = id.theme;
  const copy = FULFILMENT_COPY[m.stage];
  const subject = copy.subject(m.orderNumber, id.subjectSuffix);
  const lede = copy.lede(id.copy.fulfilment, id.brandName, id.unitNoun.one);

  const courierLine =
    m.awb !== null && m.awb !== ''
      ? para(
          `Courier: <strong>${esc(m.courierName ?? 'Assigned')}</strong><br/>Tracking (AWB): <strong>${esc(m.awb)}</strong>${
            m.etaText !== null && m.etaText !== '' ? `<br/>${esc(m.etaText)}` : ''
          }`,
          t,
        )
      : '';

  const inner = `
    <tr>
      <td style="padding:8px 32px 24px 32px;">
        <h1 style="margin:16px 0 4px 0;font-size:24px;font-weight:700;color:${t.ink};font-family:Georgia,'Times New Roman',serif;text-align:center;">${esc(copy.headline)}</h1>
        <p style="margin:0 0 20px 0;font-size:13px;color:${t.muted};text-align:center;font-family:Arial,Helvetica,sans-serif;">Order ${esc(m.orderNumber)}</p>
        ${para(esc(m.customerName) + ',', t)}
        ${para(esc(lede), t)}
        ${courierLine}
        <div style="height:20px;"></div>
        ${trackButton(m.trackUrl, t)}
      </td>
    </tr>`;

  const text = [
    `${copy.headline} — order ${m.orderNumber}`,
    '',
    `${m.customerName},`,
    lede,
    m.awb !== null && m.awb !== ''
      ? `\nCourier: ${m.courierName ?? 'Assigned'}\nTracking (AWB): ${m.awb}${m.etaText ? `\n${m.etaText}` : ''}`
      : '',
    '',
    `Track your order: ${m.trackUrl}`,
  ].join('\n');

  return { subject, html: shell(inner, id), text };
}

/* ------------------------------------------------------------------ */
/* Admin new-order alert (ops inbox)                                   */
/* ------------------------------------------------------------------ */

export interface AdminNewOrderModel {
  orderNumber: string;
  paymentMode: 'prepaid' | 'cod';
  totalPaise: number;
  itemCount: number;
  city: string;
  /** Absolute admin order URL. */
  adminUrl: string;
}

/** A terse internal "new order" alert for the ops inbox (not customer-facing). */
export function adminNewOrderAlertEmail(m: AdminNewOrderModel, id: EmailIdentityModel): RenderedEmail {
  const t = id.theme;
  const subject = `New order ${m.orderNumber} — ${formatPaise(m.totalPaise)} (${m.paymentMode.toUpperCase()})`;
  const inner = `
    <tr>
      <td style="padding:8px 32px 24px 32px;">
        <h1 style="margin:16px 0 4px 0;font-size:22px;font-weight:700;color:${t.ink};font-family:Georgia,'Times New Roman',serif;text-align:center;">New order ${esc(m.orderNumber)}</h1>
        ${para(
          `<strong>${formatPaise(m.totalPaise)}</strong> &middot; ${esc(String(m.itemCount))} item${m.itemCount === 1 ? '' : 's'} &middot; ${esc(m.paymentMode.toUpperCase())}<br/>Ship to: ${esc(m.city)}`,
          t,
        )}
        <div style="height:12px;"></div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr><td align="center" style="border-radius:8px;background:${t.ink};">
            <a href="${esc(m.adminUrl)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:${t.cream};text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Open in admin</a>
          </td></tr>
        </table>
      </td>
    </tr>`;
  const text = [
    `New order ${m.orderNumber}`,
    `${formatPaise(m.totalPaise)} · ${String(m.itemCount)} item(s) · ${m.paymentMode.toUpperCase()}`,
    `Ship to: ${m.city}`,
    '',
    `Open in admin: ${m.adminUrl}`,
  ].join('\n');
  return { subject, html: shell(inner, id), text };
}
