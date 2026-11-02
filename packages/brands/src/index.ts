/**
 * @kakoa/brands — brand profiles as pure data (docs/admin-platform Phase P).
 *
 * One codebase, N brands: `BRAND_KEY` picks a profile here (identity, market,
 * vertical, settings defaults) and a presentation pack in apps/web/src/brands.
 * No React, no next/font, no env reads — importable from the seed, the admin
 * request pipeline and client components alike.
 */
export { BRAND_KEYS, isBrandKey, type BrandKey } from './keys';
export {
  brandProfileSchema,
  presetOverridesSchema,
  type BrandNavLink,
  type BrandProfile,
  type BrandSettingsDefaults,
} from './contract';
export { KAKOA } from './kakoa/profile';

import { BRAND_KEYS, isBrandKey, type BrandKey } from './keys';
import type { BrandProfile } from './contract';
import { KAKOA } from './kakoa/profile';

/** Registry of every shipped brand, keyed by BRAND_KEY. */
export const BRANDS: Readonly<Record<BrandKey, BrandProfile>> = {
  kakoa: KAKOA,
};

export function getBrandProfile(key: BrandKey): BrandProfile {
  return BRANDS[key];
}

/**
 * Read + validate `BRAND_KEY` from an env-shaped record. Throws a readable
 * error naming the accepted keys; there is deliberately NO default — a build
 * or process that does not say which brand it is must not guess.
 */
export function resolveBrandKey(
  env: Readonly<Record<string, string | undefined>>,
): BrandKey {
  const raw = env.BRAND_KEY;
  if (isBrandKey(raw)) return raw;
  throw new Error(
    `BRAND_KEY must be one of: ${BRAND_KEYS.join(', ')} (got ${
      raw === undefined || raw === '' ? 'nothing' : JSON.stringify(raw)
    })`,
  );
}
