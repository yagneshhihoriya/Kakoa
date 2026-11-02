/**
 * The active brand — the ONE import site for brand identity in app code.
 *
 * `@brand` is a build-time alias (next.config.ts) to src/brands/<BRAND_KEY>;
 * for type-checking it points at the kakoa pack (tsconfig paths). The helpers
 * below derive every brand-keyed identifier (cookies, email identity, nav
 * gating) from the profile so no literal brand name is needed outside the pack.
 */
import { parseServerEnv } from "@kakoa/config";
import {
  exampleOrderNumber as exampleOrderNumberFor,
  makeLookupRequestSchema,
  makeLookupVerifySchema,
  makeOrderNumberRegex,
  makeOrderNumberSchema,
} from "@kakoa/core";
import {
  resolvePreset,
  type Capability,
  type StorefrontVocabulary,
  type Swatch,
  type VerticalPreset,
} from "@platform/kernel";
import type { BrandNavLink, BrandProfile } from "@kakoa/brands";
import { brand } from "@brand";

export { brand };
export type { BrandPack } from "@/brands/contract";

/* ── Vertical preset ──────────────────────────────────────────────────── */

/**
 * The brand's vertical preset — `getPreset(profile.vertical)` tuned by the
 * profile's `presetOverrides` — the SAME resolution the admin BusinessContext
 * performs. Storefront code reads vocabulary, swatches and capabilities from
 * here; the admin additionally layers `capability.<key>.enabled` settings on
 * top (lib/admin/context.ts), which is why `presetHas` is preset-level only.
 */
export const preset: VerticalPreset = resolvePreset(brand.profile);

/** Shorthand for the vocabulary block (nouns, cold-chain flag, search copy). */
export const vocabulary: StorefrontVocabulary = preset.storefront;

/** Whether the preset turns a capability on (before per-business overrides). */
export function presetHas(capability: Capability): boolean {
  return preset.capabilities.includes(capability);
}

/**
 * Swatch keys in preset order — the admin tone picker's options and the
 * deterministic by-index fallbacks (home collection tiles, gallery studies).
 */
export const SWATCH_KEYS: readonly string[] = Object.keys(preset.presentation.swatches);

/**
 * Coerce a stored `products.tone` to a swatch key this preset knows, falling
 * back to the preset's default swatch. Never throws: the column is free text
 * and a value from another vertical (or a typo) must still render.
 */
export function toTone(value: string | null | undefined): string {
  return value !== null && value !== undefined && value in preset.presentation.swatches
    ? value
    : preset.presentation.defaultSwatch;
}

/** The gradient stops for a tone (default swatch for an unknown key). */
export function swatchFor(tone: string): Swatch {
  const { swatches, defaultSwatch } = preset.presentation;
  return swatches[tone] ?? swatches[defaultSwatch] ?? { from: "#5b6470", to: "#2f3640" };
}

/**
 * Customer-facing label for a `return_reason` enum value — the Postgres enum
 * keeps `damaged_or_melted`; the preset decides whether that reads "melted".
 */
export function returnReasonLabel(reason: string): string {
  return vocabulary.returnReasonLabels[reason] ?? reason.replace(/_/g, " ");
}

/* ── Navigation ───────────────────────────────────────────────────────── */

/** Routes that exist only when the matching brand feature is on. */
const FEATURE_ROUTES: readonly { prefix: string; feature: keyof BrandProfile["features"] }[] = [
  { prefix: "/journal", feature: "journal" },
  { prefix: "/locator", feature: "locator" },
];

/**
 * Whether a root-relative route is reachable for this brand: `/journal*` needs
 * `features.journal` AND at least one article; `/locator` needs
 * `features.locator`. Every other route is always on.
 */
export function routeEnabled(href: string): boolean {
  const path = href.split(/[?#]/, 1)[0] ?? href;
  for (const { prefix, feature } of FEATURE_ROUTES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      if (!brand.profile.features[feature]) return false;
      if (feature === "journal" && brand.journal.length === 0) return false;
    }
  }
  return true;
}

/**
 * A pack's static nav list (profile.nav.primary / footerCompany) with the
 * feature-gated routes dropped — the Header, Footer and sitemap all filter
 * through here so a brand without a Journal never links to one.
 */
export function staticNav(links: readonly BrandNavLink[]): BrandNavLink[] {
  return links.filter((link) => routeEnabled(link.href));
}

/* ── Order / invoice numbers ──────────────────────────────────────────── */

/**
 * The brand's order-number prefix (`KK` → `KK-48210`). Also the invoice serial
 * prefix (`KK/26-27/48210`) and what the placement transaction writes.
 */
export const ORDER_NUMBER_PREFIX: string = brand.profile.identifierPrefix;

/**
 * THE order-number schema / regex for this build — every route param, page
 * param and form field validates against this, never a local literal.
 */
export const orderNumberSchema = makeOrderNumberSchema(ORDER_NUMBER_PREFIX);
export const ORDER_NUMBER_RE: RegExp = makeOrderNumberRegex(ORDER_NUMBER_PREFIX);

/** `true` when `value` is exactly a well-formed order number for this brand. */
export function isOrderNumber(value: string): boolean {
  return ORDER_NUMBER_RE.test(value);
}

/** Example order number for placeholders and error copy (`KK-48210`). */
export const EXAMPLE_ORDER_NUMBER: string = exampleOrderNumberFor(ORDER_NUMBER_PREFIX);

/** Guest-tracking request bodies bound to this brand's prefix. */
export const lookupRequestSchema = makeLookupRequestSchema(ORDER_NUMBER_PREFIX);
export const lookupVerifySchema = makeLookupVerifySchema(ORDER_NUMBER_PREFIX);

/* ── Cookies ──────────────────────────────────────────────────────────── */

/** The brand-prefixed cookie names (`<cookiePrefix>_<suffix>`). */
export type CookieSuffix = "session" | "cart" | "admin" | "cookie_consent";

export function cookieName(suffix: CookieSuffix): string {
  return `${brand.profile.cookiePrefix}_${suffix}`;
}

/* ── Email / SMS identity ─────────────────────────────────────────────── */

export interface EmailIdentity {
  /** From-header display name — EMAIL_FROM_NAME when set, else the brand's. */
  readonly fromName: string;
  /** Verified sender address (EMAIL_FROM), or null when email is mocked. */
  readonly from: string | null;
  readonly subjectSuffix: string;
  readonly smsPrefix: string;
}

/** SERVER-ONLY (reads env): the identity transactional email/SMS goes out as. */
export function emailIdentity(): EmailIdentity {
  const env = parseServerEnv();
  const { email } = brand.profile;
  return {
    fromName: env.EMAIL_FROM_NAME ?? email.fromName,
    from: env.EMAIL_FROM ?? null,
    subjectSuffix: email.subjectSuffix,
    smsPrefix: email.smsPrefix,
  };
}

let asserted = false;

/**
 * SERVER-ONLY boot assert, lazy at first use: the pack this build bundled must
 * be the brand the runtime env says it is. Catches a Vercel project pointed at
 * the wrong build (or a stale alias) before it serves one brand's storefront
 * under another's domain, DB and secrets.
 */
export function assertBrandMatchesEnv(): void {
  if (asserted) return;
  const expected = parseServerEnv().BRAND_KEY;
  if (expected !== brand.profile.key) {
    throw new Error(
      `Brand pack mismatch: this build bundled the "${brand.profile.key}" pack ` +
        `but BRAND_KEY=${expected}. Rebuild with BRAND_KEY=${brand.profile.key} ` +
        `or point this deployment at the ${expected} build.`,
    );
  }
  asserted = true;
}
