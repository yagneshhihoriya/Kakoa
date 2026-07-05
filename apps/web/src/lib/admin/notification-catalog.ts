/**
 * Pure notification template catalog + renderer — NO @kakoa/db import, so it's
 * unit-testable and the single source of truth for: which (key, channel)
 * templates exist, their allowed `{{placeholders}}`, the code-default copy, and
 * the `{{placeholder}}` substitution (HTML-escaped for email, plain for SMS).
 *
 * The rich production emails (order confirmation etc.) are still rendered by
 * `lib/email/templates.ts`; THIS catalog's `defaultBody` is the editable
 * starting point an admin overrides, and the source for the live preview.
 */

export type NotificationChannel = 'email' | 'sms';

export interface TemplateCatalogEntry {
  key: string;
  channel: NotificationChannel;
  label: string;
  defaultSubject?: string;
  defaultBody: string;
  /** Allowed `{{placeholders}}` — a save is rejected if the body uses others. */
  placeholders: string[];
}

const COMMON = ['orderNumber', 'customerName', 'trackingUrl'];

export const TEMPLATE_CATALOG: readonly TemplateCatalogEntry[] = [
  {
    key: 'order_confirmed',
    channel: 'email',
    label: 'Order confirmed',
    defaultSubject: 'Payment received — order {{orderNumber}} · KAKAO',
    defaultBody:
      'Hi {{customerName}},\n\nThank you — your order {{orderNumber}} is confirmed and we\'re getting it ready with care.\n\nTrack it any time: {{trackingUrl}}',
    placeholders: [...COMMON, 'amount'],
  },
  {
    key: 'order_cancelled',
    channel: 'email',
    label: 'Order cancelled',
    defaultSubject: 'Order {{orderNumber}} cancelled · KAKAO',
    defaultBody:
      'Hi {{customerName}},\n\nWe\'ve cancelled order {{orderNumber}} as requested. Any amount paid is refunded to the original method.',
    placeholders: [...COMMON, 'amount'],
  },
  {
    key: 'order_shipped',
    channel: 'email',
    label: 'Order shipped',
    defaultSubject: 'Shipped — order {{orderNumber}} is on its way · KAKAO',
    defaultBody:
      'Hi {{customerName}},\n\nGood news — order {{orderNumber}} has shipped via {{courierName}} (AWB {{awb}}).\n\nTrack it: {{trackingUrl}}',
    placeholders: [...COMMON, 'awb', 'courierName', 'eta'],
  },
  {
    key: 'order_shipped',
    channel: 'sms',
    label: 'Order shipped',
    defaultBody:
      'KAKAO: Order {{orderNumber}} shipped via {{courierName}} (AWB {{awb}}). Track: {{trackingUrl}}',
    placeholders: [...COMMON, 'awb', 'courierName'],
  },
  {
    key: 'order_out_for_delivery',
    channel: 'email',
    label: 'Out for delivery',
    defaultSubject: 'Out for delivery — order {{orderNumber}} · KAKAO',
    defaultBody:
      'Hi {{customerName}},\n\nYour order {{orderNumber}} is out for delivery today. Track: {{trackingUrl}}',
    placeholders: [...COMMON],
  },
  {
    key: 'order_out_for_delivery',
    channel: 'sms',
    label: 'Out for delivery',
    defaultBody: 'KAKAO: Order {{orderNumber}} is out for delivery today. Track: {{trackingUrl}}',
    placeholders: [...COMMON],
  },
  {
    key: 'order_delivered',
    channel: 'email',
    label: 'Order delivered',
    defaultSubject: 'Delivered — order {{orderNumber}} · KAKAO',
    defaultBody:
      'Hi {{customerName}},\n\nOrder {{orderNumber}} has been delivered. We hope every piece is a delight!',
    placeholders: [...COMMON],
  },
  {
    key: 'order_delivered',
    channel: 'sms',
    label: 'Order delivered',
    defaultBody: 'KAKAO: Order {{orderNumber}} delivered. Enjoy! {{trackingUrl}}',
    placeholders: [...COMMON],
  },
];

export function catalogEntry(
  key: string,
  channel: string,
): TemplateCatalogEntry | undefined {
  return TEMPLATE_CATALOG.find((t) => t.key === key && t.channel === channel);
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** The distinct placeholder names used in a template string. */
export function extractPlaceholders(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    if (m[1] !== undefined) out.add(m[1]);
  }
  return [...out];
}

/** Placeholders used in `text` that are NOT in `allowed` (empty = valid). */
export function unknownPlaceholders(text: string, allowed: readonly string[]): string[] {
  const set = new Set(allowed);
  return extractPlaceholders(text).filter((p) => !set.has(p));
}

/** Minimal HTML escaping (order matters: `&` first) for email bodies. */
function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Substitute `{{placeholder}}` from `vars`. A missing/undefined var renders as
 * an empty string (documented). For email (`escapeHtml`), values are
 * HTML-escaped — the template chrome is trusted, the VALUES are not. SMS is plain.
 */
export function renderTemplate(
  text: string,
  vars: Record<string, string | number | null | undefined>,
  opts: { escapeHtml: boolean },
): string {
  return text.replace(PLACEHOLDER_RE, (_full, name: string) => {
    const raw = vars[name];
    const value = raw === null || raw === undefined ? '' : String(raw);
    return opts.escapeHtml ? escHtml(value) : value;
  });
}
