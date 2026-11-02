/**
 * Brand profile contract — the PURE DATA half of a brand (no React, no fonts,
 * no env). Everything here is safe to import from the seed, the admin and
 * client components alike. Presentation (fonts, theme, marks, copy) lives in
 * apps/web/src/brands/<key> and is selected by the `@brand` build alias.
 *
 * The zod schema is the source of truth; `BrandProfile` is inferred from it.
 * Profiles are written as plain objects (`satisfies BrandProfile`) so no zod
 * runs in the browser bundle — the registry test parses every profile instead.
 */
import { z } from 'zod';
import { CAPABILITY_KEYS, PRESET_KEYS, type PresetOverrides } from '@platform/kernel';
import { BRAND_KEYS } from './keys';

const nonEmpty = z.string().min(1);
const hexColour = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'expected #RRGGBB');
const httpsUrl = z.string().url().startsWith('https://');
/** Root-relative app route (the pack never links off-site from nav). */
const appPath = z.string().regex(/^\/[A-Za-z0-9\-._~/?=&]*$/, 'expected a root-relative path');

/* ── Preset tuning (mirrors @platform/kernel PresetOverrides) ─────────── */

const attributeDefSchema = z.object({
  key: nonEmpty,
  label: nonEmpty,
  type: z.enum(['text', 'number', 'enum', 'multi-enum', 'boolean', 'rich']),
  options: z.array(z.string()).readonly().optional(),
  required: z.boolean().optional(),
  capability: z.enum(CAPABILITY_KEYS).optional(),
  group: z.string().optional(),
  showOnPdp: z.boolean().optional(),
  unit: z.string().optional(),
});

const taxDefaultSchema = z.object({
  category: nonEmpty,
  rateBp: z.number().int().min(0).max(10_000),
  codeSystem: z.literal('HSN').optional(),
  code: nonEmpty.optional(),
});

const categorySeedSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: nonEmpty,
  description: z.string(),
});

const nounFormsSchema = z.object({ one: nonEmpty, many: nonEmpty, collective: nonEmpty });

const storefrontVocabularySchema = z.object({
  noun: nounFormsSchema,
  unitNoun: nounFormsSchema.pick({ one: true, many: true }),
  coldChain: z.boolean(),
  searchPlaceholder: nonEmpty,
  popularSearches: z.array(nonEmpty).readonly(),
  returnReasonLabels: z.record(z.string(), nonEmpty),
  defaultParcelCm: z.object({
    length: z.number().positive(),
    breadth: z.number().positive(),
    height: z.number().positive(),
  }),
});

const presentationSchema = z.object({
  swatches: z.record(z.string(), z.object({ from: hexColour, to: hexColour })),
  defaultSwatch: nonEmpty,
});

export const presetOverridesSchema = z.object({
  label: nonEmpty.optional(),
  capabilities: z.array(z.enum(CAPABILITY_KEYS)).readonly().optional(),
  attributeSchema: z.array(attributeDefSchema).readonly().optional(),
  taxDefaults: taxDefaultSchema.partial().optional(),
  categoryTaxonomy: z.array(categorySeedSchema).readonly().optional(),
  units: z.enum(['weight', 'volume', 'count']).optional(),
  storefront: storefrontVocabularySchema.partial().optional(),
  presentation: presentationSchema.partial().optional(),
}) satisfies z.ZodType<PresetOverrides>;

/* ── Navigation / social ───────────────────────────────────────────────── */

const navLinkSchema = z.object({ href: appPath, label: nonEmpty });

/* ── store_settings defaults ───────────────────────────────────────────── */

/**
 * The seller's LEGAL identity (GST invoices, Contact / legal pages, FSSAI
 * display). Deliberately NOT part of `defaults`: the app has no code fallback
 * for these keys — a store_settings row must exist or the storefront renders a
 * "not configured" state and the admin sees a banner. That is what guarantees
 * a fresh brand's database can never print another brand's GSTIN.
 */
const legalIdentitySchema = z.object({
  seller_legal_name: nonEmpty,
  seller_gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/),
  seller_state_code: z.string().regex(/^[0-9]{2}$/),
  seller_address: nonEmpty,
  origin_pincode: z.string().regex(/^[1-9][0-9]{5}$/),
  fssai_license_number: z.string().regex(/^[0-9]{14}$/),
});

/**
 * Default value for every catalogued `store_settings` key that HAS a brand
 * default (SETTINGS_CATALOG in apps/web/src/lib/admin/settings-schema.ts reads
 * these for its `default:` fields; the seed writes them as the initial rows).
 * Policy, fees, support contacts, marketing lines and ops nicknames — never
 * legal identity. Money is integer paise. Keys are the FLAT setting names; the
 * catalog namespaces them (`storefront.`, `policy.`, `shipping.`).
 */
/**
 * A business-day window as the policies print it: "2" or "1–2" (en dash).
 * Stored as text so a range survives verbatim into the FAQ / legal copy.
 */
const dayRange = z.string().regex(/^[0-9]{1,3}(?:–[0-9]{1,3})?$/, 'expected "N" or "N–M"');

