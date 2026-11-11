# Brand provisioning — one codebase, one deployment per brand

How a brand is wired into this repo and stood up as its own deployment, what
every brand shares, and — for the second brand, **Khakhra House**
(`BRAND_KEY=khakhra`) — every business value that is a placeholder until the
owner confirms it. Phase 2 stages add to this file; keep it the single list.

The model (docs/admin-platform/01-ARCHITECTURE.md Decision A1): **one app, N
deployments**. Each brand gets its own database, media bucket, domain, Vercel
project and vendor webhooks; the code, the vertical presets and (for brands of
the same legal entity) the Razorpay / Shiprocket / MSG91 accounts are shared.
`BRAND_KEY` is required at build time — it selects the brand profile
(`packages/brands`) and bundles the presentation pack (`apps/web/src/brands/<key>`
via the `@brand` alias). There is no runtime brand switching and no default.

## 1. New brand in ten steps

Steps 1–2 are code (one PR, gated by CI); 3–10 are infrastructure, repeated per
environment (production; a preview/staging project is optional but recommended).

### Step 1 — Register the brand in code

| Piece | Where | Note |
| --- | --- | --- |
| Brand key | `packages/brands/src/keys.ts` → `BRAND_KEYS` | The config env enum (`BRAND_KEY`) follows automatically |
| Profile (pure data) | `packages/brands/src/<key>/profile.ts`, registered in `packages/brands/src/index.ts` | `brandProfileSchema` (zod) is the contract; a same-entity brand spreads `packages/brands/src/shared/seller-identity.ts` instead of repeating a GSTIN |
| Presentation pack | `apps/web/src/brands/<key>/**` | Same contract as KAKOA (`apps/web/src/brands/contract.ts`): index, copy, faq, legal, journal, email (theme incl. `accent`), og, fonts, theme.css (same token NAMES, new values), Mark.tsx, illustrations, assets — every module ends with `satisfies <Type>` |
| Alias typecheck | `apps/web/tsconfig.<key>.json` + `typecheck:<key>` script in `apps/web/package.json` | `tsconfig.json` aliases `@brand` to kakoa; the per-brand tsconfig re-points it so `tsc` proves the app compiles against *this* pack too |
| Seed content | `packages/db/src/seeds/<key>.ts`, registered in `packages/db/src/seed.ts` | A `BrandSeedSpec` (`seeds/spec.ts`): categories, products/variants/images, coupons, owner fallback. `seeds/platform.ts` writes it |
| Brand gate | `scripts/brand-gate.sh` → `BRAND_KEYS`, `PATTERN`, `SKU_PATTERN` | Add the brand's words (name, vertical nouns) and its `identifierPrefix`; `apps/web/src/lib/brand.test.ts` fails until the gate and the CI matrix list every registered key |
| CI matrix | `.github/workflows/ci.yml` → `strategy.matrix.brand` | One entry per key |
| Env example | `.env.example` → "Known keys" | Names only, never values |

Run the gates: `pnpm typecheck && pnpm test && pnpm lint && pnpm brand-gate`,
then `pnpm --filter web typecheck:<key>`.

### Step 2 — Prove the build locally (scratch Postgres, never the live DB)

```sh
docker run -d --name kakoa-scratch -e POSTGRES_PASSWORD=scratch -p 54329:5432 postgres:17
export DATABASE_URL=postgres://postgres:scratch@127.0.0.1:54329/postgres
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "create extension if not exists citext; create extension if not exists pgcrypto; create extension if not exists pg_trgm;"
pnpm db:migrate                                   # drizzle-kit: every migration in packages/db/migrations
BRAND_KEY=<key> SEED_OWNER_EMAIL=owner@example.com pnpm db:seed
rm -rf apps/web/.next/cache/fetch-cache           # unstable_cache results outlive a reseed
BRAND_KEY=<key> NEXT_PUBLIC_SITE_URL=http://localhost:3000 APP_ENV=local \
  SESSION_SECRET=<32+ chars> OTP_PEPPER=<32+ chars> pnpm exec turbo build --filter=web
```

