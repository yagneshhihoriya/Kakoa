# Brand provisioning — Khakhra House (`BRAND_KEY=khakhra`)

How the second brand is wired, what it shares with KAKOA, and every business
value that is a placeholder until the owner confirms it. Phase 2 stages add to
this file (seed/catalogue, smoke tests, deployment) — keep it the single list.

## What exists (Stage 1 — profile + presentation pack)

| Piece | Where |
| --- | --- |
| Brand key | `packages/brands/src/keys.ts` → `BRAND_KEYS = ['kakoa', 'khakhra']` (the config env enum follows) |
| Profile (pure data) | `packages/brands/src/khakhra/profile.ts`, registered in `packages/brands/src/index.ts` |
| Shared legal entity | `packages/brands/src/shared/seller-identity.ts` — ONE fixture spread into both profiles (never a second GSTIN literal) |
| Presentation pack | `apps/web/src/brands/khakhra/**` — same contract as KAKOA (`apps/web/src/brands/contract.ts`), every module ends with `satisfies <Type>` |
| Build selection | `BRAND_KEY=khakhra pnpm --filter web build` (the `@brand` alias in `apps/web/next.config.ts`) |

## What exists (Stage 2 — per-brand seeds + the starter catalogue)

| Piece | Where |
| --- | --- |
| Seed dispatcher | `packages/db/src/seed.ts` — `pnpm db:seed` seeds the brand in `BRAND_KEY`; `pnpm db:seed -- --brand khakhra` picks one explicitly. One brand per database; idempotent (skips when `store_settings` has rows) |
| Brand-agnostic writer | `packages/db/src/seeds/platform.ts` (`seedBrand`: owner admin → system roles → store_settings → categories → products / variants / images / `initial_stock` ledger → coupons) |
| Spec shape + settings rows | `packages/db/src/seeds/spec.ts` (`BrandSeedSpec`, `storeSettingsRows` = six legal-identity rows + nine policy rows, `resolveOwner`, `resolveSeedBrand`) |
| Legal identity access | `packages/db/src/seeds/legal-identity.ts` — reads the profile's `seedLegalIdentity`; the single literal stays in `packages/brands/src/shared/seller-identity.ts` |
| KAKOA content | `packages/db/src/seeds/kakoa.ts` — the Phase 0 data moved verbatim (row-for-row identical on a scratch database before and after the split) |
| Khakhra content | `packages/db/src/seeds/khakhra.ts` — 4 categories (the profile's taxonomy, placeholder tile images), 6 products / 16 variants, 12 placeholder gallery images, no coupons |
| Spec tests | `packages/db/src/seeds/seeds.test.ts` (`pnpm --filter @kakoa/db test`) |

### The starter catalogue

Each product is one flavour family; pack sizes are the variants (SKU
`KH-<FLAVOUR>-<SIZE>`): 200 g (default), 400 g and 1 kg, plus one single-variant
combo. Every value is a placeholder — see the table below.

| Product | Category | SKUs | Tone | GST (bp) |
| --- | --- | --- | --- | --- |
| Plain Khakhra | plain-classic | `KH-PLAIN-200/400/1KG` | wheat | 0 |
| Methi Khakhra | masala-flavoured | `KH-METHI-200/400/1KG` | mint | 500 |
| Masala Khakhra | masala-flavoured | `KH-MASALA-200/400/1KG` | chilli | 500 |
| Jeera Khakhra | masala-flavoured | `KH-JEERA-200/400/1KG` | jaggery | 500 |
| Multigrain Khakhra | multigrain-health | `KH-MULTI-200/400/1KG` | sesame | 0 |
| Family Combo (6 × 200 g) | gift-packs | `KH-COMBO-FAMILY` | turmeric | 500 |

Every product: HSN 1905, `is_veg` true, shelf life 90 days, storage "airtight
container, away from moisture", wheat (gluten) declared on all, sesame where it
is an ingredient (masala, multigrain, combo), nutrition per 100 g as label
placeholders, region Gujarat. Attributes written: `flavour`, `spice_level`,
`region`, `allergens`, `serving_suggestion`, `whatYoullGet` (the combo has no
single `flavour`). `pack_size` is not written at product level — the pack sizes
are the variants. `shipping` is left unset so the PDP renders the store's
settings-driven shipping bullets (free-shipping threshold, gift wrap, COD).

Images are `placehold.co` URLs (allowed by `next.config` `remotePatterns`) until
photography is uploaded through the Media Library.

### Perishable rendering (Task 4)

The PDP "Product information" block renders *Shelf life: N days from packing*,
*Best before: See pack* and the storage line only for verticals with the
`perishable` capability; the FSSAI veg mark needs `veg-mark`; the declared
allergen list ("Contains Wheat (gluten), Sesame.") comes from the preset's
`allergens` attribute and needs the `allergens` capability — the free-text
`products.allergens` advisory renders for any packaged food. The nutrition
panel heading reads its reference quantity from the reserved `basis` key
("per 100 g"). The admin product form shows the shelf-life / storage fields
and the veg checkbox under the same gates; `batch-expiry` stays off (it is not
in the snacks preset and nothing here enables it).

### Owner decisions already applied (2026-11-02)

- Same legal entity as KAKOA: company name, GSTIN, registered address, state
  code, origin pincode, FSSAI licence and the support desk are the shared
  fixture. The khakhra seed (next stage) writes exactly the same
  legal-identity rows as the kakoa seed.
- Working trade name **Khakhra House**; key `khakhra`, order/invoice prefix
  `KH`, cookie prefix `khakhra`, email From name `Khakhra House`.
  PWA `shortName` is `Khakhra` — the profile contract caps it at 12 characters
  (home-screen label), and "Khakhra House" is 13.
- Features: journal **off**, store locator **off**, gifting **on**, gift wrap
  **on**, COD **off**.
- Fees mirror KAKOA: ₹49 standard, ₹149 express, free at or above ₹999, gift
  wrap ₹49 per line (COD fee ₹49, dormant while COD is off).
- Vertical `snacks`, tuned by `presetOverrides`: pack sizes 200 g / 400 g /
  1 kg; flavours Plain / Methi / Masala / Jeera / Pudina / Multigrain; spice
  level Mild / Medium / Hot; allergen options Wheat (gluten) / Sesame / Milk /
  Nuts / Soy; category labels Plain & Everyday, Masala & Flavoured,
  Multigrain & Millet, Gift Packs & Combos.
- Room-temperature product: no cold-chain capability, copy or policy clause
  anywhere in the pack (tests assert it). Storage guidance everywhere is
  "airtight container, away from moisture".
- Locale `en-IN`; support languages en / gu / hi. Body and chrome fonts carry
  Gujarati glyphs (Mukta Vaani, Hind Vadodara); display face Fraunces.
  All Google Fonts (OFL) — no attribution line.
- Palette: turmeric / terracotta / cream with the same token names as KAKOA
  (`apps/web/src/brands/khakhra/theme.css`); every text-on-field pair is
  asserted at WCAG AA 4.5:1.

### GST assumption (record, not code)

- Plain khakhra: HSN **1905**, **0 bp** (NIL since September 2025) — the
  snacks preset's `taxDefaults`, inherited unchanged.
- Seasoned variants (methi, masala, jeera) and the Family Combo that contains
  them: the seed writes **500 bp** on those variants pending the CA's
  confirmation. Multigrain is unseasoned and is treated like plain (**0 bp**) —
  confirm with the CA too. The storefront is tax-inclusive, so a rate change
  re-prices nothing retroactively (rates are snapshotted on each order line).
  Rates are edited per variant in the admin Taxes module.

## Values to confirm before launch

Every placeholder business value in the profile and pack. None of these is a
legal identifier (those are the shared entity's real values); none should
ship unreviewed.

| Value | Where it lives | Placeholder today |
| --- | --- | --- |
| Trade name / wordmark | `profile.name`, `email.fromName`, `subjectSuffix`, `smsPrefix`, copy & OG | `Khakhra House` (working name) |
| PWA short name | `profile.shortName` | `Khakhra` |
| Order / invoice prefix | `profile.identifierPrefix` | `KH` |
| Site URL | `NEXT_PUBLIC_SITE_URL` env (never in code) | `https://khakhra.example` in docs only |
| Social profiles | `profile.social` | none |
| Shipping fees / free threshold / gift wrap | `profile.defaults.*_paise` | ₹49 / ₹149 / ₹999 / ₹49 (mirrors KAKOA) |
| COD | `cod_enabled`, `cod_fee_paise` | off, ₹49 |
| Payment expiry | `payment_expiry_minutes` | 30 |
| Announcement ribbon | `announcement_segments` | "Free shipping on qualifying orders" · "Hand-roasted in small batches" · "Ships crisp, anywhere in India" |
| Newsletter incentive | `newsletter_offer` | `10% off your first order` |
| Policy effective date | `legal_effective_date` | `1 January 2027` |
| Damage-report window | `damage_report_window_hours` | 48 h |
| Refund / dispatch / delivery SLAs | `refund_sla_days`, `dispatch_sla_days`, `delivery_eta_days` | 5–7 / 1–2 / 3–7 business days |
| Shiprocket pickup nickname | `shiprocket_pickup_location` | `Primary` |
| Grievance officer | `grievance_officer_name` | `Grievance Officer` |
| Shelf life claim | FAQ ("around three months"), home/about stats ("90 days of crispness") | ~90 days, per owner |
| Flavour count claim | home/about stats | 6 (the preset's flavour options) |
| Allergen claims | FAQ, allergen option list | wheat (gluten) in every pack; sesame in some varieties |
| Hero artwork | `apps/web/src/brands/khakhra/assets/` | original illustration (no photography) — replace via `storefront.hero_image_url` or new crops |
| GST on seasoned variants / combo | `packages/db/src/seeds/khakhra.ts` (`FLAVOURED_GST_RATE_BP`) | 500 bp pending CA; multigrain 0 bp |
| Prices (MRP, GST-inclusive) | `khakhra.ts` `packVariants(...)` | Plain ₹149 / ₹279 / ₹649 · Methi ₹169 / ₹319 / ₹749 · Masala ₹179 / ₹339 / ₹799 · Jeera ₹169 / ₹319 / ₹749 · Multigrain ₹199 / ₹379 / ₹899 · Family Combo ₹949 (compare-at ₹1,014) |
| Pack weights / parcel dims | `khakhra.ts` `PACKS` | 200 g → 340 g shipped, 20 × 20 × 7 cm; 400 g → 620 g, 26 × 26 × 9 cm; 1 kg → 1.4 kg, 32 × 32 × 14 cm; combo 1.2 kg → 1.75 kg, 42 × 30 × 16 cm |
| Opening stock | `khakhra.ts` `PACKS` | 150 / 90 / 40 per size; combo 30 |
| Ingredients, allergen advisory | `khakhra.ts` per product | plausible recipes; "made on lines that also handle…" wording |
| Nutrition per 100 g | `khakhra.ts` `nutritionPer100g(...)` | plausible figures — replace with lab values before launch |
| Product / category images | `khakhra.ts` (`placehold.co`) | placeholders until photography is uploaded |
| Owner admin e-mail | `SEED_OWNER_EMAIL` env at seed time; fallback shared with KAKOA (`packages/db/src/seeds/kakoa.ts`) | the KAKOA owner mailbox |
| Product badges | `khakhra.ts` | Plain / Methi "Best seller", Multigrain "New", Combo "Seasonal" |

## Seeding a database

```sh
# scratch Postgres (never the live dev DB): extensions, then migrations in order
psql "$DATABASE_URL" -c "create extension if not exists citext; create extension if not exists pgcrypto; create extension if not exists pg_trgm;"
for f in packages/db/migrations/0*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
BRAND_KEY=khakhra SEED_OWNER_EMAIL=owner@example.com pnpm db:seed   # or: pnpm db:seed -- --brand khakhra
rm -rf apps/web/.next/cache/fetch-cache                               # cached fetches outlive a reseed
```

The seed refuses to run without a brand and skips a database whose
`store_settings` already has rows — one brand per database, always.

## Gates

`pnpm typecheck && pnpm test && pnpm lint && pnpm brand-gate` must be green.
The brand gate exempts every `apps/web/src/brands/<key>/` and
`packages/brands/src/<dir>/` directory (packs, profiles, the shared fixture),
the brand seeds (`packages/db/src/seed*.ts`, `packages/db/src/seeds/`), and
flags `khakhra` outside them.