const settingsDefaultsSchema = z.object({
  grievance_officer_name: nonEmpty,
  country_of_origin: nonEmpty,
  shipping_fee_standard_paise: z.number().int().min(0),
  shipping_fee_express_paise: z.number().int().min(0),
  free_shipping_threshold_paise: z.number().int().min(0),
  gift_wrap_fee_paise: z.number().int().min(0),
  cod_enabled: z.boolean(),
  cod_fee_paise: z.number().int().min(0),
  payment_expiry_minutes: z.number().int().min(5).max(1440),
  support_phone: z.string().regex(/^\+91[6-9][0-9]{9}$/),
  support_email: z.string().email(),
  support_hours: nonEmpty,
  /** Announcement-ribbon segments (storefront.announcement_segments). */
  announcement_segments: z.array(nonEmpty).readonly(),
  /** Newsletter incentive line under the club heading (storefront.newsletter_offer). */
  newsletter_offer: nonEmpty,
  /** "Effective date" printed on every policy page (policy.legal_effective_date). */
  legal_effective_date: nonEmpty,
  /** Hours after delivery within which damage must be reported (policy.*). */
  damage_report_window_hours: z.number().int().min(1).max(720),
  refund_sla_days: dayRange,
  dispatch_sla_days: dayRange,
  delivery_eta_days: dayRange,
  /** Shiprocket pickup-location nickname (shipping.shiprocket_pickup_location). */
  shiprocket_pickup_location: nonEmpty,
});

/* ── The profile ───────────────────────────────────────────────────────── */

export const brandProfileSchema = z.object({
  key: z.enum(BRAND_KEYS),
  /** Display name as it appears in titles, emails and the wordmark. */
  name: nonEmpty,
  /** PWA short name (≤ 12 chars renders cleanly on a home screen). */
  shortName: z.string().min(1).max(12),
  /** Order / invoice / SKU prefix, e.g. 'KK' → KK-00001. */
  identifierPrefix: z.string().regex(/^[A-Z]{2,4}$/),
  /** Cookie name prefix, e.g. 'kakoa' → kakoa_session / kakoa_cart / kakoa_admin. */
  cookiePrefix: z.string().regex(/^[a-z][a-z0-9]{1,15}$/),

  /** The kernel vertical this brand IS, plus optional tuning of its preset. */
  vertical: z.enum(PRESET_KEYS),
  presetOverrides: presetOverridesSchema.optional(),

  /** ISO-4217 / ISO-3166-1 alpha-2 / BCP-47. */
  currency: z.string().regex(/^[A-Z]{3}$/),
  country: z.string().regex(/^[A-Z]{2}$/),
  locale: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/),
  /** Languages customer support can answer in (Organization JSON-LD). */
  availableLanguages: z.array(z.string().regex(/^[a-z]{2}$/)).nonempty().readonly(),

  /** Manifest / <meta theme-color> palette. */
  themeColor: hexColour,
  backgroundColor: hexColour,

  seo: z.object({
    /** Site-wide meta description (root metadata, manifest, Organization JSON-LD). */
    description: nonEmpty,
  }),
  organization: z.object({
    /** Organization JSON-LD PostalAddress.addressRegion (state / province). */
    addressRegion: nonEmpty,
  }),

  features: z.object({
    journal: z.boolean(),
    locator: z.boolean(),
    gifting: z.boolean(),
    giftWrap: z.boolean(),
  }),
  /**
   * STATIC pages only — category links are derived from DB categories at
   * render time, never listed here.
   */
  nav: z.object({
    primary: z.array(navLinkSchema).readonly(),
    footerCompany: z.array(navLinkSchema).readonly(),
  }),
  social: z.object({
    instagram: httpsUrl.optional(),
    facebook: httpsUrl.optional(),
    pinterest: httpsUrl.optional(),
    youtube: httpsUrl.optional(),
  }),
  email: z.object({
    /** Display name in the From header ("KAKOA <orders@…>"). */
    fromName: nonEmpty,
    /** Appended to every transactional subject, e.g. ' · KAKOA'. */
    subjectSuffix: nonEmpty,
    /** Leads every transactional SMS, e.g. 'KAKOA: '. */
    smsPrefix: nonEmpty,
  }),

  defaults: settingsDefaultsSchema,
  /**
   * SEED-ONLY legal identity: the rows `pnpm db:seed` writes for a brand whose
   * owner has supplied them. Nothing at runtime may read this block — runtime
   * identity comes from store_settings alone (see legalIdentitySchema). A brand
   * whose identity is entered through the admin instead simply omits it.
   */
  seedLegalIdentity: legalIdentitySchema.optional(),
});

export type BrandProfile = z.infer<typeof brandProfileSchema>;
export type BrandSettingsDefaults = BrandProfile['defaults'];
export type BrandLegalIdentity = z.infer<typeof legalIdentitySchema>;
/** The store_settings keys that carry the legal identity (no code defaults). */
export const LEGAL_IDENTITY_KEYS = legalIdentitySchema.keyof().options;
export type LegalIdentityKey = (typeof LEGAL_IDENTITY_KEYS)[number];
export type BrandNavLink = z.infer<typeof navLinkSchema>;