The seed refuses to run without a brand and skips a database whose
`store_settings` already has rows — one brand per database, always.

### Step 3 — Supabase project

- New project, region **ap-south-1 (Mumbai)**, one per brand (separate PII and
  backups per brand; Decision A1).
- Enable the extensions the migrations assume: `citext`, `pgcrypto`, `pg_trgm`
  (Dashboard → Database → Extensions, or the `create extension` line above).
- Note the two connection strings: the **session pooler** (port 5432) for
  migrations and seeds, the **transaction pooler** (port 6543) for the app's
  `DATABASE_URL`. `drizzle-kit migrate` keeps its journal in
  `drizzle.__drizzle_migrations` and needs session semantics; the app uses
  short pooled connections.
- Turn on PITR for production (PROJECT_PLAN §4.6).

### Step 4 — Migrate (session pooler)

```sh
DATABASE_URL=<session pooler URL> pnpm db:migrate
```

Fresh database: every migration applies in order. Existing database: see
§3 (the 0006 runbook) — back up first.

### Step 5 — Seed the brand

```sh
BRAND_KEY=<key> SEED_OWNER_EMAIL=<owner mailbox> DATABASE_URL=<session pooler URL> pnpm db:seed
```

Writes the owner admin (passwordless — email OTP, no credential), system roles,
the 15 `store_settings` rows (six legal-identity + nine policy, from the
profile), categories, products/variants/images, the `initial_stock` ledger and
coupons. `SEED_OWNER_EMAIL` is the mailbox that receives the first admin OTP.

### Step 6 — Media: R2 bucket per brand

Follow docs/MEDIA-STORAGE-R2.md §10: bucket `<key>-media`, an R2 API token
scoped to **that bucket only** (Object Read & Write), a custom media subdomain on
the brand's zone (`media.<brand-domain>`), and the six `S3_*` variables set on
the brand's Vercel project. Never share a bucket between brands — the admin's
Media Library lists every object the credentials can see.

### Step 7 — Vercel project

- Import the same GitHub repository as a **new project**; Root Directory
  `apps/web`; Framework preset Next.js. Vercel detects the pnpm workspace and
  installs at the repo root; keep the default build command (`next build`).
  If you ever switch it to `turbo build`, remember turbo's strict env mode:
  every build-time variable must be declared in `turbo.json`
  `tasks.build.env` / `passThroughEnv` or it is silently absent at build.
- Functions region `bom1`. `apps/web/vercel.json` carries the shipment-poller
  cron — it is per project, so each brand polls its own shipments.
- Environment (Production, and Preview with `APP_ENV=preview`; names only, see
  `.env.example` for the full list and comments):

  | Variable | Per brand? | Note |
  | --- | --- | --- |
  | `BRAND_KEY` | **yes** | The one that makes this project this brand |
  | `DATABASE_URL` | **yes** | Transaction pooler of Step 3 |
  | `NEXT_PUBLIC_SITE_URL` | **yes** | `https://<brand-domain>` — canonicals, sitemap, emails |
  | `APP_ENV` | per env | `production` / `preview` |
  | `SESSION_SECRET`, `OTP_PEPPER` | **yes — unique** | Never reuse across brands: a shared secret makes one brand's session cookie valid on the other |
  | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | shared (same entity) | One Razorpay account |
  | `RAZORPAY_WEBHOOK_SECRET` | **yes** | Each deployment has its own webhook endpoint (Step 9) |
  | `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` | shared (same entity) | The pickup location differs per brand in settings |
  | `SHIPROCKET_WEBHOOK_TOKEN` | **yes** | Per endpoint |
  | `CRON_SECRET` | **yes** | Vercel attaches it to the cron call |
  | `MSG91_AUTH_KEY` | shared | `MSG91_OTP_TEMPLATE_ID` is per brand (DLT template carries the brand) |
  | `RESEND_API_KEY`, `EMAIL_FROM` | **yes** | Verified sending domain per brand; `EMAIL_FROM_NAME` defaults to the profile's `email.fromName` |
  | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | **yes** | One Inngest app per deployment |
  | `SENTRY_DSN` | **yes** | One Sentry project per brand |
  | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | **yes** | Step 6 |
  | `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | **yes** | Optional; consent-gated |

### Step 8 — Domain

Add the brand's apex domain to the Vercel project (redirect `www` → apex), point
DNS at Vercel, then set `NEXT_PUBLIC_SITE_URL` to `https://<apex>` and redeploy
(it is inlined at build). Preview deployments keep `noindex`
(`APP_ENV=preview`). Use `khakhra.example` in docs until the real domain is
bought — never a real-looking placeholder.

