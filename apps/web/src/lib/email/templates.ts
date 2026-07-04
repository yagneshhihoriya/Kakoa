/**
 * Transactional email templates — KAKAO brand voice (storefront launch-gate).
 *
 * Pure render functions: `(model) → { subject, html, text }`. No DB, no env, no
 * I/O — so they are trivially unit-testable and `send.ts` owns all data loading.
 *
 * Design constraints:
 *   - Inline styles only (email clients strip <style> / external CSS).
 *   - Mobile-safe: a single centered table, max-width 600, fluid below that.
 *   - Ink/cream palette (matches the storefront): ink #1a1a1a on cream #faf7f2.
 *   - SECURITY: every attacker-influenced string (customer name, gift message,
 *     product/variant names, address) is HTML-ENCODED via `esc()` before it is
 *     interpolated into the HTML body. Order totals/dates come from trusted
 *     formatters. This email is an untrusted-input sink; unescaped interpolation
 *     would be a stored-XSS / markup-injection vector.
 */
import { formatIST, formatPaise } from '@kakoa/core';

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
/* Palette + shared chrome                                             */
/* ------------------------------------------------------------------ */

const INK = '#1a1a1a';
const CREAM = '#faf7f2';
const MUTED = '#6b6b6b';
const LINE = '#e6ddd1';
const CARD = '#ffffff';

/** Outer wrapper: cream page → centered 600px card. */
function shell(inner: string): string {
  return `<!-- KAKAO transactional email -->
<div style="margin:0;padding:0;background:${CREAM};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${CARD};border:1px solid ${LINE};border-radius:12px;overflow:hidden;font-family:Georgia,'Times New Roman',serif;color:${INK};">
          <tr>
            <td style="padding:28px 32px 8px 32px;text-align:center;">
              <span style="font-size:22px;letter-spacing:6px;font-weight:700;color:${INK};">KAKAO</span>
            </td>
          </tr>
          ${inner}
          <tr>
            <td style="padding:24px 32px 32px 32px;border-top:1px solid ${LINE};text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};font-family:Arial,Helvetica,sans-serif;">
                KAKAO &middot; Handcrafted in India<br/>
                This is an automated message about your order. No reply is needed.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
}

/** A body paragraph in the sans stack (better email rendering than serif). */
function para(html: string): string {
  return `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${INK};font-family:Arial,Helvetica,sans-serif;">${html}</p>`;
}

/** One money row of the totals block. `strong` bolds the grand total. */
function totalRow(label: string, valuePaise: number, strong = false): string {
  const weight = strong ? '700' : '400';
  const size = strong ? '16px' : '14px';
  return `<tr>
    <td style="padding:6px 0;font-size:${size};font-weight:${weight};color:${INK};font-family:Arial,Helvetica,sans-serif;">${esc(label)}</td>
    <td align="right" style="padding:6px 0;font-size:${size};font-weight:${weight};color:${INK};font-family:Arial,Helvetica,sans-serif;">${formatPaise(valuePaise)}</td>
  </tr>`;
}

