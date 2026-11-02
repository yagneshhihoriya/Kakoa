/**
 * The active brand — the ONE import site for brand identity in app code.
 *
 * `@brand` is a build-time alias (next.config.ts) to src/brands/<BRAND_KEY>;
 * for type-checking it points at the kakoa pack (tsconfig paths). The helpers
 * below derive every brand-keyed identifier (cookies, email identity) from the
 * profile so no literal brand name is needed outside the pack.
 */
import { parseServerEnv } from "@kakoa/config";
import {
  exampleOrderNumber as exampleOrderNumberFor,
  makeLookupRequestSchema,
  makeLookupVerifySchema,
  makeOrderNumberRegex,
  makeOrderNumberSchema,
} from "@kakoa/core";
import { brand } from "@brand";

export { brand };
export type { BrandPack } from "@/brands/contract";

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
