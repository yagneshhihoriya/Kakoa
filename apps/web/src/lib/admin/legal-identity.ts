/**
 * Seller legal identity — resolved from `store_settings` rows ONLY. Pure (no
 * @kakoa/db import), shared by the storefront (Contact / legal pages, footer),
 * the invoice loader, the admin Settings + Taxes pages and the email footer.
 *
 * There is deliberately NO code default for any of these keys: a brand's legal
 * name, GSTIN, state code, registered address, origin PIN and FSSAI licence
 * come from the brand's own database (seeded or entered in Admin → Settings).
 * A missing row yields `configured: false` plus the missing keys, so every
 * surface can render an explicit "not configured" state — never another
 * brand's GSTIN on an invoice.
 */
import { LEGAL_IDENTITY_KEYS, type LegalIdentityKey } from '@kakoa/brands';

export { LEGAL_IDENTITY_KEYS, type LegalIdentityKey };

export interface LegalIdentityStatus {
  /** Every legal-identity key has a non-empty store_settings row. */
  configured: boolean;
  /** Keys with no usable row (empty when `configured`). */
  missing: LegalIdentityKey[];
  /** Stored values, `''` when missing — never a brand default. */
  legalName: string;
  gstin: string;
  stateCode: string;
  address: string;
  originPincode: string;
  fssai: string;
}

/** Admin-facing labels for the banner ("set Legal name, GSTIN …"). */
export const LEGAL_IDENTITY_LABELS: Readonly<Record<LegalIdentityKey, string>> = {
  seller_legal_name: 'Legal name',
  seller_gstin: 'GSTIN',
  seller_state_code: 'GST state code',
  seller_address: 'Registered address',
  origin_pincode: 'Dispatch origin PIN code',
  fssai_license_number: 'FSSAI license number',
};

/** jsonb value → trimmed non-empty string, else `null`. */
function str(value: unknown): string | null {
  if (typeof value === 'string') {
    const v = value.trim();
    return v === '' ? null : v;
  }
  if (typeof value === 'number') return String(value);
  return null;
}

/**
 * Resolve the legal identity from a `key → jsonb value` map of store_settings
 * rows (any extra keys are ignored).
 */
export function resolveLegalIdentity(
  rows: ReadonlyMap<string, unknown>,
): LegalIdentityStatus {
  const get = (key: LegalIdentityKey): string => str(rows.get(key)) ?? '';
  const missing = LEGAL_IDENTITY_KEYS.filter((key) => str(rows.get(key)) === null);
  return {
    configured: missing.length === 0,
    missing,
    legalName: get('seller_legal_name'),
    gstin: get('seller_gstin'),
    stateCode: get('seller_state_code'),
    address: get('seller_address'),
    originPincode: get('origin_pincode'),
    fssai: get('fssai_license_number'),
  };
}

/** One-line operator message naming what is missing (for logs and banners). */
export function legalIdentityMessage(missing: readonly LegalIdentityKey[]): string {
  const labels = missing.map((key) => LEGAL_IDENTITY_LABELS[key]).join(', ');
  return `Legal identity not configured — set ${labels} in Admin → Settings (Business identity / Legal).`;
}
