/**
 * Seed dispatcher — one brand per database.
 *
 *   pnpm db:seed                      # the brand in BRAND_KEY
 *   pnpm db:seed -- --brand khakhra   # an explicit brand (overrides BRAND_KEY)
 *
 * Requires DATABASE_URL; migrations must be applied. Idempotent: exits early
 * if store_settings is already populated. The brand modules under ./seeds own
 * the content; ./seeds/platform.ts writes it.
 */
import type { BrandKey } from '@kakoa/brands';
import { db, queryClient } from './client';
import { kakoaSeed } from './seeds/kakoa';
import { khakhraSeed } from './seeds/khakhra';
import { seedBrand } from './seeds/platform';
import { resolveSeedBrand, type BrandSeedSpec } from './seeds/spec';

const SEEDS: Readonly<
  Record<BrandKey, (env: Readonly<Record<string, string | undefined>>) => BrandSeedSpec>
> = {
  kakoa: kakoaSeed,
  khakhra: khakhraSeed,
};

async function main(): Promise<void> {
  const key = resolveSeedBrand(process.argv.slice(2), process.env);
  const spec = SEEDS[key](process.env);
  const summary = await seedBrand(db, spec);
  if (summary.skipped) {
    console.log('Seed skipped: store_settings already populated.');
    return;
  }
  console.log(
    `Seeded ${spec.profile.name} (${key}): ${String(summary.settings)} store_settings keys, ` +
      `${String(summary.categories)} categories, ${String(summary.products)} products, ` +
      `${String(summary.variants)} variants, ${String(summary.images)} images, ` +
      `${String(summary.coupons)} coupons, 1 owner admin.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void queryClient.end({ timeout: 5 });
  });