### Step 9 — Vendors

| Vendor | Same legal entity (KAKOA + Khakhra House) | New legal entity |
| --- | --- | --- |
| **Razorpay** | Same account and keys. Add a **second webhook** `https://<brand-domain>/api/webhooks/razorpay` with its own secret → that project's `RAZORPAY_WEBHOOK_SECRET`. Settlements are per account; brand-level reconciliation is by order prefix (`identifierPrefix`) | New account, new keys, own webhook |
| **Shiprocket** | Same account. Add a pickup location for the brand if it ships from elsewhere and put its nickname in Admin → Settings → `shipping.shiprocket_pickup_location`. Register the brand's webhook URL + `SHIPROCKET_WEBHOOK_TOKEN` | New account |
| **MSG91** | Same account. DLT: register the brand's header (sender id) and an OTP template whose text carries the brand (`profile.email.smsPrefix`) → `MSG91_OTP_TEMPLATE_ID` on that project | New account + DLT entity registration |
| **Resend** | Verify the brand's sending domain (SPF, DKIM, DMARC); `EMAIL_FROM` on that project | Same |
| **Inngest / Sentry / healthchecks.io** | One app / project / set of checks per deployment | Same |

### Step 10 — First admin session and launch review

1. Sign in at `/admin` with the owner mailbox (email OTP).
2. Settings: `brand.logo_url`, `brand.og_image_url`, `storefront.hero_image_url`,
   announcement segments, social links, `ops.alert_email` / `ops.alert_phone`.
3. Media Library: upload photography; replace every `placehold.co` image on
   products and categories.
4. Taxes: confirm every variant's HSN / rate with the CA (see §5 for khakhra).
5. Work through §7 (launch checklist) and §6 (values to confirm).

## 2. Continuous integration

`.github/workflows/ci.yml` runs one job per brand (`strategy.matrix.brand`,
mirrors `BRAND_KEYS`) on pushes to `main`, pull requests and manual dispatch:

install → `pnpm typecheck` (+ `tsc -p tsconfig.<key>.json` for every non-kakoa
brand) → `pnpm test` → `pnpm lint` → `pnpm brand-gate` → create extensions →
`pnpm db:migrate` → `BRAND_KEY=<key> pnpm db:seed` → `turbo build --filter=web`,
all against a `postgres:17` service container with the six required env vars
(`APP_ENV=preview`, CI-only dummy secrets). The build prerenders the catalogue
from the seeded database, so a pack / preset / seed mismatch fails CI rather
than a shopper's page. The pnpm store is cached (`actions/setup-node`
`cache: pnpm`); pnpm's version comes from `package.json` `packageManager`.

GitHub Actions cannot run locally. The exact sequence was mirrored on
2026-11-12 against scratch Postgres (`ci_kakoa`, `ci_khakhra`, fresh databases):
typecheck 8/8, 849 tests, lint 0 errors, brand-gate clean, `pnpm db:migrate`
applied 0000–0006, `pnpm db:seed` wrote KAKOA (10 products / 12 variants /
3 coupons) and Khakhra House (6 products / 16 variants / 12 images), and
`turbo build --filter=web` succeeded for both brands. Re-run it with:

