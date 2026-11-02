/**
 * Pure settings catalog + validator — NO @kakoa/db import, so it's unit-testable
 * and the SINGLE source of truth for every setting's label / type / bounds /
 * default. The admin form is DRIVEN by this catalog (same "schema drives the
 * form" pattern the Products attribute form uses).
 *
 * `store_settings.value` is jsonb: a number is stored as a JSON number, a boolean
 * as a JSON boolean, a string as a JSON string. `int-paise` fields are edited in
 * RUPEES in the UI and on the wire; this validator converts ₹→paise and stores an
 * integer paise NUMBER (never a string — the checkout reader uses `getInt`).
 *
 * `default:` values come from the brand profile (`brand.profile.defaults`), so
 * a missing row falls back to THIS brand's policy, never another's. The legal
 * identity (`required: true`) has NO default at all — a missing row is an
 * explicit "not configured" state (lib/admin/legal-identity.ts), so a fresh
 * database can never print another brand's GSTIN.
 */

import { brand } from '@/lib/brand';

/** Every setting value is one of these JSON primitive types. */
export type JsonValue = string | number | boolean;

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
  | 'slug';

export interface SettingField {
  key: string;
  group: SettingGroup;
  label: string;
  type: SettingType;
  hint?: string;
  /** string types: length bounds (inclusive). */
  minLen?: number;
  maxLen?: number;
  /** `int` / `int-paise`: numeric bounds. For `int-paise` these are PAISE. */
  min?: number;
  max?: number;
  /**
   * Default stored (jsonb) value — paise as a paise NUMBER for `int-paise`.
   * Absent for `required` fields: there is nothing to fall back to.
   */
  default?: JsonValue;
  /** Must be configured per brand database; the admin sees a banner until it is. */
  required?: true;
}

export const SETTING_GROUPS = [
  'Business identity',
  'Legal',
  'Fees & shipping',
  'Payments',
  'Support',
  'Storefront',
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

/**
 * ₹10,00,000 cap in paise — generous for any real fee/threshold and well under
 * Postgres int4 (2,147,483,647). Matches the coupon validator's ceiling.
 */
export const MAX_PAISE = 100_000_000;

const DEFAULTS = brand.profile.defaults;

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
    key: 'storefront.home_hero_product_slug',
    group: 'Storefront',
    label: 'Home hero product (slug)',
    type: 'slug',
    hint: 'The product the home hero spotlights, by URL slug. Blank = the first featured product.',
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

/* ── Validation ─────────────────────────────────────────────────────── */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;
const STATE_CODE_RE = /^[0-9]{2}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const FSSAI_RE = /^[0-9]{14}$/;
const PHONE_RE = /^\+91[6-9][0-9]{9}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Matches the DB CHECK `slug ~ '^[a-z0-9-]+$'` (max 120). */
const SLUG_RE = /^[a-z0-9-]{1,120}$/;

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
        if (!PHONE_RE.test(s)) {
          return { ok: false, message: 'Enter a valid Indian phone (e.g. +919820012345).' };
        }
        out[key] = s;
        break;
      }
      case 'email': {
        const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
        if (s.length === 0 || s.length > 254 || !EMAIL_RE.test(s)) {
          return { ok: false, message: 'Enter a valid support email.' };
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
