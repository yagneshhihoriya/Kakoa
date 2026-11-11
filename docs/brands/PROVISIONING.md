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
- Flavoured / masala variants: the seed will write **500 bp** on those
  variants pending the CA's confirmation. The storefront is tax-inclusive, so
  a rate change re-prices nothing retroactively (rates are snapshotted on
  each order line).

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
| GST on flavoured variants | seed (next stage) | 500 bp pending CA |
| Prices, pack weights, nutrition | seed (next stage) | not yet seeded |

## Gates

`pnpm typecheck && pnpm test && pnpm lint && pnpm brand-gate` must be green.
The brand gate exempts every `apps/web/src/brands/<key>/` and
`packages/brands/src/<dir>/` directory (packs, profiles, the shared fixture)
and now also flags `khakhra` outside them.