```sh
export DATABASE_URL=postgres://postgres:scratch@127.0.0.1:54329/ci_<key>   # a fresh database
export BRAND_KEY=<key> NEXT_PUBLIC_SITE_URL=http://localhost:3000 APP_ENV=preview
export SESSION_SECRET=<32+ chars> OTP_PEPPER=<32+ chars> SEED_OWNER_EMAIL=owner@example.com
pnpm typecheck && pnpm test && pnpm lint && pnpm brand-gate
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "create extension if not exists citext; create extension if not exists pgcrypto; create extension if not exists pg_trgm;"
pnpm db:migrate && pnpm db:seed
rm -rf apps/web/.next/cache/fetch-cache && pnpm exec turbo build --filter=web --force
```

### The brand gate

`scripts/brand-gate.sh` (`pnpm brand-gate`) scans every tracked source file
outside the brand-owned paths for brand or vertical words (`PATTERN`,
case-insensitive: KAKOA, chocolate, cocoa, khakhra, …) and for identifier
prefixes (`SKU_PATTERN`, case-sensitive and word-anchored: `KK-…`, `KH-…`).
Comments and allow-listed identifiers (`@kakoa/*` scopes, `*-cocoa` token
names, …) are stripped before the test. Exempt: `apps/web/src/brands/<key>/`,
`packages/brands/src/<dir>/`, the brand registry (`index.ts`, `keys.ts`), the
seed dispatcher and the per-brand seed files `packages/db/src/seeds/<key>.ts`
(the spec / writer / legal-identity modules beside them are scanned), the
kernel preset catalogue, tests, docs, `.github/`, manifests and binary assets.
Negative-tested on 2026-11-12: a planted `"Khakhra House"` string in
`apps/web/src/lib/brand.ts`, a `"khakhra"` string in `packages/core` and a
`"KH-PLAIN-200"` SKU in `packages/db/src/seeds/platform.ts` were all reported
(exit 1, three hits); the same words in a comment were not.

## 3. Runbook — migration 0006 on an existing database

`packages/db/migrations/0006_freezing_blacklash.sql` (Phase 1) is applied to
every fresh database by `pnpm db:migrate`, but **not yet to the live KAKOA
database**. It drops the column defaults on `product_variants.gst_rate_bp`,
`product_variants.hsn_code` and `orders.order_number` (the preset / profile
supply them now), adds `categories.image_url`, copies each product's
`tasting_notes[]` into `attributes.tasting_notes` (comma-joined text) and drops
the `tasting_notes` column. The column drop is the only irreversible step —
hence the backup.

1. **Quiet window.** Pause admin edits; note the current deployment id for
   rollback.
2. **Backup** with a client that matches the server major (Postgres 17):
   `pg_dump -Fc --no-owner --no-privileges "<session pooler URL>" -f kakoa-pre0006-<date>.dump`
   (keep it beside the earlier dumps outside the repo).
3. **Rehearse on scratch:** `docker run -d --name kakoa-scratch -e POSTGRES_PASSWORD=scratch -p 54329:5432 postgres:17`,
   `pg_restore -d postgres://postgres:scratch@127.0.0.1:54329/postgres --no-owner --no-privileges <dump>`,
   then run step 4 against the scratch URL and step 5's checks.
4. **Check the journal, then apply.** `select * from drizzle.__drizzle_migrations;`
   — if 0000–0005 are listed, `DATABASE_URL=<session pooler URL> pnpm db:migrate`
   applies only 0006. If the journal is missing (migrations were applied by
   hand), apply the file directly in one transaction instead:
   `psql "<session pooler URL>" -1 -v ON_ERROR_STOP=1 -f packages/db/migrations/0006_freezing_blacklash.sql`
   (the `--> statement-breakpoint` markers are SQL comments).