/** Item lines table — product/variant/gift text is escaped; totals formatted. */
function itemsTable(items: OrderEmailItem[]): string {
  const rows = items
    .map((item) => {
      const name = esc(item.productName);
      const variant = esc(item.variantName);
      const gift =
        item.giftMessage !== null && item.giftMessage.trim() !== ''
          ? `<div style="margin-top:4px;font-size:12px;font-style:italic;color:${MUTED};font-family:Arial,Helvetica,sans-serif;">Gift note: &ldquo;${esc(item.giftMessage)}&rdquo;</div>`
          : '';
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK};font-family:Arial,Helvetica,sans-serif;">
          <div style="font-weight:600;">${name}</div>
          <div style="font-size:12px;color:${MUTED};">${variant} &middot; Qty ${String(item.quantity)}</div>
          ${gift}
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK};font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">
          ${formatPaise(item.lineTotalPaise)}
        </td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

/** Snapshotted delivery address block (all fields escaped). */
function addressBlock(a: OrderEmailAddress): string {
  const parts = [
    esc(a.fullName),
    esc(a.line1),
    a.line2 !== undefined && a.line2 !== '' ? esc(a.line2) : null,
    a.landmark !== undefined && a.landmark !== '' ? esc(a.landmark) : null,
    `${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}`,
  ].filter((p): p is string => p !== null);
  return `<div style="font-size:14px;line-height:1.6;color:${INK};font-family:Arial,Helvetica,sans-serif;">${parts.join('<br/>')}</div>`;
}

/** The full totals block (subtotal → grand total), skipping zero add-ons. */
function totalsBlock(m: OrderEmailModel): string {
  const rows = [totalRow('Subtotal', m.subtotalPaise)];
  if (m.discountPaise > 0) rows.push(totalRow('Discount', -m.discountPaise));
  rows.push(totalRow('Shipping', m.shippingFeePaise));
  if (m.giftWrapTotalPaise > 0)
    rows.push(totalRow('Gift wrap', m.giftWrapTotalPaise));
  if (m.codFeePaise > 0) rows.push(totalRow('COD fee', m.codFeePaise));
  rows.push(
    `<tr><td colspan="2" style="padding:6px 0;border-top:1px solid ${LINE};"></td></tr>`,
  );
  rows.push(totalRow('Total', m.totalPaise, true));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>`;
}

/** Centered ink "Track your order" button. */
function trackButton(trackUrl: string): string {
  // The URL is app-composed (site url + query) — safe to attribute-encode.
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 0 auto;">
    <tr>
      <td align="center" style="border-radius:8px;background:${INK};">
        <a href="${esc(trackUrl)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:${CREAM};text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Track your order</a>
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
export function orderConfirmationEmail(m: OrderEmailModel): RenderedEmail {
  const paid = m.paymentMode === 'prepaid';
  const headline = paid ? 'Payment received' : 'Order placed';
  const lede = paid
    ? `Thank you — your payment is in and your order is confirmed. We're getting it ready with care.`
    : `Thank you — your order is placed. We'll confirm the details by phone shortly, then get it ready with care.`;
  const subject = `${headline} — order ${m.orderNumber} · KAKAO`;

  const inner = `
    <tr>
      <td style="padding:8px 32px 24px 32px;">
        <h1 style="margin:16px 0 4px 0;font-size:24px;font-weight:700;color:${INK};font-family:Georgia,'Times New Roman',serif;text-align:center;">${esc(headline)}</h1>
        <p style="margin:0 0 20px 0;font-size:13px;color:${MUTED};text-align:center;font-family:Arial,Helvetica,sans-serif;">Order ${esc(m.orderNumber)} &middot; ${esc(formatIST(m.placedAt))}</p>
        ${para(esc(m.shippingAddress.fullName) + ',')}
        ${para(lede)}
        ${itemsTable(m.items)}
        <div style="height:20px;"></div>
        ${totalsBlock(m)}
        <div style="height:28px;"></div>
        <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${MUTED};font-family:Arial,Helvetica,sans-serif;">Delivering to</p>
        ${addressBlock(m.shippingAddress)}
        <div style="height:28px;"></div>
        ${trackButton(m.trackUrl)}
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

  return { subject, html: shell(inner), text };
}

/* ------------------------------------------------------------------ */
/* Order cancellation                                                  */
/* ------------------------------------------------------------------ */

/**
 * "Your order was cancelled" — sent after a customer cancellation. A prepaid
 * refund note is added by copy only (the refund itself is the payments module).
 */
export function orderCancelledEmail(m: OrderEmailModel): RenderedEmail {
  const subject = `Order ${m.orderNumber} cancelled · KAKAO`;
  const refundLine =
    m.paymentMode === 'prepaid'
      ? `Any amount paid will be refunded to your original payment method — this usually takes 5–7 business days.`
      : `As this was a Cash on Delivery order, nothing was charged.`;

  const inner = `
    <tr>
      <td style="padding:8px 32px 24px 32px;">
        <h1 style="margin:16px 0 4px 0;font-size:24px;font-weight:700;color:${INK};font-family:Georgia,'Times New Roman',serif;text-align:center;">Order cancelled</h1>
        <p style="margin:0 0 20px 0;font-size:13px;color:${MUTED};text-align:center;font-family:Arial,Helvetica,sans-serif;">Order ${esc(m.orderNumber)} &middot; ${esc(formatIST(m.placedAt))}</p>
        ${para(esc(m.shippingAddress.fullName) + ',')}
        ${para(`We've cancelled order <strong>${esc(m.orderNumber)}</strong> as requested. ${esc(refundLine)}`)}
        ${itemsTable(m.items)}
        <div style="height:20px;"></div>
        ${totalsBlock(m)}
        <div style="height:24px;"></div>
        ${para(`Changed your mind? You're always welcome back at KAKAO.`)}
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

  return { subject, html: shell(inner), text };
}
