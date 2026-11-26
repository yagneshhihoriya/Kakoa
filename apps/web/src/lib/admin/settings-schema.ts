/**
 * Pure settings catalog + validator — NO @kakoa/db import, so it's unit-testable
 * and the SINGLE source of truth for every setting's label / type / bounds /
 * default. The admin form is DRIVEN by this catalog (same "schema drives the
 * form" pattern the Products attribute form uses).
 *
 * `store_settings.value` is jsonb: a number is stored as a JSON number, a boolean
 * as a JSON boolean, a string as a JSON string, a `json-list` as a JSON array of
 * strings. `int-paise` fields are edited in RUPEES in the UI and on the wire;
 * this validator converts ₹→paise and stores an integer paise NUMBER (never a
 * string — the checkout reader uses `getInt`).
 *
 * `default:` values come from the brand profile (`brand.profile.defaults`), so
 * a missing row falls back to THIS brand's policy, never another's. The legal
 * identity (`required: true`) has NO default at all — a missing row is an
 * explicit "not configured" state (lib/admin/legal-identity.ts), so a fresh
 * database can never print another brand's GSTIN.
 *
 * Keys the storefront reads are NAMESPACED (`storefront.`, `brand.`, `policy.`,
 * `ops.`, `shipping.`): the SettingsReader (lib/admin/context.ts) and the
 * storefront readers (lib/catalog/queries.ts) resolve `ns.key` first, then the
 * flat `key`, so legacy flat rows keep working.
 */

import { brand } from '@/lib/brand';

/** Every setting value is one of these JSON types. */
export type JsonValue = string | number | boolean | string[];

export type SettingType =
  | 'string'
  | 'gstin'
  | 'state-code'
  | 'pincode'
  | 'fssai'
  | 'phone'
  | 'email'
  | 'int-paise'
  | 'int'
  | 'bool'
  /** A product/category slug, or blank for "unset". */
  | 'slug'
  /** An https:// URL or a same-origin `/uploads/…` path, or blank for "unset". */
  | 'url'
  /** `#RRGGBB`, or blank for "use the brand pack's value". */
  | 'hex'
  /** An ordered list of short lines (stored as a JSON array). */
  | 'json-list'
  /** A business-day window as printed in the policies: "2" or "1–2". */
  | 'day-range';

export interface SettingField {
  key: string;
  group: SettingGroup;
  label: string;
  type: SettingType;
  hint?: string;
  /** string types: length bounds (inclusive). */
  minLen?: number;
  maxLen?: number;
  /** `int` / `int-paise`: numeric bounds. For `int-paise` these are PAISE. `json-list`: item count. */
  min?: number;
  max?: number;
  /**
   * Default stored (jsonb) value — paise as a paise NUMBER for `int-paise`.
   * Absent for `required` fields: there is nothing to fall back to.
   */
  default?: JsonValue;
  /** Must be configured per brand database; the admin sees a banner until it is. */
  required?: true;
  /** `email` / `phone`: blank is a valid "not set" (stored as ''). */
  optional?: true;
  /** `url`: the value is an image — the form offers the Media Library picker. */
  media?: true;
}

