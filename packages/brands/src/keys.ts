/**
 * Every brand this codebase can be built as. One deployment = one key, chosen
 * at build time by `BRAND_KEY` (packages/config) and resolved to a brand
 * profile here and to a presentation pack in apps/web/src/brands/<key>.
 *
 * Append-only: a new brand adds its key here, its profile under src/<key>/ and
 * its entry in the BRANDS registry (src/index.ts).
 */
export const BRAND_KEYS = ['kakoa'] as const;

export type BrandKey = (typeof BRAND_KEYS)[number];

export function isBrandKey(value: unknown): value is BrandKey {
  return typeof value === 'string' && (BRAND_KEYS as readonly string[]).includes(value);
}