5. **Verify:** `\d categories` shows `image_url`; `\d products` has no
   `tasting_notes`; `select count(*) from products where attributes ? 'tasting_notes';`
   equals the pre-migration count of products with notes; `\d product_variants`
   shows `gst_rate_bp` / `hsn_code` without defaults.
6. **Deploy** the build that expects 0006 (the pre-0006 build reads
   `tasting_notes` and would error after the drop; the post-0006 build needs
   `categories.image_url`) and purge the fetch cache on the next build
   (`rm -rf apps/web/.next/cache/fetch-cache`; Vercel builds start clean).
7. **Rollback** = restore the dump into the project (or a new project and
   re-point `DATABASE_URL`) and promote the previous deployment.

## 4. Khakhra House — what exists

### Stage 1 — profile + presentation pack

| Piece | Where |
| --- | --- |
| Brand key | `packages/brands/src/keys.ts` → `BRAND_KEYS = ['kakoa', 'khakhra']` (the config env enum follows) |
| Profile (pure data) | `packages/brands/src/khakhra/profile.ts`, registered in `packages/brands/src/index.ts` |
| Shared legal entity | `packages/brands/src/shared/seller-identity.ts` — ONE fixture spread into both profiles (never a second GSTIN literal) |
| Presentation pack | `apps/web/src/brands/khakhra/**` — same contract as KAKOA (`apps/web/src/brands/contract.ts`), every module ends with `satisfies <Type>` |
| Build selection | `BRAND_KEY=khakhra pnpm --filter web build` (the `@brand` alias in `apps/web/next.config.ts`) |

### Stage 2 — per-brand seeds + the starter catalogue