export const SETTING_GROUPS = [
  'Business identity',
  'Legal',
  'Fees & shipping',
  'Payments',
  'Support',
  'Storefront',
  'Brand',
  'Operations',
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

/**
 * ₹10,00,000 cap in paise — generous for any real fee/threshold and well under
 * Postgres int4 (2,147,483,647). Matches the coupon validator's ceiling.
 */
export const MAX_PAISE = 100_000_000;

const DEFAULTS = brand.profile.defaults;
const SOCIAL = brand.profile.social;

/**
 * `brand.theme.<key>` settings → the CSS custom property each one overrides.
 * The storefront layout emits a `:root { … }` block for the configured ones
 * (after the pack's theme.css, so they win) — colour tuning without a deploy.
 */
export const THEME_TOKENS = {
  ink: '--color-ink',
  cream: '--color-cream',
  field: '--color-field',
  field_ink: '--color-field-ink',
  gold: '--color-gold',
} as const satisfies Readonly<Record<string, `--color-${string}`>>;
export type ThemeTokenKey = keyof typeof THEME_TOKENS;

const THEME_LABELS: Readonly<Record<ThemeTokenKey, string>> = {
  ink: 'Ink (text, buttons)',
  cream: 'Page background',
  field: 'Chrome band (header hover, hero, footer)',
  field_ink: 'Chrome band text',
  gold: 'Accent (focus rings, highlights)',
};

export const SETTINGS_CATALOG: readonly SettingField[] = [
  // ── Business identity ──────────────────────────────────────────────
  {
    key: 'seller_legal_name',
    group: 'Business identity',
    label: 'Legal name',
    type: 'string',
    minLen: 2,
    maxLen: 120,
    hint: 'Printed on GST invoices.',
    required: true,
  },
  {
    key: 'seller_gstin',
    group: 'Business identity',
    label: 'GSTIN',
    type: 'gstin',
    hint: '15-character GST identification number.',
    required: true,
  },
  {
    key: 'seller_state_code',
    group: 'Business identity',
    label: 'GST state code',
    type: 'state-code',
    hint: 'Two digits (01–37); drives CGST/SGST vs IGST.',
    required: true,
  },
  {
    key: 'seller_address',
    group: 'Business identity',
    label: 'Registered address',
    type: 'string',
    minLen: 5,
    maxLen: 300,
    required: true,
  },
  {
    key: 'origin_pincode',
    group: 'Business identity',
    label: 'Dispatch origin PIN code',
    type: 'pincode',
    hint: '6-digit origin PIN for shipping.',
    required: true,
  },
  // ── Legal ──────────────────────────────────────────────────────────
  {
    key: 'fssai_license_number',
    group: 'Legal',
    label: 'FSSAI license number',
    type: 'fssai',
    hint: '14-digit FSSAI license.',
    required: true,
  },
  {
    key: 'grievance_officer_name',
    group: 'Legal',
    label: 'Grievance officer name',
    type: 'string',
    minLen: 2,
    maxLen: 80,
    hint: 'Named officer shown on Contact/Legal pages (Consumer Protection E-Commerce Rules, 2020).',
    default: DEFAULTS.grievance_officer_name,
  },
  {
    key: 'country_of_origin',
    group: 'Legal',
    label: 'Country of origin',
    type: 'string',
    minLen: 2,
    maxLen: 60,
    hint: 'Shown on product pages (Legal Metrology / E-Commerce Rules).',
    default: DEFAULTS.country_of_origin,
  },
  {
    key: 'policy.legal_effective_date',
    group: 'Legal',
    label: 'Policy effective date',
    type: 'string',
    minLen: 4,
    maxLen: 40,
    hint: 'Printed under every policy title, e.g. 12 July 2026. Update it when a policy changes.',
    default: DEFAULTS.legal_effective_date,
  },
  {
    key: 'policy.damage_report_window_hours',
    group: 'Legal',
    label: 'Damage report window (hours)',
    type: 'int',
    min: 1,
    max: 720,
    hint: 'Hours after delivery within which damage / wrong-item claims must be raised (FAQ + Refund Policy).',
    default: DEFAULTS.damage_report_window_hours,
  },
  {
    key: 'policy.refund_sla_days',
    group: 'Legal',
    label: 'Refund timeline (business days)',
    type: 'day-range',
    hint: 'e.g. 5–7 — approved refunds reach the original method within this window.',
    default: DEFAULTS.refund_sla_days,
  },
  {
    key: 'policy.dispatch_sla_days',
    group: 'Legal',
    label: 'Dispatch timeline (business days)',
    type: 'day-range',
    hint: 'e.g. 1–2 — orders are dispatched within this window of payment.',
    default: DEFAULTS.dispatch_sla_days,
  },
  {
    key: 'policy.delivery_eta_days',
    group: 'Legal',
    label: 'Delivery estimate (business days)',
    type: 'day-range',
    hint: 'e.g. 2–7 — typical delivery window once dispatched.',
    default: DEFAULTS.delivery_eta_days,
  },
  // ── Fees & shipping (NOT retroactive — snapshotted at placement) ─────
  {
    key: 'shipping_fee_standard_paise',
    group: 'Fees & shipping',
    label: 'Standard shipping fee',
    type: 'int-paise',
    min: 0,
    max: MAX_PAISE,
    default: DEFAULTS.shipping_fee_standard_paise,
  },
  {
    key: 'shipping_fee_express_paise',
    group: 'Fees & shipping',
    label: 'Express shipping fee',
    type: 'int-paise',
    min: 0,
    max: MAX_PAISE,
    default: DEFAULTS.shipping_fee_express_paise,
  },
  {
    key: 'free_shipping_threshold_paise',
    group: 'Fees & shipping',
    label: 'Free shipping threshold',
    type: 'int-paise',
    min: 0,
    max: MAX_PAISE,
    hint: 'Order subtotal at/above this ships free. ₹0 = always free.',
    default: DEFAULTS.free_shipping_threshold_paise,
  },
  {
    key: 'gift_wrap_fee_paise',
    group: 'Fees & shipping',
    label: 'Gift wrap fee (per line)',
    type: 'int-paise',
    min: 0,
    max: MAX_PAISE,
    default: DEFAULTS.gift_wrap_fee_paise,
  },
  {
    key: 'shipping.shiprocket_pickup_location',
    group: 'Fees & shipping',
    label: 'Shiprocket pickup location',
    type: 'string',
    minLen: 1,
    maxLen: 80,
    hint: 'The pickup-location nickname registered in the Shiprocket dashboard — used on every shipment push.',
    default: DEFAULTS.shiprocket_pickup_location,
  },
  // ── Payments ───────────────────────────────────────────────────────
  {
    key: 'cod_enabled',
    group: 'Payments',
    label: 'Cash on Delivery enabled',
    type: 'bool',
    hint: 'Read live at checkout — turning this off immediately hides COD storefront-wide.',
    default: DEFAULTS.cod_enabled,
  },
  {
    key: 'cod_fee_paise',
    group: 'Payments',
    label: 'COD surcharge',
    type: 'int-paise',
    min: 0,
    max: MAX_PAISE,
    default: DEFAULTS.cod_fee_paise,
  },
  {
    key: 'payment_expiry_minutes',
    group: 'Payments',
    label: 'Prepaid hold window (minutes)',
    type: 'int',
    min: 5,
    max: 1440,
    hint: 'How long a prepaid order holds stock before the sweep releases it.',
    default: DEFAULTS.payment_expiry_minutes,
  },
  // ── Support ────────────────────────────────────────────────────────
  {
    key: 'support_phone',
    group: 'Support',
    label: 'Support phone',
    type: 'phone',
    hint: 'Indian mobile, e.g. +919820012345.',
    default: DEFAULTS.support_phone,
  },
  {
    key: 'support_email',
    group: 'Support',
    label: 'Support email',
    type: 'email',
    default: DEFAULTS.support_email,
  },
  {
    key: 'support_hours',
    group: 'Support',
    label: 'Support hours',
    type: 'string',
    minLen: 2,
    maxLen: 80,
    hint: 'e.g. Mon–Sat, 10:00–18:00 IST — shown on the Contact page.',
    default: DEFAULTS.support_hours,
  },
  // ── Storefront (namespaced keys; the SettingsReader resolves `ns.key` first) ─
  {
    key: 'storefront.announcement_segments',
    group: 'Storefront',
    label: 'Announcement ribbon',
    type: 'json-list',
    min: 1,
    max: 6,
    maxLen: 80,
    hint: 'One line per segment. The first always shows; the rest join it on wider screens.',
    default: [...DEFAULTS.announcement_segments],
  },
  {
    key: 'storefront.home_hero_product_slug',
    group: 'Storefront',
    label: 'Home hero product (slug)',
    type: 'slug',
    hint: 'The product the home hero spotlights, by URL slug. Blank = the first featured product.',
    default: '',
  },
  {
    key: 'storefront.hero_image_url',
    group: 'Storefront',
    label: 'Home hero image (desktop)',
    type: 'url',
    media: true,
    hint: 'Wide 2.5:1 crop behind the hero copy. Blank = the brand pack’s photo.',
    default: '',
  },
  {
    key: 'storefront.hero_image_mobile_url',
    group: 'Storefront',
    label: 'Home hero image (mobile)',
    type: 'url',
    media: true,
    hint: 'Square 1:1 crop for the stacked mobile hero. Blank = the brand pack’s photo.',
    default: '',
  },
  {
    key: 'storefront.newsletter_offer',
    group: 'Storefront',
    label: 'Newsletter offer',
    type: 'string',
    minLen: 2,
    maxLen: 80,
    hint: 'The incentive line under the footer club heading, e.g. 15% off your first box.',
    default: DEFAULTS.newsletter_offer,
  },
  // ── Brand (logo / share image / social / theme) ──────────────────────
  {
    key: 'brand.logo_url',
    group: 'Brand',
    label: 'Logo image',
    type: 'url',
    media: true,
    hint: 'Replaces the drawn mark in the header and footer lockup. Blank = the brand pack’s mark.',
    default: '',
  },
  {
    key: 'brand.og_image_url',
    group: 'Brand',
    label: 'Social share image',
    type: 'url',
    media: true,
    hint: 'Default Open Graph image for storefront pages (1200×630). Blank = the generated card.',
    default: '',
  },
  {
    key: 'brand.social_instagram',
    group: 'Brand',
    label: 'Instagram URL',
    type: 'url',
    default: SOCIAL.instagram ?? '',
  },
  {
    key: 'brand.social_facebook',
    group: 'Brand',
    label: 'Facebook URL',
    type: 'url',
    default: SOCIAL.facebook ?? '',
  },
  {
    key: 'brand.social_pinterest',
    group: 'Brand',
    label: 'Pinterest URL',
    type: 'url',
    default: SOCIAL.pinterest ?? '',
  },
  {
    key: 'brand.social_youtube',
    group: 'Brand',
    label: 'YouTube URL',
    type: 'url',
    default: SOCIAL.youtube ?? '',
  },
  ...(Object.keys(THEME_TOKENS) as ThemeTokenKey[]).map(
    (token): SettingField => ({
      key: `brand.theme.${token}`,
      group: 'Brand',
      label: THEME_LABELS[token],
      type: 'hex',
      hint: `#RRGGBB override of ${THEME_TOKENS[token]}. Blank = the brand pack’s colour.`,
      default: '',
    }),
  ),
  // ── Operations ─────────────────────────────────────────────────────
  {
    key: 'ops.alert_email',
    group: 'Operations',
    label: 'New-order alert email',
    type: 'email',
    optional: true,
    hint: 'Ops inbox that receives a note for every new order. Blank = no email alert.',
    default: '',
  },
  {
    key: 'ops.alert_phone',
    group: 'Operations',
    label: 'New-order alert phone',
    type: 'phone',
    optional: true,
    hint: 'Indian mobile for the new-order SMS alert. Blank = no SMS alert.',
    default: '',
  },
];

export const CATALOG_BY_KEY: ReadonlyMap<string, SettingField> = new Map(
  SETTINGS_CATALOG.map((f) => [f.key, f]),
);

/** All catalogued keys. */
export const SETTINGS_KEYS: readonly string[] = SETTINGS_CATALOG.map((f) => f.key);

/**
 * Default stored (jsonb) value per key — the fallback for a missing row. Only
 * keys WITH a brand default appear; `required` keys (legal identity) do not.
 */
export const SETTINGS_DEFAULTS: Readonly<Record<string, JsonValue>> = Object.fromEntries(
  SETTINGS_CATALOG.flatMap((f) => (f.default !== undefined ? [[f.key, f.default]] : [])),
);

/** Keys that must be configured per brand database (no code default). */
export const REQUIRED_SETTINGS_KEYS: readonly string[] = SETTINGS_CATALOG.filter(
  (f) => f.required === true,
).map((f) => f.key);

/** Fields grouped in display order. */
export function settingsByGroup(): { group: SettingGroup; fields: SettingField[] }[] {
  return SETTING_GROUPS.map((group) => ({
    group,
    fields: SETTINGS_CATALOG.filter((f) => f.group === group),
  }));
}

/**
 * The flat (un-namespaced) name of a catalogued key — `storefront.newsletter_offer`
 * → `newsletter_offer` — i.e. the legacy row name the readers fall back to.
 */
export function flatKey(key: string): string {
  const dot = key.lastIndexOf('.');
  return dot === -1 ? key : key.slice(dot + 1);
}

/* ── Validation ─────────────────────────────────────────────────────── */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;
const STATE_CODE_RE = /^[0-9]{2}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const FSSAI_RE = /^[0-9]{14}$/;
const PHONE_RE = /^\+91[6-9][0-9]{9}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Matches the DB CHECK `slug ~ '^[a-z0-9-]+$'` (max 120). */
const SLUG_RE = /^[a-z0-9-]{1,120}$/;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
/** "2" or "1–2" (hyphen accepted on input, normalised to an en dash). */
const DAY_RANGE_RE = /^([0-9]{1,3})(?:\s*[-–]\s*([0-9]{1,3}))?$/;

export type SettingsPatchResult =
  | { ok: true; value: Record<string, JsonValue> }
  | { ok: false; message: string };

/** Coerce a jsonb-ish boolean (true/false, 1/0, "true"/"false"/"1"/"0"). */
function coerceBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : null;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return null;
}

