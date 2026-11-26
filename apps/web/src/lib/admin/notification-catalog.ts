/**
 * Pure notification template catalog + renderer — NO @kakoa/db import, so it's
 * unit-testable and the single source of truth for: which (key, channel)
 * templates exist, their allowed `{{placeholders}}`, the code-default copy, and
 * the `{{placeholder}}` substitution (HTML-escaped for email, plain for SMS).
 *
 * The rich production emails (order confirmation etc.) are still rendered by
 * `lib/email/templates.ts`; THIS catalog's `defaultBody` is the editable
 * starting point an admin overrides, and the source for the live preview. The
 * default copy, the subject suffix (' · <brand>') and the SMS prefix
 * ('<brand>: ') all come from the brand pack.
 */
import { brand } from '@/lib/brand';

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

/** ' · <brand>' on every email subject; '<brand>: ' leading every SMS. */
const { subjectSuffix: SFX, smsPrefix: SMS } = brand.profile.email;

/** The pack's default copy per `<key>.<channel>` (apps/web/src/brands/<key>/copy.ts). */
const COPY = brand.copy.notifications;

export const TEMPLATE_CATALOG: readonly TemplateCatalogEntry[] = [
  {
    key: 'order_confirmed',
    channel: 'email',
    label: 'Order confirmed',
    defaultSubject: `${COPY['order_confirmed.email'].subject}${SFX}`,
    defaultBody: COPY['order_confirmed.email'].body,
    placeholders: [...COMMON, 'amount'],
  },
  {
    key: 'order_cancelled',
    channel: 'email',
    label: 'Order cancelled',
    defaultSubject: `${COPY['order_cancelled.email'].subject}${SFX}`,
    defaultBody: COPY['order_cancelled.email'].body,
    placeholders: [...COMMON, 'amount'],
  },
  {
    key: 'order_shipped',
    channel: 'email',
    label: 'Order shipped',
    defaultSubject: `${COPY['order_shipped.email'].subject}${SFX}`,
    defaultBody: COPY['order_shipped.email'].body,
    placeholders: [...COMMON, 'awb', 'courierName', 'eta'],
  },
  {
    key: 'order_shipped',
    channel: 'sms',
    label: 'Order shipped',
    defaultBody: `${SMS}${COPY['order_shipped.sms'].body}`,
    placeholders: [...COMMON, 'awb', 'courierName'],
  },
  {
    key: 'order_out_for_delivery',
    channel: 'email',
    label: 'Out for delivery',
    defaultSubject: `${COPY['order_out_for_delivery.email'].subject}${SFX}`,
    defaultBody: COPY['order_out_for_delivery.email'].body,
    placeholders: [...COMMON],
  },
  {
    key: 'order_out_for_delivery',
    channel: 'sms',
    label: 'Out for delivery',
    defaultBody: `${SMS}${COPY['order_out_for_delivery.sms'].body}`,
    placeholders: [...COMMON],
  },
  {
    key: 'order_delivered',
    channel: 'email',
    label: 'Order delivered',
    defaultSubject: `${COPY['order_delivered.email'].subject}${SFX}`,
    defaultBody: COPY['order_delivered.email'].body,
    placeholders: [...COMMON],
  },
  {
    key: 'order_delivered',
    channel: 'sms',
    label: 'Order delivered',
    defaultBody: `${SMS}${COPY['order_delivered.sms'].body}`,
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