| Piece | Where |
| --- | --- |
| Seed dispatcher | `packages/db/src/seed.ts` — `pnpm db:seed` seeds the brand in `BRAND_KEY`; `pnpm db:seed -- --brand khakhra` picks one explicitly. One brand per database; idempotent (skips when `store_settings` has rows) |
| Brand-agnostic writer | `packages/db/src/seeds/platform.ts` (`seedBrand`: owner admin → system roles → store_settings → categories → products / variants / images / `initial_stock` ledger → coupons) |
| Spec shape + settings rows | `packages/db/src/seeds/spec.ts` (`BrandSeedSpec`, `storeSettingsRows` = six legal-identity rows + nine policy rows, `resolveOwner`, `resolveSeedBrand`) |
| Legal identity access | `packages/db/src/seeds/legal-identity.ts` — reads the profile's `seedLegalIdentity`; the single literal stays in `packages/brands/src/shared/seller-identity.ts` |
| KAKOA content | `packages/db/src/seeds/kakoa.ts` — the Phase 0 data moved verbatim (row-for-row identical on a scratch database before and after the split) |
| Khakhra content | `packages/db/src/seeds/khakhra.ts` — 4 categories (the profile's taxonomy, placeholder tile images), 6 products / 16 variants, 12 placeholder gallery images, no coupons |
| Spec tests | `packages/db/src/seeds/seeds.test.ts` (`pnpm --filter @kakoa/db test`) |

### Stage 3 — CI matrix, brand gate, docs

| Piece | Where |
| --- | --- |
| Two-brand CI | `.github/workflows/ci.yml` (§2) |
| Khakhra alias typecheck | `apps/web/tsconfig.khakhra.json`, `pnpm --filter web typecheck:khakhra` |
| Gate extension | `scripts/brand-gate.sh` — `KH-` prefix, per-brand seed exemption only (§2); `apps/web/src/lib/brand.test.ts` keeps gate + matrix in step with `BRAND_KEYS` |
| Strict-env build | `turbo.json` `tasks.build.env` (+ `APP_ENV`, `NEXT_PUBLIC_SITE_URL`) and `passThroughEnv` (`DATABASE_URL`, `SESSION_SECRET`, `OTP_PEPPER`) so a process-env-only `turbo build` (CI) sees what `next build` needs |

### Stage 4 — Phase 2 gate (both brands, scratch Postgres, standalone server)

Run on 2026-11-12 for `khakhra` and `kakoa`, each on a fresh `postgres:17`
container: extensions → `pnpm db:migrate` (7 journal entries, 0000–0006) →
`BRAND_KEY=<brand> pnpm db:seed` → `rm -rf apps/web/.next/cache/fetch-cache`
→ `pnpm typecheck && turbo test --force && pnpm lint && pnpm brand-gate`
(+ `typecheck:khakhra`) → `turbo build --filter=web --force` with the CI env →
`node apps/web/.next/standalone/apps/web/server.js` (with `.next/static` and
`public` copied in) on 4011 / 4012 → per-route smoke.

| Check | khakhra | kakoa |
| --- | --- | --- |
| Seed | 15 settings · 4 categories · 6 products · 16 variants · 12 images | 15 · 4 · 10 · 12 · 0 (3 coupons) |
| typecheck / tests / lint / gate | 8/8 · 849 passed · 0 errors (12 pre-existing warnings) · 457 files, 0 leaks | same |
| Build | 38 s, 65 static pages, 6 PDPs prerendered | 38 s, 4 journal articles + PDPs prerendered |
| Smoke (14 routes + `/journal` + `/locator`) | all 200; brand name, Fraunces / Mukta Vaani / Hind Vadodara faces, `#8c3b1c` / `#fff7e6` / `#d9962a` tokens, `theme-color #8C3B1C`, PDP `shelfLifeDays: 90`, airtight-container storage, FSSAI licence, Wheat (gluten) allergen; sitemap without `/journal` / `/locator`; 0 chocolate / cocoa / cold-chain / Infini leaks | all 200; KAKOA, hero copy, "Ships cold", cocoa swatches, FSSAI, Infini + DM Serif Display + Poppins ship |
| Test order (mock prepaid) | `KH-48210` · 2 × KH-METHI-200 · ₹387.00 (₹338 + ₹49 shipping; HSN 1905 @ 500 bp, CGST/SGST ₹8.05 each) · payment `captured` (`rzp_test_mock`) · order `confirmed` · FakeEmailProvider: "Payment received — order KH-48210 · Khakhra House" · `notification_log` row `sent` | not repeated (Phase 1 gate) |

Fixed on the way: `packages/ui/src/tokens.css` named KAKOA's faces (Infini, DM
Serif Display) as the shared font fallbacks, so the literal reached every
brand's stylesheet — the fallbacks are now generic system stacks and the brand
gate flags `Infini` outside the packs; `/locator` now 404s for a brand with
`features.locator` off (it rendered "Coming soon" for everyone).

Known, not fixed here: every `notFound()` thrown inside a storefront page
(`/journal`, `/locator`, an unknown product slug) answers **HTTP 200 with the
404 UI**, because `apps/web/src/app/(storefront)/loading.tsx` wraps each page
in a Suspense boundary and the 200 shell is flushed before the page runs; Next
16 streams metadata too, so a `notFound()` in `generateMetadata` does not help
(tried, reverted). A real 404 status needs the gated routes handled before the
shell (a `proxy.ts` rewrite, or dropping the group-level `loading.tsx` in
favour of per-route ones). Search engines still see the 404 UI, not content.