/**
 * An https:// URL or a same-origin path (`/uploads/…`); `null` when invalid.
 * Mirrors `normalizeCategoryImageUrl` so tile images and hero images accept the
 * same shapes (the Media Library returns absolute https URLs).
 */
export function normalizeSettingUrl(raw: string): string | null {
  const s = raw.trim();
  if (s.length === 0 || s.length > 2048) return null;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    return new URL(s).protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

/**
 * Normalise a day window: "2" → "2", "1-2" / "1 – 2" → "1–2". `null` when
 * malformed or the range runs backwards.
 */
export function normalizeDayRange(raw: string): string | null {
  const m = DAY_RANGE_RE.exec(raw.trim());
  if (m === null) return null;
  const lo = Number(m[1]);
  if (m[2] === undefined) return String(lo);
  const hi = Number(m[2]);
  return hi >= lo ? `${lo}–${hi}` : null;
}

/**
 * A `json-list` value arrives as an array (API) or as newline-separated text
 * (the form); items are trimmed and blank lines dropped.
 */
function coerceList(raw: unknown): string[] | null {
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/\r?\n/)
      : null;
  if (items === null || !items.every((item): item is string => typeof item === 'string')) {
    return null;
  }
  return items.map((item) => item.trim()).filter((item) => item !== '');
}

