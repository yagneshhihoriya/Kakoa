/**
 * The seller's legal identity rows — the ONE path a brand seed obtains them by.
 *
 * KAKOA and Khakhra House are trade names of the same company (owner decision,
 * 2026-11-02), so both profiles spread the single shared fixture
 * (`@kakoa/brands` → src/shared/seller-identity.ts) into their
 * `seedLegalIdentity`. This module never carries a literal of its own: a GSTIN,
 * address or FSSAI licence exists exactly once in the repository, and a
 * correction there reaches every brand seed.
 */
import type { BrandLegalIdentity, BrandProfile } from '@kakoa/brands';

/** The six legal-identity store_settings rows for a brand, or throw. */
export function legalIdentityRows(profile: BrandProfile): BrandLegalIdentity {
  const identity = profile.seedLegalIdentity;
  if (identity === undefined) {
    throw new Error(
      `The ${profile.key} profile must carry seedLegalIdentity for the seed to write it.`,
    );
  }
  return identity;
}