By design on khakhra pages: the shared legal name and support desk
(`Kakao Chocolates Private Limited`, `support@kakoa.in`) — the same company —
appear in the footer, legal pages and the Organization JSON-LD (§6, "Support
mailbox"). The preview build carries `noindex, nofollow` (`APP_ENV=preview`).

### The starter catalogue

Each product is one flavour family; pack sizes are the variants (SKU
`KH-<FLAVOUR>-<SIZE>`): 200 g (default), 400 g and 1 kg, plus one single-variant
combo. Every value is a placeholder — see §6.

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
  fixture. The khakhra seed writes exactly the same legal-identity rows as the
  kakoa seed.
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

## 5. GST assumption (record, not code)

- Plain khakhra: HSN **1905**, **0 bp** (NIL since September 2025) — the
  snacks preset's `taxDefaults`, inherited unchanged.
- Seasoned variants (methi, masala, jeera) and the Family Combo that contains
  them: the seed writes **500 bp** on those variants pending the CA's
  confirmation. Multigrain is unseasoned and is treated like plain (**0 bp**) —
  confirm with the CA too. The storefront is tax-inclusive, so a rate change
  re-prices nothing retroactively (rates are snapshotted on each order line).
  Rates are edited per variant in the admin Taxes module.

## 6. Values to confirm before launch (khakhra)

Every placeholder business value in the profile, pack and seed. None of these
is a legal identifier (those are the shared entity's real values); none should
ship unreviewed.

| Value | Where it lives | Placeholder today |
| --- | --- | --- |
| **Brand name** / wordmark | `profile.name`, `email.fromName`, `subjectSuffix`, `smsPrefix`, copy & OG, `Mark.tsx` | `Khakhra House` (working name) |
| PWA short name | `profile.shortName` | `Khakhra` |
| Order / invoice prefix | `profile.identifierPrefix` | `KH` |
| **Domain** | `NEXT_PUBLIC_SITE_URL` env (never in code); Vercel project; Resend domain; media subdomain | `https://khakhra.example` in docs only |
| **Logo / favicon / OG image** | `apps/web/src/brands/khakhra/Mark.tsx`, `og.ts`, `assets/`; overridable via `brand.logo_url`, `brand.og_image_url` | drawn wordmark + original illustration |
| **Palette** | `apps/web/src/brands/khakhra/theme.css` (same token names as KAKOA); per-token admin overrides | turmeric / terracotta / cream |
| Fonts | `apps/web/src/brands/khakhra/fonts.ts` | Fraunces (display), Mukta Vaani (body), Hind Vadodara (ui) |
| Social profiles | `profile.social` | none |
| **Shipping fees / free threshold / gift wrap** | `profile.defaults.*_paise` | ₹49 / ₹149 / ₹999 / ₹49 (mirrors KAKOA) |
| **COD** | `cod_enabled`, `cod_fee_paise` | off, ₹49 |
| Payment expiry | `payment_expiry_minutes` | 30 |
| Announcement ribbon | `storefront.announcement_segments` | "Free shipping on qualifying orders" · "Hand-roasted in small batches" · "Ships crisp, anywhere in India" |
| Newsletter incentive | `storefront.newsletter_offer` | `10% off your first order` |
| Policy effective date | `policy.legal_effective_date` | `1 January 2027` |
| Damage-report window | `policy.damage_report_window_hours` | 48 h |
| **SLAs** — refund / dispatch / delivery | `policy.refund_sla_days`, `policy.dispatch_sla_days`, `policy.delivery_eta_days` | 5–7 / 1–2 / 3–7 business days |
| Shiprocket pickup nickname | `profile.defaults.shiprocket_pickup_location` → setting `shipping.shiprocket_pickup_location` | `Primary` |
| Grievance officer | `grievance_officer_name` | `Grievance Officer` |
| Shelf life claim | FAQ ("around three months"), home/about stats ("90 days of crispness") | ~90 days, per owner |
| Flavour count claim | home/about stats | 6 (the preset's flavour options) |
| Allergen claims | FAQ, allergen option list | wheat (gluten) in every pack; sesame in some varieties |
| Hero artwork / **photos** | `apps/web/src/brands/khakhra/assets/`; product & category images in `khakhra.ts` (`placehold.co`) | original illustration, no photography — upload via the Media Library, set `storefront.hero_image_url` |
| **GST on seasoned variants / combo (CA)** | `packages/db/src/seeds/khakhra.ts` (`FLAVOURED_GST_RATE_BP`) | 500 bp pending CA; multigrain 0 bp (§5) |
| **Prices** (MRP, GST-inclusive) | `khakhra.ts` `packVariants(...)` | Plain ₹149 / ₹279 / ₹649 · Methi ₹169 / ₹319 / ₹749 · Masala ₹179 / ₹339 / ₹799 · Jeera ₹169 / ₹319 / ₹749 · Multigrain ₹199 / ₹379 / ₹899 · Family Combo ₹949 (compare-at ₹1,014) |
| Pack weights / parcel dims | `khakhra.ts` `PACKS` | 200 g → 340 g shipped, 20 × 20 × 7 cm; 400 g → 620 g, 26 × 26 × 9 cm; 1 kg → 1.4 kg, 32 × 32 × 14 cm; combo 1.2 kg → 1.75 kg, 42 × 30 × 16 cm |
| Opening stock | `khakhra.ts` `PACKS` | 150 / 90 / 40 per size; combo 30 |
| **Ingredients, allergen advisory** | `khakhra.ts` per product | plausible recipes; "made on lines that also handle…" wording |
| **Nutrition per 100 g** | `khakhra.ts` `nutritionPer100g(...)` | plausible figures — replace with lab values before launch |
| Owner admin e-mail | `SEED_OWNER_EMAIL` env at seed time; fallback shared with KAKOA (`packages/db/src/seeds/kakoa.ts`) | the KAKOA owner mailbox |
| Product badges | `khakhra.ts` | Plain / Methi "Best seller", Multigrain "New", Combo "Seasonal" |
| Support mailbox | shared `SELLER_SUPPORT_CONTACT` (owner decision) | the KAKOA support desk — confirm whether the brand gets its own |

## 7. Launch checklist

- [ ] §6 reviewed line by line with the owner; the brand name is final and the
      profile, pack copy, OG image and email identity say it.
- [ ] CA has confirmed the HSN / rate of every variant (§5); Taxes module
      updated; a test order's invoice shows the right lines.
- [ ] Photography uploaded; no `placehold.co` URL left
      (`select count(*) from product_images where url like '%placehold.co%'` = 0; same for `categories.image_url`).
- [ ] Nutrition and ingredient panels carry lab / label values.
- [ ] Legal pages render the shared entity (name, GSTIN, FSSAI, address) and
      the brand's policy dates and SLAs.
- [ ] Razorpay webhook for this domain receives a test `payment.captured`;
      Shiprocket pickup location exists; MSG91 OTP template approved by DLT;
      Resend domain verified; `ops.alert_email` set.
- [ ] `NEXT_PUBLIC_SITE_URL` is the apex; sitemap and canonicals point at it;
      preview deployments are `noindex`.
- [ ] Unique `SESSION_SECRET` / `OTP_PEPPER` on this project (never copied
      from KAKOA).
- [ ] `pnpm brand-gate` clean and CI green on `main` for both brands.
- [ ] Backup schedule / PITR confirmed on the brand's Supabase project.

## 8. Gates

`pnpm typecheck && pnpm test && pnpm lint && pnpm brand-gate` must be green
(plus `pnpm --filter web typecheck:khakhra`). The brand gate exempts every
`apps/web/src/brands/<key>/` and `packages/brands/src/<dir>/` directory (packs,
profiles, the shared fixture), the seed dispatcher and the per-brand seed files
(`packages/db/src/seed*.ts`, `packages/db/src/seeds/<key>.ts`), and flags
`khakhra` / `KH-` / `Infini` outside them.

Before a brand ships, repeat the Stage 4 smoke (§4) against its built
standalone server: every public route 200, the brand's name on every page, its
faces and palette tokens in the stylesheet and no other brand's, the sitemap
without feature-gated routes, no `undefined` / `[object Object]` /
`not configured`, and one mock prepaid order (quote → place → verify) whose
number carries the brand's prefix and whose confirmation mail carries its
identity. Expect `/journal` and `/locator` to answer 200 with the 404 UI until
the Suspense caveat in §4 is addressed.