/**
 * Validate + coerce a partial `{ key: value }` patch into DB-ready typed JSON
 * values. `int-paise` fields are accepted in RUPEES and converted to integer
 * paise. Unknown keys are REJECTED (never persisted). Returns the FIRST failing
 * field's message on error so the UI can surface it.
 */
export function validateSettingsPatch(patch: unknown): SettingsPatchResult {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    return { ok: false, message: 'Invalid settings payload.' };
  }
  const entries = Object.entries(patch as Record<string, unknown>);
  if (entries.length === 0) {
    return { ok: false, message: 'No settings to update.' };
  }

  const out: Record<string, JsonValue> = {};

  for (const [key, raw] of entries) {
    const field = CATALOG_BY_KEY.get(key);
    if (field === undefined) {
      return { ok: false, message: `Unknown setting: ${key}.` };
    }

    switch (field.type) {
      case 'int-paise': {
        const rupees = Number(raw);
        if (!Number.isFinite(rupees) || rupees < 0) {
          return { ok: false, message: `${field.label} must be ₹0 or more.` };
        }
        const paise = Math.round(rupees * 100);
        const max = field.max ?? MAX_PAISE;
        if (paise > max) {
          return {
            ok: false,
            message: `${field.label} must be at most ₹${(max / 100).toLocaleString('en-IN')}.`,
          };
        }
        out[key] = paise;
        break;
      }
      case 'int': {
        const n = Number(raw);
        const min = field.min ?? 0;
        const max = field.max ?? Number.MAX_SAFE_INTEGER;
        if (!Number.isInteger(n) || n < min || n > max) {
          return {
            ok: false,
            message: `${field.label} must be a whole number between ${min} and ${max}.`,
          };
        }
        out[key] = n;
        break;
      }
      case 'bool': {
        const b = coerceBool(raw);
        if (b === null) {
          return { ok: false, message: `${field.label} must be true or false.` };
        }
        out[key] = b;
        break;
      }
      case 'gstin': {
        const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
        if (!GSTIN_RE.test(s)) {
          return { ok: false, message: 'Enter a valid 15-character GSTIN.' };
        }
        out[key] = s;
        break;
      }
      case 'state-code': {
        const s = typeof raw === 'string' ? raw.trim() : '';
        const n = Number(s);
        if (!STATE_CODE_RE.test(s) || n < 1 || n > 37) {
          return { ok: false, message: 'GST state code must be two digits (01–37).' };
        }
        out[key] = s;
        break;
      }
      case 'pincode': {
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (!PINCODE_RE.test(s)) {
          return { ok: false, message: 'PIN code must be 6 digits.' };
        }
        out[key] = s;
        break;
      }
      case 'fssai': {
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (!FSSAI_RE.test(s)) {
          return { ok: false, message: 'FSSAI license must be 14 digits.' };
        }
        out[key] = s;
        break;
      }
      case 'phone': {
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (s === '' && field.optional === true) {
          out[key] = '';
          break;
        }
        if (!PHONE_RE.test(s)) {
          return { ok: false, message: `${field.label}: enter a valid Indian phone (e.g. +919820012345).` };
        }
        out[key] = s;
        break;
      }
      case 'email': {
        const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
        if (s === '' && field.optional === true) {
          out[key] = '';
          break;
        }
        if (s.length === 0 || s.length > 254 || !EMAIL_RE.test(s)) {
          return { ok: false, message: `${field.label}: enter a valid email address.` };
        }
        out[key] = s;
        break;
      }
      case 'slug': {
        // Blank is a valid "unset"; anything else must be a well-formed slug.
        const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
        if (s !== '' && !SLUG_RE.test(s)) {
          return { ok: false, message: `${field.label} must be a URL slug (lowercase letters, digits, dashes).` };
        }
        out[key] = s;
        break;
      }
      case 'url': {
        // Blank is a valid "unset"; anything else must be https:// or /uploads/….
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (s === '') {
          out[key] = '';
          break;
        }
        const url = normalizeSettingUrl(s);
        if (url === null) {
          return { ok: false, message: `${field.label} must be an https:// URL or a /uploads/… path.` };
        }
        out[key] = url;
        break;
      }
      case 'hex': {
        // Blank is a valid "use the pack's colour"; anything else is #RRGGBB.
        const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
        if (s !== '' && !HEX_RE.test(s)) {
          return { ok: false, message: `${field.label} must be a #RRGGBB colour.` };
        }
        out[key] = s;
        break;
      }
      case 'json-list': {
        const items = coerceList(raw);
        const min = field.min ?? 0;
        const max = field.max ?? 50;
        const maxLen = field.maxLen ?? 200;
        if (items === null) {
          return { ok: false, message: `${field.label} must be a list of lines.` };
        }
        if (items.length < min || items.length > max) {
          return { ok: false, message: `${field.label} needs between ${min} and ${max} lines.` };
        }
        if (items.some((item) => item.length > maxLen)) {
          return { ok: false, message: `${field.label}: each line must be at most ${maxLen} characters.` };
        }
        out[key] = items;
        break;
      }
      case 'day-range': {
        const s = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '';
        const range = normalizeDayRange(s);
        if (range === null) {
          return { ok: false, message: `${field.label} must be a number of days or a range, e.g. 2 or 1–2.` };
        }
        out[key] = range;
        break;
      }
      case 'string': {
        const s = typeof raw === 'string' ? raw.trim() : '';
        const minLen = field.minLen ?? 1;
        const maxLen = field.maxLen ?? 1000;
        if (s.length < minLen || s.length > maxLen) {
          return {
            ok: false,
            message: `${field.label} must be ${minLen}–${maxLen} characters.`,
          };
        }
        out[key] = s;
        break;
      }
    }
  }

  return { ok: true, value: out };
}
