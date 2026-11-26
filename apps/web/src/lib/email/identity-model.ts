/**
 * Email identity — PURE half (no @kakoa/db): joins the brand pack (trade name,
 * subject suffix, palette, footer tagline) with a map of store_settings rows
 * (support email, legal name / address / FSSAI) into the `EmailIdentityModel`
 * the templates render. `lib/email/identity.ts` is the server loader.
 *
 * The legal lines have NO code default (lib/admin/legal-identity.ts): until the
 * owner configures them the footer carries only the brand + support email —
 * never another brand's registered details.
 */
import { resolveLegalIdentity } from '@/lib/admin/legal-identity';
import { brand, vocabulary } from '@/lib/brand';
import type { EmailIdentityModel } from './templates';

/** jsonb value → trimmed non-empty string, else `null`. */
function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v === '' ? null : v;
}

/**
 * Assemble the identity from a `key → value` map of store_settings rows. The
 * support email falls back to THIS brand's profile default; the legal lines
 * stay `null` while any legal-identity row is missing.
 */
export function buildEmailIdentity(rows: ReadonlyMap<string, unknown>): EmailIdentityModel {
  const { profile, email } = brand;
  const legal = resolveLegalIdentity(rows);
  return {
    brandName: profile.name,
    subjectSuffix: profile.email.subjectSuffix,
    supportEmail: str(rows.get('support_email')) ?? profile.defaults.support_email,
    legalName: legal.configured ? legal.legalName : null,
    legalAddress: legal.configured ? legal.address : null,
    fssaiLicense: legal.configured ? legal.fssai : null,
    footerTagline: email.footerTagline,
    unitNoun: { one: vocabulary.unitNoun.one, many: vocabulary.unitNoun.many },
    theme: email.theme,
    copy: email.copy,
  };
}
