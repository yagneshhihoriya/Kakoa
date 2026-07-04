# KAKOA — Production E-Commerce Master Plan

> D2C chocolate brand · India · 5-developer team · Target: production launch in ~11 weeks
> Deliverable owner: this document is the canonical execution plan. Field-level module specs live in [docs/modules/](docs/modules/README.md).

---

## §0 — Audit of Existing Site

### What exists

The current "site" is **one self-contained HTML bundle** (`Kakao Chocolate.html`, 9.7 MB) — a design prototype exported from a design tool, not a codebase. Internal structure: a loader shell + base64 asset manifest (16 assets: 8 woff2 fonts, 7 PNG blog images, 1 runtime JS) + a 240 KB HTML template + a 48 KB client-side React-style state machine driving 19 screens of demo state.

**Verdict: it is a design specification, not production code. Rebuild everything; carry over the design system, page inventory, and copy.**

### Page inventory (19 screens + overlays found in the prototype)

| Screen | Prototype route | Carried forward? | Notes |
|---|---|---|---|
| Home | `/` | ✅ | hero, categories, featured 4, value props, story band, newsletter |
| Shop/Collection | `/shop` | ✅ | filter chips (All/Bars/Pralines/Signature/Gifts), sort ×4 |
| Product detail | `/product/:id` | ✅ | 4-image gallery, qty stepper, tabs (desc/ingredients/reviews), related, frequently-bought-together |
| Cart | `/cart` + drawer | ✅ | line steppers, free-ship threshold, totals |
| Checkout | `/checkout` | ✅ rebuilt | 4 steps; prototype's payment methods are wrong market (see issues) |
| Order success | `/order/success` | ✅ | |
| Account dashboard | `/account` | ✅ | overview/orders/addresses/wishlist (rewards tab **deferred**) |
| Order tracking | `/account/track` | ✅ | 5-step timeline |
| Returns | `/account/returns` | ✅ | order + reason selects |
| Gift cards | `/gift-cards` | ❌ **deferred** | stored-value/PPI compliance — Phase 4+ |
| Subscription | `/subscribe` | ❌ **deferred** | recurring billing — Phase 4+ |
| Our story | `/about` | ✅ | |
| Journal + article | `/journal`, `/journal/:id` | ✅ | 6 full articles with real copy → MDX |
| Help center | `/help` | ✅ | 6 categories, 8 FAQs (real copy) |
| Store locator | `/stores` | ✅ rewritten | prototype uses fictional US addresses |
| Auth | `/login` | ✅ rebuilt | login/register/forgot/reset → replaced by OTP model |
| Legal | `/legal` | ✅ rewritten | US-flavored copy → India + FSSAI/Legal Metrology |
| 404 | `*` | ✅ | |
| Search overlay | — | ✅ | trending/popular/results states |
| "System" screen + card variants A/B/C | — | ❌ | design-playground artifacts |

### Brand system (extracted from the bundle)

- **Core palette:** Ink `#2A1D12` · Cocoa `#4A2E1C` · Espresso `#8A5A34` · Cream bg `#FBF6EF` · Card `#F3E7D5` · Line `#EADBC6`
- **Accents:** Gold/Champagne `#C69A4C` · Caramel `#CE8A3E` · Raspberry `#C25B5B` · Pistachio `#7C8A4E` · Plum `#8A5A78`
- **Type:** DM Serif Display (headlines) · Hanken Grotesque (body) · DM Mono (eyebrow labels, uppercase, 0.14 em tracking) — replicate via `next/font`
- **Patterns:** pill buttons, 999 px chips, card rounding, partial-fill star ratings, toasts, sticky header with scroll shadow, section fade-up on IntersectionObserver (reduced-motion-safe with never-hide fallback), cart-icon pop
- **Product data:** 10 SKUs across Bars/Pralines/Signature/Gifts (prototype prices in USD — see issues)

### Flagged issues (all must be addressed in the rebuild)

1. **All commerce is simulated** — `placeOrder()` only switches screens; `authSubmit()` grants dashboard access unconditionally; cart is pre-seeded and resets on reload; zero `<form>` elements.
2. **Wrong market:** USD prices, flat 8 % US-style tax, PayPal/Apple Pay options. India build requires INR integer paise, GST (HSN 1806, currently 5 %, rate stored as data), Razorpay methods, and **COD — entirely absent from the prototype**.
3. Product images are CSS gradient placeholders (the code literally says "Real product photography drops in here") — real photography is a launch dependency.
4. Store locator has fictional US addresses; legal copy is US-flavored; India rewrite + FSSAI license display + Legal Metrology (MRP, net quantity, best-before) required.
5. Free-shipping threshold, delivery options, and tracking dates are hardcoded demo values.
6. No pincode/serviceability concept anywhere; gift wrap is a toggle with no message input; no COD confirmation concept.
7. Prototype's card-variant A/B/C switcher and "system" screen are excluded from the build.

---

## §1 — Confirmed Stack & Decision Record

**Do not re-debate these.** Each was adjudicated in evaluation rounds with fact-checking; re-opening them mid-build requires an owner-approved RFC.

| Area | Decision | Key reason |
|---|---|---|
| Framework | Next.js App Router + TypeScript **strict**, ONE deployed app | SEO-critical PDPs need server rendering; one deploy surface |
| Repo | Turborepo + pnpm monorepo: `apps/web` + `packages/{db,core,integrations,ui,config,jobs}` | 5 devs need package ownership boundaries, not network boundaries |
| Architecture | **Modular monolith** — no microservices, no Kafka/Redis/event buses | 2–3 orders of magnitude below any threshold that justifies them |
| Async semantics | Inngest (Pro) durable jobs + `webhook_events` table in Postgres as source of truth | Retries/idempotency without operating queue infra |
| Database | PostgreSQL on Supabase `ap-south-1` (Mumbai), plain Postgres via pooled connections | Single-digit-ms from Vercel `bom1`; Neon has no Mumbai region |
| ORM | Drizzle (committed SQL migrations, append-only, CI-applied) | SQL-transparent for the money-critical queries; SQL migration files review well |
| Payments | **Razorpay only** (Stripe India is invite-only — verified); thin `PaymentProvider` interface as freeze insurance (Cashfree pre-scouted) | |
| COD | First-class: pre-dispatch confirmation queue, RTO states, remittance reconciliation | 20–30 % COD RTO is the #1 unit-economics threat |
| Shipping | Shiprocket behind `ShippingProvider` interface + **in-repo mock** (Shiprocket has NO sandbox — verified) | |
| SMS/OTP | MSG91 (India) behind `SmsProvider` interface | |
| Email | Resend (SPF/DKIM/DMARC on day one) | |
| Money | INR only; **integer paise everywhere**; branded `Paise` type; floats in money code fail lint | |
| Tax | GST rate as data per product (HSN 1806 @ 5 % currently); snapshot on order lines at placement | Sept-2025 GST 2.0 moved chocolate 18 %→5 %; rates change |
| Auth | Guest checkout + optional phone/email **OTP accounts** (no passwords); admin roles `owner`/`staff` only | Account walls kill Indian D2C conversion |
| Hosting | Vercel Pro, functions pinned `bom1`; `output: 'standalone'` kept as DO App Platform escape hatch | Per-PR previews are the team's collaboration backbone |
| Images | `next/image` on Vercel now; pre-named trigger to ImageKit when image billing becomes a visible line item | |
| Blog | MDX in-repo (no CMS until a non-developer writes content) | |
| Admin UI | **shadcn/ui** (new-york style, CLI v4, unified `radix-ui` package) + **TanStack Table** for data grids, themed via CSS variables mapped to KAKOA tokens; installed into `apps/web` via `components.json` (decision 2026-07-02) | Dashboard-grade components (Table, Sheet, Dialog, AlertDialog, Command, DropdownMenu) owned in-repo as source; storefront keeps bespoke `@kakoa/ui` |
| Deferred | Subscriptions, gift cards, rewards, multi-currency, WhatsApp Business API provider | Phase 4+ roadmap review at Week 13, not before |

**Webhook discipline (the single most load-bearing pattern):** verify HMAC over the **raw body** → `INSERT INTO webhook_events` (UNIQUE `(provider, event_id)`) → ack 200 in < 1 s → process async via Inngest, idempotently. Shiprocket webhooks are best-effort hints; **polling reconciliation is the primary correctness path.** Reconciliation cadence: stuck-payment sweep every 15–30 min; nightly full Razorpay + Shiprocket sweep; every cron pings a healthchecks.io dead-man switch.

---

## §2 — Team Structure & Parallelization

### 2.1 Ownership (five lanes; every package/route-group/module has exactly one owner)

**Dev A — Storefront & SEO**
Owns `apps/web/app/(storefront)/**` (except checkout), `packages/ui/**`, `apps/web/content/**` (MDX). Modules: Home, Shop, PDP, Cart UI, Search, Journal, Our Story, Contact, Store locator, Legal (incl. FSSAI display), 404, wishlist UI, reviews display, all SEO (metadata, JSON-LD, sitemap, OG), Lighthouse budgets. Reviews any `packages/ui` or public-metadata PR.

**Dev B — Platform, DB & Core Domain (schema owner)**
Owns `packages/db/**` (SOLE migration author/reviewer), `packages/core/**` (money-as-paise, GST, **order state machine**, zod contracts), `packages/config/**`, seed script, Supabase environments, Inngest setup, auth (guest sessions + OTP), Account dashboard. Reviews every migration, every `packages/core` contract change, anything touching auth/sessions.

**Dev C — Payments & Checkout**
Owns checkout route group, `api/webhooks/razorpay`, `packages/integrations/src/razorpay`, coupon redemption. Modules: 4-step checkout, cart→order conversion, Razorpay order/capture/refunds, payment webhook processing, payment reconciliation crons, order confirmation page, guest OTP order lookup. Reviews any money-math or webhook PR.

**Dev D — Fulfillment & Admin**
Owns `apps/web/app/(admin)/**`, `packages/integrations/src/{shiprocket,resend}`, fulfillment Inngest jobs. Modules: admin dashboard/orders/customers/coupons-CRUD/reviews-moderation/staff-roles, **COD confirmation queue**, RTO/NDR views, products/variants/inventory admin, Shiprocket pipeline (AWB, pickup, label, tracking sync), order tracking data, transactional emails. Reviews `ShippingProvider`/mock changes, admin routes, fulfillment jobs.

**Dev E — QA, DevOps & CI (floating)**
Owns `.github/workflows/**`, `e2e/**`, `packages/core/src/testing/**` (fixtures + MSW), observability config. Modules: CI gates, merge queue, preview wiring, Playwright suites, webhook replay harness, Lighthouse CI, load-smoke, seed integrity, launch checklist. **~50 % floats from Week 4 into whichever lane is behind — E is the schedule buffer, not a fifth feature lane.** Second reviewer on webhooks and migrations.

**Bus-factor rule (enforced via CODEOWNERS + branch protection, not convention):** any PR touching money or order-state code — `packages/core` (money/GST/coupons/state machine), checkout server actions, webhook handlers, refund paths, migrations on `orders`/`payments`/`refunds` — requires **two approvals: Dev C + one of Dev B or Dev E** (if C authored: B + E).

### 2.2 Dependency map

**Weeks 1–2 = all-hands contract phase (hard-sequential; no feature lane starts before it's done):**
monorepo scaffold + import-boundary lint (E, d1–2) → CI skeleton (E, d2–3) → **DB schema v1** (B leads, all review, d2–5) → `packages/core` money/GST + **order state machine v1** (B + C, d4–8) → provider interfaces + Shiprocket mock stub (C + D, d5–8) → zod API contracts (B leads, all sign, d6–10) → seed script (B + E, d8–10). Dev A runs design tokens + `packages/ui` primitives in parallel all fortnight (depends only on the prototype).

**Post-contract DAG:**

```
monorepo + CI
  └─ DB schema v1
       └─ seed script
            └─ zod contracts + fixtures  ◄── THE CONTRACT
                 ├─ Lane A: storefront pages (MSW mocks → real queries)
                 ├─ Lane B: auth/OTP + account + platform hardening
                 ├─ Lane C: checkout UI → Razorpay → webhooks → refunds
                 └─ Lane D: admin catalog → Shiprocket mock → COD queue

Hard-sequential inside lanes:
  C: checkout steps → Razorpay order → payment webhook → order paid → refunds
  D: ShippingProvider mock → fulfillment jobs → tracking sync → real client → RTO/NDR
Cross-lane:  order paid (C) → COD queue (D) → dispatch (D) → tracking page (A/D)
             reviews schema (B) → post-purchase trigger (D) → moderation (D) → PDP display (A)
```

**The single most contested artifact: `packages/core/src/orders/state-machine.ts`.** Four of five lanes touch it. Governance: **Wednesday Order Council** (45 min, weekly, Week 2 → launch) — walk the state diagram against the week's new fixture orders; state-machine changes ship only as standalone PRs labeled `state-machine`, approved by B + C + D; CI blocks PRs mixing `state-machine.ts` with other app code; the transition table targets **100 % branch coverage, enforced in CI**.

### 2.3 Contract-first strategy

- **Source of truth:** `packages/core/src/contracts/` — zod schemas for every API payload and domain object. TS types are `z.infer` only; hand-written duplicate types and `as any` on contract types fail lint.
- **Mocking:** typed fixtures in `packages/core/src/testing/fixtures/` (canonical orders in every state, catalog, coupons, Shiprocket payloads) + MSW handlers built from them. Lane A builds all storefront screens against MSW from Phase 1 day 1; Lane D builds fulfillment against the in-repo Shiprocket mock replaying the same fixtures. **Fixtures are validated against zod contracts in CI** — a breaking contract change fails the build immediately, which is the point.
- **Sign-off:** B owns contracts. Additive change: B + one consuming-lane owner, same-day merge fine. Breaking change: one atomic PR containing contract + fixtures + MSW updates; CODEOWNERS auto-requests every lane importing the schema; announced at Order Council or with a 4-hour objection window.
- **Seed data is part of the contract:** "order KAK-1042 is the COD-confirmed-awaiting-pickup one" is shared vocabulary. Playwright, MSW, and preview DBs all derive from the same seed; changing seed = contract change = same review rules.

### 2.4 Branching & review

**Trunk-based, short-lived branches (< 2 days), no long-lived feature branches** — four lanes share one schema and one core package; long-lived branches guarantee migration collisions. Not shippable → behind a flag, not on a branch.

- Branch naming `lane/short-desc`; rebase daily; branch older than 2 working days is split or flag-gated and merged.
- **GitHub merge queue ON** — serializes final CI, guarantees linear migration application order; at 10–20 PRs/week the latency is negligible and it kills the "two green PRs jointly red" failure class.
- Approvals: 1 (area owner) default; 2 for bus-factor scope, all migrations (B + one), state-machine PRs (B + C + D), CI workflow changes (E + one).
- **CI gates, in order:** tsc strict → ESLint + import-boundary check (storefront ∉ admin; only data layers import `db`; `core` imports nothing app-side) → Vitest (`core` coverage gates) → **Drizzle migration drift check** → fixture-vs-contract validation → build → Playwright checkout smoke on the Vercel preview (prepaid + COD placement, ~4 min) → Lighthouse CI on PDP + Home (mid-tier Android, slow 4G; advisory W3–4, **blocking from W5**).
- **Feature flags:** env `FLAG_*` for infra toggles (real Shiprocket vs mock, crons on/off); tiny DB `flags` table with admin toggle for behavior flags (COD enabled, reviews visible). Every flag gets a removal ticket at creation; > 3-week-old flags called out at Order Council.
- **Migrations:** one per PR, append-only linear history, `db push` banned outside local, CI is the only actor applying to staging/prod, expand-and-contract for anything destructive.

### 2.5 Parallel workstream count (honest)

**4 concurrent feature lanes maximum, E floating.** Five independent lanes with 5 devs = zero slack and nobody watching integration. From Phase 2 the effective count drops to **3 independent streams + 1 tightly-coordinated payments↔fulfillment pair (C+D)**.

**Hard calendar gates:**
1. **Contract gate (end W2):** no feature work before schema v1 + state machine v1 + contracts + seed are merged.
2. **Order-lifecycle gate (end W8):** prepaid AND COD orders go created → paid/confirmed → dispatched → delivered on staging via the mock, driven entirely through the admin UI.
3. **COD gate:** confirmation queue live, staff-tested, and measured **before any paid marketing spend** — at 20–30 % RTO, acquisition without it burns cash directly.
4. **Staging bake gate (W10):** scripted smoke suite passes on staging on 3 separate days, run by a different dev each day (fresh-eyes rule): prepaid path · COD path incl. confirmation · COD cancel-after-confirm + prepaid refund (full & partial) · webhook replay (duplicate → no-op) & out-of-order delivery · **missed-webhook reconciliation drill** (kill webhook delivery, place order, verify the sweep repairs it) · Shiprocket fixture replay (pickup fail, NDR, RTO) · guest OTP lookup · coupon apply/exhaust · oversell guard.

---

## §3 — Phase-Wise Master Plan

**How to read this section.** §3.0 embeds the full Contract v1.0.0 (complete DDL + API). Module sections §3.1–§3.14 follow, grouped by phase, each with the same 8 subsections: Purpose & Ownership · Database Schema · API Design · Frontend Requirements · Admin Panel Requirements · Edge Cases · Testing Requirements · Production-Readiness & DoD. Field-level implementation specs (regexes, exact error messages, mermaid diagrams) live in [docs/modules/](docs/modules/README.md).

**Phase map** (calendar from §2.5; module build order within each phase is the listed order):

| Phase | Weeks | Goal | Modules |
|---|---|---|---|
| **0 — Foundations & Contract** | 1–2 | Walking skeleton + signed contract so 4 lanes run independently | §3.1 Design System · §3.2 Webhooks/Jobs infra · schema/contracts/seed (all-hands) |
| **1 — Catalog, Browse & Mocked Checkout** | 3–5 | Customer browses everything; checkout walks end-to-end on test payments; admin manages catalog | §3.3 Catalog · §3.4 Cart · §3.5 Auth/Accounts · §3.6 Checkout/Orders · §3.7 Content/SEO · §3.14 Admin (catalog CRUD part) |
| **2 — Order Lifecycle, COD & Money Truth** | 6–8 | Every order reaches a terminal state truthfully, incl. COD and failure paths | §3.8 Payments/COD · §3.9 Coupons · §3.10 Fulfillment/Shipping · §3.11 Reviews · §3.12 Returns/Refunds · §3.13 Emails · §3.14 Admin (full ops) |
| **3 — Hardening & Real Shiprocket** | 9 | Observability live; real-courier drill; load-smoke | no new modules — convergence |
| **4 — Staging Bake & Launch** | 10–11 | Production-shaped boredom, then launch | smoke suite ×3 days, launch checklist |
| **5 — Post-launch Stabilization** | 11–12 | Watch real orders; tune COD; then open marketing | daily reconciliation review, COD gate verification |

---

### §3.0 — The Contract (Database Schema & API, v1.0.0)

> Authored contract-first; every lane builds against this. Changes follow §3.4 versioning discipline inside the contract itself.

I have everything I need: the prototype (catalog of 10 products across Bars/Pralines/Signature/Gifts, 4-step checkout, tracking timeline, returns reasons, order number format `KK-XXXXX`, dashboard tabs) and the confirmed stack. The project directory is empty greenfield, so this contract is the founding artifact. Below is the complete deliverable.

---



**Status: source of truth.** Frontend and backend build against this document. Changes follow the versioning discipline in §3.4.

## 0. Global Conventions (binding)

| Concern | Decision |
|---|---|
| IDs | `uuid PRIMARY KEY DEFAULT gen_random_uuid()`. Human-facing identifiers (`order_number`, `invoice_number`, `sku`, `slug`) are separate `text UNIQUE` columns. Never expose serial ints. |
| Money | `integer` **paise**, column suffix `_paise`. INR only; `currency char(3) NOT NULL DEFAULT 'INR'` on orders for future-proofing. No floats, no `numeric` for money. |
| Tax | Consumer prices are **GST-inclusive** (MRP). `gst_rate_bp` = basis points (5% = `500`). Tax portion is *extracted*, never added: `tax = round(gross * rate_bp / (10000 + rate_bp))`. Intra-state (ship-to state == seller state from `store_settings`) → CGST+SGST split (half each, remainder to CGST); inter-state → IGST. Shipping/COD/gift-wrap fees are taxed as composite supply at the blended goods rate (v1 simplification: 5%, HSN 1806). |
| Time | Every timestamp is `timestamptz`. DB and app servers run UTC. **Display is always Asia/Kolkata (IST)** via `formatIST()` in `packages/core`. Admin metric date ranges are interpreted as IST calendar days and converted to UTC bounds server-side. |
| Naming | snake_case tables/columns, plural table names, `created_at`/`updated_at` (trigger-maintained `set_updated_at()`) on every mutable table. |
| Deletes | Catalog entities are never hard-deleted (`is_active`/`archived_at` soft flags). Hard deletes allowed only for: cart_items, wishlist_items, customer_addresses (with `ON DELETE` behavior below), expired otp_challenges (cron purge). |
| Extensions | `pgcrypto` (gen_random_uuid), `citext` (case-insensitive email/coupon codes), `pg_trgm` (search). |
| Connections | Supabase transaction-mode pooler (port 6543), Drizzle + postgres-js with `prepare: false`. No RLS (all access via the app's service role; Supabase Auth is not used). |
| Migrations | Drizzle Kit generated SQL committed to `packages/db/migrations/`; forward-only; every enum addition is its own migration (`ALTER TYPE ... ADD VALUE` can't run in a transaction with other DDL). |

---

## 1. Complete Postgres Schema

### 1.0 Enum types

```sql
CREATE TYPE order_status AS ENUM (
  'pending_payment','payment_failed','cod_pending_confirmation','confirmed',
  'packed','shipped','out_for_delivery','delivered',
  'cancelled','rto_initiated','rto_delivered');

CREATE TYPE payment_mode      AS ENUM ('prepaid','cod');
CREATE TYPE payment_provider  AS ENUM ('razorpay','cod');           -- 'stripe' added later via migration
CREATE TYPE payment_status    AS ENUM (
  'created','authorized','captured','failed',
  'partially_refunded','refunded',
  'cod_pending_collection','cod_collected','cod_pending_remittance','cod_remitted');
CREATE TYPE payment_method    AS ENUM ('card','upi','netbanking','wallet','emi','cod','unknown');

CREATE TYPE refund_status      AS ENUM ('initiated','processed','failed');
CREATE TYPE refund_destination AS ENUM ('original_method','bank_transfer','upi');

CREATE TYPE shipment_status AS ENUM (
  'pending','awb_assigned','pickup_scheduled','picked_up','in_transit',
  'out_for_delivery','delivered','rto_initiated','rto_in_transit','rto_delivered',
  'cancelled','lost');

CREATE TYPE webhook_provider AS ENUM ('razorpay','shiprocket');
CREATE TYPE webhook_status   AS ENUM ('received','processing','processed','failed','skipped');

CREATE TYPE otp_channel  AS ENUM ('sms','email');
CREATE TYPE otp_purpose  AS ENUM ('customer_login','cod_verification','order_lookup','admin_login');

CREATE TYPE cart_status     AS ENUM ('active','merged','converted','abandoned');
CREATE TYPE delivery_option AS ENUM ('standard','express');

CREATE TYPE review_status  AS ENUM ('pending','approved','rejected');
CREATE TYPE return_status  AS ENUM ('requested','approved','rejected','pickup_scheduled','received','refunded','closed','cancelled');
CREATE TYPE return_reason  AS ENUM ('damaged_or_melted','wrong_item','quality_issue','changed_mind','other');
CREATE TYPE return_resolution AS ENUM ('refund','replacement');

CREATE TYPE admin_role AS ENUM ('owner','staff');
CREATE TYPE actor_type AS ENUM ('system','customer','admin','webhook');

CREATE TYPE inventory_reason AS ENUM (
  'initial_stock','order_placed','order_cancelled','payment_expired',
  'rto_restock','return_restock','manual_adjustment','stock_correction','damage_writeoff');
```

The canonical string lists for these enums live in `packages/core/src/enums.ts` (see §3.1); `packages/db` builds `pgEnum` from them so DB and zod can never drift.

---

### 1.1 `store_settings`
> Singleton key/value config for legally required display data and fee policy — changing a fee must not require a deploy, and orders snapshot fees anyway.

```sql
CREATE TABLE store_settings (
  key        text PRIMARY KEY,          -- e.g. 'fssai_license_number','seller_gstin','seller_state_code',
                                        -- 'seller_legal_name','seller_address','origin_pincode',
                                        -- 'shipping_fee_standard_paise','shipping_fee_express_paise',
                                        -- 'free_shipping_threshold_paise','cod_fee_paise',
                                        -- 'gift_wrap_fee_paise','payment_expiry_minutes','support_phone','support_email'
  value      jsonb NOT NULL,
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```
Seed values (v1 policy, snapshot onto every order): standard ₹4900 paise, free ≥ ₹99900; express ₹14900 flat; COD fee ₹4900; gift wrap ₹4900/line; payment expiry 30 min. FSSAI license number and Legal Metrology seller details render in the footer and on invoices from here.

### 1.2 `categories`
> Table, not enum: admin adds seasonal collections without a migration; carries display order and copy. Seeds: Bars, Pralines, Signature, Gifts.

```sql
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name        text NOT NULL,
  description text,
  position    integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### 1.3 `products`
> The sellable concept (Truffle Noir); price/stock/GST live on variants. Carries FSSAI/Legal-Metrology copy (ingredients, allergens, shelf life) and denormalized rating aggregates for list pages.

```sql
CREATE TABLE products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name          text NOT NULL,
  category_id   uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  blurb         text NOT NULL DEFAULT '',           -- card one-liner
  description   text NOT NULL DEFAULT '',           -- PDP "Description" tab (markdown)
  tasting_notes text[] NOT NULL DEFAULT '{}',       -- ['Cocoa','Caramel',...]
  ingredients   text NOT NULL DEFAULT '',           -- FSSAI: full ingredient list
  allergens     text NOT NULL DEFAULT '',           -- FSSAI: "Contains milk, soy. May contain nuts."
  nutrition_facts jsonb,                            -- per-100g table
  shelf_life_days integer CHECK (shelf_life_days > 0),
  storage_instructions text,
  is_veg        boolean NOT NULL DEFAULT true,      -- FSSAI green/brown dot mark
  badge         text,                               -- 'Best seller' | 'New' | 'Limited' | 'Vegan' | 'Seasonal'
  tone          text NOT NULL DEFAULT 'dark',       -- design-system placeholder tone
  rating_avg    numeric(3,2) NOT NULL DEFAULT 0,    -- DENORMALIZED: recomputed on review approve/reject
  rating_count  integer NOT NULL DEFAULT 0,         -- DENORMALIZED
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_active_idx ON products (category_id) WHERE is_active;
CREATE INDEX products_search_idx ON products USING gin ((name || ' ' || blurb) gin_trgm_ops);
```

### 1.4 `product_variants`
> The purchasable SKU (70g bar / 16-pc box). Owns price, MRP compare-at, GST rate **as data**, HSN, physicals for Shiprocket, and the authoritative stock counter (oversell prevention in §1.28).

```sql
CREATE TABLE product_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku           text NOT NULL UNIQUE,               -- 'KK-TRN-16PC'
  name          text NOT NULL,                      -- '16-piece box', '70g bar'
  price_paise   integer NOT NULL CHECK (price_paise > 0),        -- MRP, GST-inclusive
  compare_at_price_paise integer CHECK (compare_at_price_paise > price_paise),
  gst_rate_bp   integer NOT NULL DEFAULT 500 CHECK (gst_rate_bp BETWEEN 0 AND 2800),
  hsn_code      text NOT NULL DEFAULT '1806',
  weight_grams  integer NOT NULL CHECK (weight_grams > 0),        -- net quantity (Legal Metrology)
  ship_weight_grams integer NOT NULL,                             -- packed weight for courier rating
  length_cm     numeric(6,2), breadth_cm numeric(6,2), height_cm numeric(6,2),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),  -- authoritative on-hand
  low_stock_threshold integer NOT NULL DEFAULT 10,
  position      integer NOT NULL DEFAULT 0,
  is_default    boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_product_idx ON product_variants (product_id);
CREATE UNIQUE INDEX product_variants_one_default_idx
  ON product_variants (product_id) WHERE is_default;             -- exactly one default per product
CREATE INDEX product_variants_low_stock_idx
  ON product_variants (stock_quantity) WHERE is_active AND stock_quantity <= 10;  -- admin low-stock list
```

### 1.5 `product_images`
> Gallery per product, optionally pinned to a variant (small vs large box shots). Files live in Supabase Storage; DB stores the public URL.

```sql
CREATE TABLE product_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  url        text NOT NULL,
  alt        text NOT NULL DEFAULT '',
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_pos_idx ON product_images (product_id, position);
```

### 1.6 `customers`
> Passwordless identities. Phone is the primary key in practice (OTP + COD India norm); email optional. A row is created on first successful OTP verification.

```sql
CREATE TABLE customers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone             text UNIQUE CHECK (phone ~ '^\+91[6-9][0-9]{9}$'),
  email             citext UNIQUE,
  phone_verified_at timestamptz,
  email_verified_at timestamptz,
  name              text,
  is_blocked        boolean NOT NULL DEFAULT false,   -- serial-RTO abusers
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
```

### 1.7 `customer_sessions`
> Opaque revocable sessions (httpOnly cookie stores the raw token; DB stores only its SHA-256). 30-day rolling expiry.

```sql
CREATE TABLE customer_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  user_agent  text, ip inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_sessions_customer_idx ON customer_sessions (customer_id) WHERE revoked_at IS NULL;
```

### 1.8 `otp_challenges`
> One row per issued code, all purposes (login, COD verify, guest order lookup, admin login). Codes are 6 digits, TTL 10 min, hashed with a server pepper; attempts capped at 5. Rate limits (§2.1) are enforced by counting rows here — the DB is the authority, not Redis.

```sql
CREATE TABLE otp_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel     otp_channel NOT NULL,
  destination text NOT NULL,                 -- E.164 phone or lowercased email
  purpose     otp_purpose NOT NULL,
  code_hash   text NOT NULL,                 -- sha256(code || pepper)
  context     jsonb,                         -- e.g. {"order_number":"KK-48210"} for order_lookup
  attempts    integer NOT NULL DEFAULT 0 CHECK (attempts <= 5),
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  ip          inet
);
CREATE INDEX otp_open_idx ON otp_challenges (destination, purpose, created_at DESC)
  WHERE consumed_at IS NULL;                 -- partial: hot path only scans open challenges
CREATE INDEX otp_rate_idx ON otp_challenges (destination, created_at);  -- send-rate window counts
```

### 1.9 `customer_addresses`
> Saved address book. Orders never reference these rows — they snapshot (§1.14) — so deletes are safe.

```sql
CREATE TABLE customer_addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT 'Home',
  full_name   text NOT NULL,
  phone       text NOT NULL CHECK (phone ~ '^\+91[6-9][0-9]{9}$'),
  line1       text NOT NULL,
  line2       text,
  landmark    text,
  city        text NOT NULL,
  state       text NOT NULL,
  state_code  char(2) NOT NULL,              -- GST state code, e.g. '27'
  pincode     char(6) NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customer_addresses_one_default_idx
  ON customer_addresses (customer_id) WHERE is_default;
```

### 1.10 `carts`
> Guest carts keyed by an httpOnly cookie token; owned carts keyed by customer. Merge on login marks the guest cart `merged`. Cart lines are **never** price snapshots — pricing is always live (§1.27).

```sql
CREATE TABLE carts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),   -- cookie value for guests
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  status      cart_status NOT NULL DEFAULT 'active',
  coupon_id   uuid REFERENCES coupons(id) ON DELETE SET NULL,   -- applied pre-checkout, revalidated at quote/place
  merged_into_cart_id uuid REFERENCES carts(id),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX carts_one_active_per_customer_idx
  ON carts (customer_id) WHERE status = 'active' AND customer_id IS NOT NULL;
CREATE INDEX carts_abandoned_sweep_idx ON carts (updated_at) WHERE status = 'active';
```

### 1.11 `cart_items`
> One line per variant per cart (`UNIQUE (cart_id, variant_id)`); gift wrap/message attach to the line, matching the prototype's per-item gift customization.

```sql
CREATE TABLE cart_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id      uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id   uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity     integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  gift_wrap    boolean NOT NULL DEFAULT false,
  gift_message text CHECK (char_length(gift_message) <= 300),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, variant_id)
);
```

### 1.12 `coupons`
> Percent or flat discounts with windows, caps, and usage limits. `redemption_count` enables the atomic exhaustion check (§1.28). Codes stored uppercase.

```sql
CREATE TABLE coupons (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               citext NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 3 AND 24),
  description        text NOT NULL DEFAULT '',
  percent_bp         integer CHECK (percent_bp BETWEEN 1 AND 10000),   -- 1000 = 10%
  flat_paise         integer CHECK (flat_paise > 0),
  max_discount_paise integer CHECK (max_discount_paise > 0),           -- cap for percent coupons
  min_subtotal_paise integer NOT NULL DEFAULT 0,
  starts_at          timestamptz NOT NULL DEFAULT now(),
  ends_at            timestamptz,
  usage_limit        integer CHECK (usage_limit > 0),                  -- global
  per_customer_limit integer NOT NULL DEFAULT 1,
  first_order_only   boolean NOT NULL DEFAULT false,
  redemption_count   integer NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  created_by         uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(percent_bp, flat_paise) = 1)
);
```

### 1.13 `coupon_redemptions`
> Per-order audit + per-customer/per-phone limit enforcement (guests tracked by phone so limits survive account-less checkouts).

```sql
CREATE TABLE coupon_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id     uuid NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id   uuid REFERENCES customers(id) ON DELETE SET NULL,
  contact_phone text NOT NULL,
  discount_paise integer NOT NULL CHECK (discount_paise >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, order_id)
);
CREATE INDEX coupon_redemptions_phone_idx ON coupon_redemptions (coupon_id, contact_phone);
```

### 1.14 `orders`
> The aggregate root. Guest-first (`customer_id` nullable, contact fields NOT NULL). Every money figure and the address are **snapshots** — catalog, settings, and address-book changes must never mutate a placed order. `idempotency_key` makes placement retry-safe; `access_token` authorizes the guest success page.

```sql
CREATE TABLE orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number   text NOT NULL UNIQUE,        -- 'KK-48210'; 'KK-' || lpad(nextval('order_number_seq'),5,'0')
  invoice_number text UNIQUE,                 -- GST invoice serial 'KK/25-26/00042'; assigned at 'packed'
  customer_id    uuid REFERENCES customers(id) ON DELETE SET NULL,   -- NULL = guest
  cart_id        uuid REFERENCES carts(id) ON DELETE SET NULL,
  status         order_status NOT NULL,
  payment_mode   payment_mode NOT NULL,
  currency       char(3) NOT NULL DEFAULT 'INR',

  contact_phone  text NOT NULL CHECK (contact_phone ~ '^\+91[6-9][0-9]{9}$'),
  contact_email  citext,
  cod_phone_verified_at timestamptz,          -- set when COD OTP passed at placement

  shipping_address jsonb NOT NULL,            -- SNAPSHOT {fullName,phone,line1,line2,landmark,city,state,stateCode,pincode}
  billing_address  jsonb,                     -- NULL = same as shipping
  ship_to_state_code char(2) NOT NULL,        -- drives CGST/SGST vs IGST split
  delivery_opt   delivery_option NOT NULL,

  subtotal_paise        integer NOT NULL CHECK (subtotal_paise >= 0),      -- sum of line totals (GST-incl)
  discount_paise        integer NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  shipping_fee_paise    integer NOT NULL DEFAULT 0 CHECK (shipping_fee_paise >= 0),  -- SNAPSHOT of settings
  cod_fee_paise         integer NOT NULL DEFAULT 0 CHECK (cod_fee_paise >= 0),       -- SNAPSHOT
  gift_wrap_total_paise integer NOT NULL DEFAULT 0 CHECK (gift_wrap_total_paise >= 0),
  total_paise           integer NOT NULL CHECK (total_paise >= 0),
  cgst_paise integer NOT NULL DEFAULT 0,      -- informational extraction from inclusive prices
  sgst_paise integer NOT NULL DEFAULT 0,
  igst_paise integer NOT NULL DEFAULT 0,

  coupon_id     uuid REFERENCES coupons(id) ON DELETE SET NULL,
  coupon_code   text,                          -- SNAPSHOT: survives coupon edits/deletes

  idempotency_key text UNIQUE,                 -- client-generated per placement attempt
  access_token  uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),  -- guest success-page auth, 24h honored
  customer_note text,
  cancel_reason text,
  placed_at     timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz, packed_at timestamptz, shipped_at timestamptz,
  delivered_at  timestamptz, cancelled_at timestamptz, rto_delivered_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (total_paise = subtotal_paise - discount_paise + shipping_fee_paise
                      + cod_fee_paise + gift_wrap_total_paise)
);
CREATE INDEX orders_customer_idx ON orders (customer_id, placed_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX orders_status_idx   ON orders (status, placed_at DESC);
CREATE INDEX orders_open_ops_idx ON orders (placed_at)                   -- admin ops queue: partial, tiny & hot
  WHERE status IN ('cod_pending_confirmation','confirmed','packed');
CREATE INDEX orders_phone_idx    ON orders (contact_phone);              -- guest lookup + COD abuse checks
CREATE INDEX orders_pending_expiry_idx ON orders (placed_at) WHERE status = 'pending_payment';  -- expiry sweep
```

### 1.15 `order_items`
> Immutable invoice lines. Everything the invoice needs is denormalized here (name, SKU, HSN, GST rate, unit price, per-line tax split) so GST invoices and order history render identically forever, regardless of catalog edits. `variant_id` is `RESTRICT` — variants are archived, never deleted.

```sql
CREATE TABLE order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id    uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_name  text NOT NULL,                -- SNAPSHOT
  variant_name  text NOT NULL,                -- SNAPSHOT
  sku           text NOT NULL,                -- SNAPSHOT
  image_url     text,                         -- SNAPSHOT
  hsn_code      text NOT NULL,                -- SNAPSHOT
  gst_rate_bp   integer NOT NULL,             -- SNAPSHOT
  unit_price_paise integer NOT NULL CHECK (unit_price_paise > 0),  -- SNAPSHOT (GST-inclusive)
  quantity      integer NOT NULL CHECK (quantity > 0),
  line_total_paise integer NOT NULL,          -- unit*qty + gift_wrap_fee
  taxable_value_paise integer NOT NULL,       -- extracted: line_total - line tax
  cgst_paise integer NOT NULL DEFAULT 0, sgst_paise integer NOT NULL DEFAULT 0, igst_paise integer NOT NULL DEFAULT 0,
  gift_wrap     boolean NOT NULL DEFAULT false,
  gift_wrap_fee_paise integer NOT NULL DEFAULT 0,   -- SNAPSHOT of settings at placement
  gift_message  text CHECK (char_length(gift_message) <= 300),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx   ON order_items (order_id);
CREATE INDEX order_items_variant_idx ON order_items (variant_id);   -- "customers also bought" + sales-by-SKU
```

### 1.16 `order_status_history`
> Append-only transition log: every state change with actor and cause. This is what renders the tracking timeline and settles COD/RTO disputes.

```sql
CREATE TABLE order_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,                   -- NULL for creation
  to_status   order_status NOT NULL,
  actor_type  actor_type NOT NULL,
  actor_id    uuid,                           -- admin_users.id / customers.id / NULL
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX osh_order_idx ON order_status_history (order_id, created_at);
```

### 1.17 `payments`
> One row per payment attempt (retries create new rows). Razorpay ids are unique where present. COD money is tracked through the collection → remittance lifecycle so "cash with courier" is never invisible.

```sql
CREATE TABLE payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider           payment_provider NOT NULL,
  provider_order_id  text,                    -- razorpay_order_id ('order_xxx')
  provider_payment_id text,                   -- razorpay_payment_id ('pay_xxx')
  method             payment_method NOT NULL DEFAULT 'unknown',
  status             payment_status NOT NULL DEFAULT 'created',
  amount_paise       integer NOT NULL CHECK (amount_paise > 0),
  amount_refunded_paise integer NOT NULL DEFAULT 0 CHECK (amount_refunded_paise <= amount_paise),
  signature_verified boolean NOT NULL DEFAULT false,   -- checkout HMAC verified (webhook may also confirm)
  failure_code       text, failure_reason text,
  cod_remitted_at    timestamptz, cod_remittance_ref text,   -- Shiprocket COD remittance batch id
  raw_payload        jsonb,                   -- last provider payload for debugging
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_provider_payment_idx ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX payments_provider_order_idx ON payments (provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;
CREATE INDEX payments_order_idx ON payments (order_id);
CREATE INDEX payments_cod_remit_idx ON payments (status) WHERE status IN ('cod_collected','cod_pending_remittance');
```

**Payment state machine.** Prepaid: `created → authorized → captured`; `created|authorized → failed`; `captured → partially_refunded → refunded`. COD: `cod_pending_collection` (set at order confirm) `→ cod_collected` (delivered) `→ cod_pending_remittance → cod_remitted`; RTO ⇒ `failed`.

### 1.18 `refunds`
> One row per refund instruction. Prepaid refunds go through Razorpay (`provider_refund_id`); COD refunds (return after delivery) are manual bank/UPI payouts with an operator-entered reference.

```sql
CREATE TABLE refunds (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id         uuid REFERENCES payments(id) ON DELETE SET NULL,
  return_request_id  uuid REFERENCES return_requests(id) ON DELETE SET NULL,
  provider_refund_id text,                    -- 'rfnd_xxx'
  destination        refund_destination NOT NULL,
  amount_paise       integer NOT NULL CHECK (amount_paise > 0),
  status             refund_status NOT NULL DEFAULT 'initiated',
  reason             text NOT NULL,
  payout_reference   text,                    -- UTR / UPI ref for manual COD refunds
  initiated_by       uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  processed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX refunds_provider_idx ON refunds (provider_refund_id) WHERE provider_refund_id IS NOT NULL;
CREATE INDEX refunds_order_idx ON refunds (order_id);
```

### 1.19 `shipments`
> One active shipment per order (partial unique on `superseded_at IS NULL` — an RTO'd or cancelled shipment gets superseded when the order is reshipped). Holds all Shiprocket handles: SR order/shipment ids, AWB, courier, label.

```sql
CREATE TABLE shipments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shiprocket_order_id   text,
  shiprocket_shipment_id text,
  awb_code              text UNIQUE,          -- courier tracking number; webhook correlation key
  courier_company_id    integer, courier_name text,
  label_url             text, manifest_url text,
  status                shipment_status NOT NULL DEFAULT 'pending',
  cod                   boolean NOT NULL DEFAULT false,
  pickup_scheduled_at   timestamptz,
  expected_delivery_at  timestamptz,          -- courier ETD; feeds "Expected Jul 4" in timeline
  last_synced_at        timestamptz,          -- polling reconciliation watermark
  superseded_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX shipments_one_active_idx ON shipments (order_id) WHERE superseded_at IS NULL;
CREATE INDEX shipments_stale_poll_idx ON shipments (last_synced_at)  -- Inngest 30-min reconciliation cron scans this
  WHERE superseded_at IS NULL
    AND status IN ('awb_assigned','pickup_scheduled','picked_up','in_transit','out_for_delivery','rto_initiated','rto_in_transit');
```

### 1.20 `shipment_events`
> Append-only courier scan log from webhooks *and* polling; `source` disambiguates. Dedup by natural key so retried webhooks and poll overlap don't double-insert.

```sql
CREATE TABLE shipment_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status      shipment_status NOT NULL,       -- mapped from SR status code
  sr_status_code text,                        -- raw Shiprocket code, e.g. '17'
  activity    text, location text,
  occurred_at timestamptz NOT NULL,
  source      text NOT NULL CHECK (source IN ('webhook','poll','manual')),
  raw         jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, status, occurred_at)
);
CREATE INDEX shipment_events_shipment_idx ON shipment_events (shipment_id, occurred_at);
```

### 1.21 `webhook_events`
> The idempotency ledger for all inbound webhooks — the "persist" half of persist-then-ack (§2.6). `UNIQUE (provider, event_id)` is the dedupe gate. Razorpay `event_id` = `x-razorpay-event-id` header. Shiprocket sends no event id, so `event_id = sha256(awb || '|' || current_status || '|' || current_timestamp)` computed from the payload.

```sql
CREATE TABLE webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     webhook_provider NOT NULL,
  event_id     text NOT NULL,
  event_type   text NOT NULL,                 -- 'payment.captured' / SR status label
  payload      jsonb NOT NULL,                -- raw body, verbatim
  headers      jsonb,
  status       webhook_status NOT NULL DEFAULT 'received',
  error        text,
  attempts     integer NOT NULL DEFAULT 0,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_id)
);
CREATE INDEX webhook_events_pending_idx ON webhook_events (received_at)
  WHERE status IN ('received','failed');      -- partial: worker + ops dashboard only see unfinished
```

### 1.22 `inventory_adjustments`
> Append-only stock ledger. `stock_quantity` on the variant is the authoritative counter; every change writes a ledger row *in the same transaction* with the resulting balance. The partial unique index makes cancel/RTO restocks idempotent — a webhook replay can never restock twice.

```sql
CREATE TABLE inventory_adjustments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id    uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  delta         integer NOT NULL CHECK (delta <> 0),
  reason        inventory_reason NOT NULL,
  order_id      uuid REFERENCES orders(id) ON DELETE SET NULL,
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  note          text,
  stock_after   integer NOT NULL CHECK (stock_after >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inv_adj_variant_idx ON inventory_adjustments (variant_id, created_at DESC);
CREATE UNIQUE INDEX inv_adj_once_per_cause_idx ON inventory_adjustments (order_id, variant_id, reason)
  WHERE reason IN ('order_placed','order_cancelled','payment_expired','rto_restock','return_restock');
```

### 1.23 `reviews`
> Post-purchase only: `order_item_id UNIQUE` is both the proof-of-purchase and the one-review-per-purchase constraint. Moderated (`pending` by default). Approve/reject recomputes `products.rating_avg/rating_count` in the same transaction.

```sql
CREATE TABLE reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
  rating        integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title         text CHECK (char_length(title) <= 120),
  body          text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
  status        review_status NOT NULL DEFAULT 'pending',
  moderated_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  moderated_at  timestamptz, moderation_note text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_product_approved_idx ON reviews (product_id, created_at DESC)
  WHERE status = 'approved';                  -- partial: PDP only ever reads approved
CREATE INDEX reviews_moderation_queue_idx ON reviews (created_at) WHERE status = 'pending';
```

### 1.24 `wishlist_items`
> Product-level (matches prototype hearts). Composite PK — no surrogate needed.

```sql
CREATE TABLE wishlist_items (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, product_id)
);
```

### 1.25 `return_requests` + `return_request_items`
> Item-level returns with photo evidence (perishable goods: 7-day window post-delivery, damaged/melted is the dominant case). Links forward to `refunds`. One open request per order enforced by partial unique.

```sql
CREATE TABLE return_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id  uuid REFERENCES customers(id) ON DELETE SET NULL,   -- NULL = guest via OTP token
  status       return_status NOT NULL DEFAULT 'requested',
  reason       return_reason NOT NULL,
  resolution   return_resolution NOT NULL DEFAULT 'refund',
  comment      text CHECK (char_length(comment) <= 1000),
  photo_urls   text[] NOT NULL DEFAULT '{}',
  decided_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  decided_at   timestamptz, decision_note text,
  received_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX return_requests_one_open_idx ON return_requests (order_id)
  WHERE status IN ('requested','approved','pickup_scheduled');
CREATE INDEX return_requests_queue_idx ON return_requests (created_at) WHERE status = 'requested';

CREATE TABLE return_request_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id uuid NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  order_item_id     uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity          integer NOT NULL CHECK (quantity > 0),
  UNIQUE (return_request_id, order_item_id)
);
```

### 1.26 `admin_users`, `admin_sessions`, `admin_audit_log`
> Passwordless admin (email OTP, purpose `admin_login`) with two roles. Separate session table from customers — different cookie, different lifetime (12h). Audit log records every mutating admin action for a 5-person team's accountability.

```sql
CREATE TABLE admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  name          text NOT NULL,
  role          admin_role NOT NULL DEFAULT 'staff',
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz, ip inet, user_agent text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action        text NOT NULL,               -- 'order.transition','refund.initiate','product.update',...
  entity_type   text NOT NULL, entity_id uuid,
  before        jsonb, after jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_entity_idx ON admin_audit_log (entity_type, entity_id, created_at DESC);
```

---

### 1.27 Order state machine (normative)

**States (11):**

| State | Meaning | Terminal |
|---|---|---|
| `pending_payment` | Prepaid order placed; Razorpay order created; stock reserved (decremented) | no |
| `payment_failed` | Last attempt failed; retryable for 24h | no |
| `cod_pending_confirmation` | COD placed (phone OTP already verified at placement); awaiting merchant confirmation call/WhatsApp before dispatch | no |
| `confirmed` | Money captured (prepaid) or COD confirmed; committed to fulfil | no |
| `packed` | Picked, packed; GST invoice number assigned | no |
| `shipped` | AWB assigned, courier picked up | no |
| `out_for_delivery` | Courier OFD scan | no |
| `delivered` | POD received; COD payment → `cod_collected` | **yes** (returns via `return_requests`) |
| `cancelled` | Cancelled pre-dispatch; stock restocked; prepaid auto-refunded | **yes** |
| `rto_initiated` | Courier returning to origin (refused / undeliverable / unreachable) | no |
| `rto_delivered` | Back at warehouse; QC restock; COD loss recorded | **yes** |

**Legal transitions (anything not listed is rejected with 422 `INVALID_TRANSITION`):**

| From | To | Trigger / actor |
|---|---|---|
| `pending_payment` | `confirmed` | `payment.captured` webhook or `/checkout/verify` (system/webhook) |
| `pending_payment` | `payment_failed` | `payment.failed` webhook |
| `pending_payment` | `cancelled` | 30-min expiry Inngest job; customer cancel |
| `payment_failed` | `pending_payment` | customer retry-payment |
| `payment_failed` | `cancelled` | 24h expiry job; customer |
| `cod_pending_confirmation` | `confirmed` | admin confirm-COD action; customer self-confirm link |
| `cod_pending_confirmation` | `cancelled` | admin decline; customer cancel; 48h-unreachable job |
| `confirmed` | `packed` | admin |
| `confirmed` | `cancelled` | admin/customer (auto-refund if prepaid) |
| `packed` | `shipped` | Shiprocket pickup webhook/poll; admin |
| `packed` | `cancelled` | admin (rare; auto-refund) |
| `shipped` | `out_for_delivery` | webhook/poll |
| `shipped` | `delivered` | webhook/poll (couriers sometimes skip OFD scan) |
| `shipped` | `rto_initiated` | webhook/poll |
| `out_for_delivery` | `delivered` | webhook/poll |
| `out_for_delivery` | `rto_initiated` | webhook/poll (failed attempts/NDR) |
| `rto_initiated` | `out_for_delivery` | webhook/poll (NDR resolved, re-attempt) |
| `rto_initiated` | `rto_delivered` | webhook/poll; admin |

The transition map is data: `ORDER_TRANSITIONS` in `packages/core/src/order-state-machine.ts`, imported by API, admin UI (button enablement), and tests. All transitions execute as: `SELECT ... FOR UPDATE` on the order row → validate against map → `UPDATE orders` + `INSERT order_status_history` + side effects (restock, refund, payment status) in one transaction.

**Stock lifecycle:** decrement at placement (both modes); restock on `cancelled`, `payment_expired`, `rto_delivered` (after QC), and return `received` — each idempotent via `inv_adj_once_per_cause_idx`.

### 1.28 Concurrency & integrity patterns (normative)

1. **Oversell prevention — atomic conditional decrement, not FOR UPDATE:**
   ```sql
   UPDATE product_variants SET stock_quantity = stock_quantity - $qty
   WHERE id = $id AND stock_quantity >= $qty AND is_active
   RETURNING stock_quantity;
   ```
   Zero rows ⇒ abort the placement transaction ⇒ API 409 `OUT_OF_STOCK` with per-variant availability. Ledger row inserted in the same tx.
2. **Coupon exhaustion:** `UPDATE coupons SET redemption_count = redemption_count + 1 WHERE id = $1 AND is_active AND (usage_limit IS NULL OR redemption_count < usage_limit) RETURNING id` — zero rows ⇒ 422 `COUPON_EXHAUSTED`. Runs inside the placement tx so a failed placement rolls the count back.
3. **Order transitions:** `SELECT ... FOR UPDATE` on `orders` (single row, short tx) — serializes webhook vs admin vs poller races.
4. **Webhook workers:** Inngest functions claim `webhook_events` rows with `UPDATE ... SET status='processing' WHERE id=$1 AND status IN ('received','failed')`; concurrency capped per provider by Inngest config; out-of-order Shiprocket events are tolerated because order transitions validate against the map and stale statuses are skipped (`skipped`).
5. **Idempotent placement:** `orders.idempotency_key UNIQUE`; on conflict return the original placement response (200, `IDEMPOTENCY_REPLAY` flag in meta).

### 1.29 Denormalized snapshot register

| Location | Snapshotted from | Why |
|---|---|---|
| `order_items.product_name/variant_name/sku/image_url` | products/variants | catalog edits must not rewrite invoices/history |
| `order_items.hsn_code/gst_rate_bp/unit_price_paise/tax splits` | variants + tax calc | GST invoice immutability; rate changes (5%→x%) apply only to new orders |
| `orders.shipping_address/billing_address` (jsonb) | customer_addresses / checkout form | address-book edits/deletes must not affect placed orders |
| `orders.coupon_code/discount_paise` | coupons | coupon rules mutate; the granted discount is a fact |
| `orders.shipping_fee/cod_fee/gift_wrap` fees | store_settings | fee policy changes are not retroactive |
| `order_items.gift_wrap_fee_paise` | store_settings | same |
| `products.rating_avg/rating_count` | reviews | read-path perf on grids; recomputed transactionally on moderation |
| **Not snapshotted:** cart_items prices | — | carts reprice live; `/checkout/quote` is authoritative; placement re-verifies against client's `expectedTotalPaise` (409 `PRICE_CHANGED`) |

---

## 2. Complete API Contract

### 2.1 Cross-cutting conventions

**Envelope (every Route Handler response and every Server Action return value):**
```ts
type ApiOk<T>  = { ok: true; data: T; meta?: { page?: number; pageSize?: number; total?: number; requestId: string } };
type ApiErr    = { ok: false; error: { code: ErrorCode; message: string;          // human-readable, safe to show
                    details?: unknown;                                             // machine data, e.g. stock availability
                    fieldErrors?: Record<string, string[]> };                      // zod flatten() output
                  requestId: string };
type ApiResult<T> = ApiOk<T> | ApiErr;
```

**Error code registry (`packages/core/src/errors.ts`) → HTTP status:**

| Code | HTTP | Code | HTTP |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `COUPON_INVALID` / `COUPON_EXPIRED` / `COUPON_MIN_NOT_MET` / `COUPON_EXHAUSTED` / `COUPON_LIMIT_REACHED` | 422 |
| `UNAUTHORIZED` | 401 | `PINCODE_UNSERVICEABLE` / `COD_UNAVAILABLE` | 422 |
| `OTP_INCORRECT` / `SIGNATURE_INVALID` | 401 | `INVALID_TRANSITION` / `RETURN_WINDOW_CLOSED` / `REFUND_EXCEEDS_PAID` | 422 |
| `FORBIDDEN` | 403 | `RATE_LIMITED` | 429 |
| `NOT_FOUND` | 404 | `INTERNAL` | 500 |
| `CONFLICT` / `OUT_OF_STOCK` / `PRICE_CHANGED` / `ALREADY_PROCESSED` / `DUPLICATE_REQUEST` | 409 | `UPSTREAM_ERROR` (Razorpay/Shiprocket/SMS down) | 502 |
| `GONE` / `OTP_EXPIRED` / `CART_EXPIRED` / `TOKEN_EXPIRED` | 410 | | |

Server Actions never throw for expected failures — they return `ApiErr` (React `useActionState`-friendly); the HTTP column applies to Route Handlers.

**Auth tiers:** `public` · `customer` (httpOnly cookie `kakoa_session` → `customer_sessions`) · `guest-token` (short-lived Bearer JWT from OTP order lookup, or `orders.access_token` ≤24h after placement) · `admin:staff` / `admin:owner` (cookie `kakoa_admin` → `admin_sessions`; owner ⊇ staff) · `webhook` (signature/shared secret).

**Rate limits** (middleware token buckets; OTP limits additionally enforced authoritatively by counting `otp_challenges` rows):

| Class | Applies to | Policy |
|---|---|---|
| A public read | catalog, search, serviceability | 120/min per IP |
| B session mutation | cart, wishlist, addresses, reviews | 60/min per session/cart-token |
| C OTP | otp request | 1/60s + 3/10min + 10/day per destination; 20/hr per IP. Verify: 5 attempts per challenge then 410 |
| D checkout | quote, place, verify, retry | 10/min per session |
| E admin | /api/admin/* | 600/min per admin session |
| webhooks | — | unlimited; signature-gated |

Headers on every rate-limited class: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (unix seconds); 429 additionally sends `Retry-After` (seconds) and body code `RATE_LIMITED`.

**Server Actions vs Route Handlers (rule):** Server Actions for first-party, session-bound, form/UI mutations (cart, wishlist, addresses, profile, review create, return create, coupon apply). Route Handlers for: anything needing raw body (webhooks), anything called by external systems or non-React clients (Razorpay checkout callback, OTP endpoints, tracking), cacheable GETs (catalog), and the entire admin API (uniform, testable, curl-able). All GET catalog routes send `Cache-Control: s-maxage=60, stale-while-revalidate=300`.

Common failure modes apply to **all** endpoints and are not repeated below: 400 `VALIDATION_ERROR` (zod), 401 `UNAUTHORIZED` (missing/expired session for the stated tier), 403 `FORBIDDEN` (role), 429 `RATE_LIMITED`, 500 `INTERNAL`. Only endpoint-specific codes are listed.

---

### 2.2 Catalog (public, Route Handlers, cached)

```
GET /api/catalog/categories                                     → { categories: Category[] }
GET /api/catalog/products?category=&sort=featured|price_asc|price_desc|rating&page=1&pageSize=24&q=
    → { products: ProductCard[] }  (meta.total for pagination)
GET /api/catalog/products/[slug]
    → { product: ProductDetail }   404 NOT_FOUND (or inactive)
GET /api/catalog/products/[slug]/reviews?page=1&pageSize=10
    → { reviews: ReviewPublic[]; summary: { avg: number; count: number; histogram: Record<1|2|3|4|5, number> } }
GET /api/catalog/search?q=truffle&limit=8                       → { results: SearchHit[] }   (trgm-backed, PDP quick search)
```
```ts
type ProductCard = { id: string; slug: string; name: string; blurb: string; badge: string | null;
  categorySlug: string; ratingAvg: number; ratingCount: number; imageUrl: string | null;
  fromPricePaise: number; compareAtPricePaise: number | null; inStock: boolean };
type ProductDetail = ProductCard & {
  description: string; tastingNotes: string[]; ingredients: string; allergens: string;
  nutritionFacts: Record<string, string> | null; shelfLifeDays: number | null; storageInstructions: string | null;
  isVeg: boolean; fssaiLicense: string;                       // from store_settings — Legal Metrology/FSSAI display
  images: { id: string; url: string; alt: string; variantId: string | null }[];
  variants: { id: string; sku: string; name: string; pricePaise: number; compareAtPricePaise: number | null;
              weightGrams: number; inStock: boolean; stockLow: boolean; isDefault: boolean }[];
  related: ProductCard[];                                     // same category, top-rated, excl. self
  frequentlyBoughtTogether: ProductCard[] };                  // co-occurrence in order_items, fallback best sellers
```

### 2.3 Cart (Server Actions + one GET)

```
GET /api/cart                          public (cart cookie / session)     → { cart: CartView }  (never 404 — returns empty cart)
```
```ts
// Server Actions (packages/core exports the zod input schemas; apps/web/lib/actions/cart.ts implements)
addToCart({ variantId: string; qty: number; giftWrap?: boolean; giftMessage?: string })     → ApiResult<CartView>
  // errors: OUT_OF_STOCK (409-equivalent; details: { available: number }), NOT_FOUND (inactive variant)
updateCartItem({ itemId: string; qty: number })                                             → ApiResult<CartView>   // qty 0 = remove
setGiftOptions({ itemId: string; giftWrap: boolean; giftMessage?: string })                 → ApiResult<CartView>
removeCartItem({ itemId: string })                                                          → ApiResult<CartView>
applyCoupon({ code: string })    → ApiResult<CartView>   // COUPON_INVALID | COUPON_EXPIRED | COUPON_MIN_NOT_MET | COUPON_EXHAUSTED | COUPON_LIMIT_REACHED
removeCoupon()                   → ApiResult<CartView>

type CartView = { id: string; lines: { itemId: string; variantId: string; productSlug: string; name: string;
    variantName: string; imageUrl: string | null; unitPricePaise: number; qty: number;
    giftWrap: boolean; giftMessage: string | null; lineTotalPaise: number;
    stockState: 'ok' | 'low' | 'out' }[];                    // live-priced, live-stock every read
  subtotalPaise: number; giftWrapTotalPaise: number;
  coupon: { code: string; discountPaise: number } | null;
  freeShippingThresholdPaise: number; count: number };
```
**Merge contract (server-side, inside OTP verify):** guest cart lines fold into the customer's active cart; same variant ⇒ quantities sum (capped at 20 and at stock); guest line's gift fields win on conflict; guest coupon wins if customer cart has none; guest cart → `status='merged'`, cookie rotated to the surviving cart.

### 2.4 Customer auth, addresses, account (Class C for OTP)

```
POST /api/auth/otp/request        public   { channel: 'sms'|'email'; destination: string; purpose: 'customer_login' }
    → { challengeId: string; resendAfterSec: 60 }            // always 200 even if customer doesn't exist (no enumeration)
    errors: 429; 502 UPSTREAM_ERROR (SMS/email provider down)
POST /api/auth/otp/verify         public   { challengeId: string; code: string }
    → Set-Cookie kakoa_session; { customer: { id; name; phone; email }; cartMerged: boolean; isNewCustomer: boolean }
    errors: 401 OTP_INCORRECT (details: { attemptsLeft }); 410 OTP_EXPIRED (also after 5 attempts / already consumed)
POST /api/auth/logout             customer → { }             // revokes session, clears cookie
GET  /api/auth/me                 customer → { customer: CustomerProfile }   401 if no session
```
```ts
// Server Actions
updateProfile({ name?: string; email?: string })              → ApiResult<CustomerProfile>  // email change → email OTP re-verify flow
listAddresses()                                               → ApiResult<{ addresses: Address[] }>
createAddress(AddressInput)                                   → ApiResult<Address>          // zod: pincode ^[1-9]\d{5}$, phone +91
updateAddress({ id } & Partial<AddressInput>)                 → ApiResult<Address>          // NOT_FOUND if not owner's
deleteAddress({ id })                                         → ApiResult<{}>
setDefaultAddress({ id })                                     → ApiResult<{ addresses: Address[] }>
toggleWishlist({ productId })                                 → ApiResult<{ wished: boolean }>
```
```
GET /api/account/wishlist         customer → { items: ProductCard[] }
GET /api/account/orders?page=     customer → { orders: OrderSummary[] }
GET /api/account/orders/[orderNumber]  customer → { order: OrderDetail }   404 if not owner's
GET /api/account/returns          customer → { returns: ReturnRequestView[] }
```

### 2.5 Serviceability, checkout, payment (Class D; Route Handlers — external calls)

```
GET /api/shipping/serviceability?pincode=560001&cod=true       public
    → { serviceable: boolean; codAvailable: boolean;
        options: { option: 'standard'|'express'; feePaise: number; etaDaysMin: number; etaDaysMax: number }[] }
    errors: 400 (bad pincode); 422 PINCODE_UNSERVICEABLE; 502 UPSTREAM_ERROR (Shiprocket down — UI falls back to "standard only, verified at dispatch")

POST /api/checkout/quote          public (cart cookie)
    { pincode: string; deliveryOption: 'standard'|'express'; paymentMode: 'prepaid'|'cod'; couponCode?: string }
    → { quote: CheckoutQuote }
    errors: 410 CART_EXPIRED (empty/expired); 409 OUT_OF_STOCK (details: lines); 422 coupon codes; 422 PINCODE_UNSERVICEABLE | COD_UNAVAILABLE

POST /api/checkout/orders         public (cart cookie) | customer      — PLACE ORDER
    { idempotencyKey: string;                       // uuid, client-generated per attempt
      contact: { phone: string; email?: string };
      shippingAddress: AddressInput; billingAddress?: AddressInput;
      deliveryOption: 'standard'|'express'; paymentMode: 'prepaid'|'cod';
      couponCode?: string; customerNote?: string;
      expectedTotalPaise: number;                   // what the UI displayed — server re-verifies
      codOtp?: { challengeId: string; code: string } }   // REQUIRED for cod unless customer session w/ verified phone
    → 201 prepaid: { orderId; orderNumber; accessToken;
                     razorpay: { orderId: string; keyId: string; amountPaise: number; currency: 'INR';
                                 prefill: { contact: string; email?: string } } }
      201 cod:     { orderId; orderNumber; accessToken; status: 'cod_pending_confirmation' }
    errors: 401 OTP_INCORRECT / 410 OTP_EXPIRED (COD otp); 409 OUT_OF_STOCK (details: [{variantId, requested, available}]);
            409 PRICE_CHANGED (details: { quote: CheckoutQuote }); 409 DUPLICATE_REQUEST → replays original 201 body;
            410 CART_EXPIRED; 422 coupon/serviceability codes; 502 UPSTREAM_ERROR (Razorpay order create failed —
            order rolled to payment_failed, stock released, client may retry with a new idempotencyKey)

POST /api/checkout/verify         public            — Razorpay JS success handler
    { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
    → { orderNumber: string; status: 'confirmed' }
    errors: 401 SIGNATURE_INVALID; 404 (unknown razorpayOrderId); 409 ALREADY_PROCESSED (idempotent — returns confirmed state, still ok:true? No: ok:true with meta.duplicate); 502

POST /api/checkout/orders/[orderId]/retry-payment   guest-token | customer
    → { razorpay: {...} }        errors: 404; 409 CONFLICT (already paid); 410 GONE (cancelled/expired); 502
```
```ts
type CheckoutQuote = { lines: CartView['lines'];
  subtotalPaise: number; discountPaise: number; shippingFeePaise: number;
  codFeePaise: number; giftWrapTotalPaise: number; totalPaise: number;
  taxIncluded: { cgstPaise: number; sgstPaise: number; igstPaise: number };   // informational (prices are inclusive)
  coupon: { code: string; discountPaise: number } | null;
  etaDaysMin: number; etaDaysMax: number };
```
**Placement transaction (normative order):** validate quote → `INSERT orders` (status `pending_payment` | `cod_pending_confirmation`) → atomic stock decrements (§1.28.1, abort on any failure) → coupon increment (§1.28.2) → `order_items` snapshots → `payments` row (`created` | `cod_pending_collection` set later at confirm) → commit → *then* call Razorpay Orders API (prepaid); on Razorpay failure: compensating tx (restock, payment `failed`, order `payment_failed`) → 502. Webhook `payment.captured` is the source of truth; `/checkout/verify` is the fast path — both idempotently converge on `confirmed`.

### 2.6 Webhooks (Route Handlers, raw body — **persist-then-ack contract**)

```
POST /api/webhooks/razorpay       webhook (HMAC SHA256 of raw body with webhook secret; header x-razorpay-signature)
POST /api/webhooks/shiprocket     webhook (shared secret header x-api-key configured in SR panel)
POST /api/webhooks/inngest        (Inngest serve endpoint — framework-managed, signed)
```
**Exact contract (both providers):**
1. Read **raw** body (no framework JSON parsing before signature check).
2. Verify signature/secret. Fail → **401** `SIGNATURE_INVALID`, *nothing persisted*.
3. Compute `event_id`: Razorpay = `x-razorpay-event-id` header; Shiprocket = `sha256(awb|current_status|current_timestamp)` from payload.
4. `INSERT INTO webhook_events ... ON CONFLICT (provider, event_id) DO NOTHING`. Conflict → **200** `{ ok: true, data: { duplicate: true } }` (ack, never reprocess).
5. `inngest.send('{provider}/event.received', { webhookEventId })`.
6. Return **200** `{ ok: true, data: { received: true } }` — target < 2s, always before any business logic.
7. **500 only if the insert itself fails** (DB down) — provider retry is the recovery path. Processing errors happen in Inngest (retries w/ backoff), never surface to the provider.

Handled events — Razorpay: `payment.captured`, `payment.failed`, `payment.authorized`, `refund.processed`, `refund.failed`, `order.paid`. Shiprocket: status pushes mapped to `shipment_status`; drives shipment_events insert + order transitions (`packed→shipped→out_for_delivery→delivered`, RTO states) via the state machine (stale/unknown → `skipped`). **Reconciliation:** Inngest cron every 30 min polls SR `track/awb` for active shipments with `last_synced_at > 6h` (undocumented webhook retries mean webhooks are best-effort; polling is the guarantee). Second cron reconciles Razorpay orders stuck `pending_payment` > 45 min via Orders API before expiring them.

### 2.7 Order tracking & cancellation (guest via OTP)

```
POST /api/orders/lookup/request-otp   public (Class C)   { orderNumber: string; phone: string }
    → { sent: true }                       // ALWAYS 200 with generic body — no order/phone enumeration
POST /api/orders/lookup/verify        public             { orderNumber: string; phone: string; code: string }
    → { trackingToken: string /* JWT 30 min: {orderId, scope:'tracking'} */; order: OrderSummary }
    errors: 401 OTP_INCORRECT; 410 OTP_EXPIRED
GET  /api/orders/[orderNumber]/tracking    customer-owner | Bearer trackingToken | ?accessToken= (≤24h post-placement)
    → { order: OrderSummary; timeline: TimelineStep[]; shipment: { awb; courierName; expectedDeliveryAt } | null }
    errors: 401; 404; 410 TOKEN_EXPIRED
POST /api/orders/[orderNumber]/cancel      customer-owner | Bearer trackingToken
    { reason: string } → { order: OrderSummary }
    errors: 422 INVALID_TRANSITION (already packed/shipped); 404; 401
```
```ts
type TimelineStep = { key: 'placed'|'confirmed'|'packed'|'shipped'|'out_for_delivery'|'delivered'
                          |'cancelled'|'rto_initiated'|'rto_delivered';
  label: string; state: 'done'|'active'|'future'; at: string | null; expected: string | null };  // ISO UTC; UI renders IST
```

### 2.8 Reviews & returns (storefront side)

```ts
// Server Actions (customer)
createReview({ orderItemId: string; rating: 1|2|3|4|5; title?: string; body: string })
    → ApiResult<{ review: ReviewOwnView }>      // status:'pending' — "visible after moderation" UI
    // errors: NOT_FOUND (not your item); 422 INVALID_TRANSITION (order not delivered); 409 CONFLICT (already reviewed)
createReturnRequest({ orderNumber: string; items: { orderItemId: string; qty: number }[];
                      reason: ReturnReason; resolution: 'refund'|'replacement'; comment?: string; photoUrls: string[] })
    → ApiResult<{ returnRequest: ReturnRequestView }>
    // errors: 422 RETURN_WINDOW_CLOSED (>7 days post-delivery); 409 CONFLICT (open request exists); NOT_FOUND
```
```
POST /api/returns                 guest variant of createReturnRequest, auth: Bearer trackingToken  (same shape/errors)
POST /api/uploads/return-photos   customer | guest-token   { count: number } → { uploads: { url, path }[] }  // signed Supabase Storage PUT URLs, 5 max, 5MB, image/*
```

### 2.9 Admin API (Route Handlers under `/api/admin/*`; staff unless marked **owner**)

```
POST /api/admin/auth/otp/request   public (Class C)  { email }        → { challengeId }   // only for active admin_users; generic 200 otherwise
POST /api/admin/auth/otp/verify    public            { challengeId; code } → Set-Cookie kakoa_admin; { admin: { id; name; role } }
POST /api/admin/auth/logout        admin             → { }

-- Catalog
GET    /api/admin/products?q=&category=&active=&page=              → { products: AdminProductRow[] }
POST   /api/admin/products         { ...ProductInput }             → 201 { product }        409 CONFLICT (slug taken)
GET    /api/admin/products/[id]                                    → { product: AdminProductDetail }
PATCH  /api/admin/products/[id]    Partial<ProductInput>           → { product }             404
DELETE /api/admin/products/[id]                                    → { product }             // soft: is_active=false, never 409
POST   /api/admin/products/[id]/variants      { ...VariantInput }  → 201 { variant }         409 (sku taken)
PATCH  /api/admin/variants/[id]               Partial<VariantInput> → { variant }            // price/gst_rate_bp changes affect future orders only
DELETE /api/admin/variants/[id]                                    → { variant }             // soft archive
POST   /api/admin/products/[id]/images        { fileName; contentType } → { uploadUrl; image }  // signed URL flow
PATCH  /api/admin/products/[id]/images        { order: imageId[] } → { images }
DELETE /api/admin/images/[id]                                      → { }

-- Inventory
GET  /api/admin/inventory?lowStock=true&page=                      → { rows: { variant; stockQuantity; threshold }[] }
POST /api/admin/inventory/adjust   { variantId; delta: number; reason: 'manual_adjustment'|'stock_correction'|'damage_writeoff'|'initial_stock'; note?: string }
     → { variant; adjustment }     errors: 409 CONFLICT (would go negative — atomic guarded update)
GET  /api/admin/inventory/ledger?variantId=&page=                  → { adjustments: InventoryAdjustment[] }

-- Orders & fulfilment
GET  /api/admin/orders?status=&paymentMode=&q=&from=&to=&page=     → { orders: AdminOrderRow[] }   // q matches order_number/phone/email; from/to are IST dates
GET  /api/admin/orders/[id]                                        → { order: AdminOrderDetail }   // items, payments, refunds, shipments+events, history, return requests
POST /api/admin/orders/[id]/transition   { to: OrderStatus; note?: string }
     → { order }                   errors: 422 INVALID_TRANSITION (details: { allowed: OrderStatus[] })
POST /api/admin/orders/[id]/confirm-cod  { outcome: 'confirmed'|'cancelled'; note?: string }        // the COD confirmation action
     → { order }                   errors: 422 INVALID_TRANSITION (not in cod_pending_confirmation)
POST /api/admin/orders/[id]/cancel       { reason: string }        → { order }   // restock + auto-refund if captured; 422

-- Shipments (Shiprocket push)
POST /api/admin/orders/[id]/shipments    { courierCompanyId?: number }   // omit = SR-recommended courier
     → 201 { shipment }            // one call = create SR order + assign AWB + generate label; partial success persisted with status 'pending'
     errors: 409 CONFLICT (active shipment exists); 422 INVALID_TRANSITION (order not confirmed/packed); 502 UPSTREAM_ERROR (SR error passthrough in details)
GET  /api/admin/shipments/[id]/label     → { labelUrl }            502 if regeneration fails
POST /api/admin/shipments/[id]/pickup    { date?: string }         → { shipment }   502
POST /api/admin/shipments/[id]/cancel                              → { shipment }   422 (already picked up); 502

-- Refunds  (owner)
POST /api/admin/orders/[id]/refunds  { amountPaise: number; reason: string; destination: 'original_method'|'bank_transfer'|'upi'; payoutReference?: string; returnRequestId?: string }
     → 201 { refund }              errors: 422 REFUND_EXCEEDS_PAID (details: { refundablePaise }); 409 (refund already in flight); 502 (Razorpay)

-- Returns
GET  /api/admin/returns?status=&page=                              → { returns: AdminReturnRow[] }
POST /api/admin/returns/[id]/decision   { action: 'approve'|'reject'; note?: string }   → { returnRequest }  422 (not requested)
POST /api/admin/returns/[id]/mark-received  { restock: boolean }   → { returnRequest }  // restock ⇒ ledger 'return_restock'

-- Reviews moderation
GET  /api/admin/reviews?status=pending&page=                       → { reviews: AdminReviewRow[] }
POST /api/admin/reviews/[id]/moderate   { action: 'approve'|'reject'; note?: string }   → { review }  // recomputes product aggregates; 409 already moderated

-- Coupons (owner)
GET/POST /api/admin/coupons; PATCH/DELETE /api/admin/coupons/[id]  // DELETE = is_active=false; POST 409 code taken

-- Customers
GET /api/admin/customers?q=&page=                                  → { customers: { id; name; phone; email; orderCount; ltvPaise; rtoCount; isBlocked }[] }
GET /api/admin/customers/[id]                                      → { customer; orders: OrderSummary[] }
POST /api/admin/customers/[id]/block  { blocked: boolean }         → { customer }

-- Metrics
GET /api/admin/metrics/dashboard?from=2026-07-01&to=2026-07-31     // IST calendar dates
    → { revenuePaise: { captured; codCollected; refunded }; orderCounts: Record<OrderStatus, number>;
        aovPaise: number; codShare: number; rtoRate: number;       // rto_delivered / shipped, trailing window
        pendingCodConfirmations: number; pendingReviews: number; openReturns: number;
        topProducts: { productId; name; unitsSold; revenuePaise }[]; lowStockCount: number }

-- Admin users (owner)
GET/POST /api/admin/users; PATCH /api/admin/users/[id]  { role?, isActive?, name? }   // cannot deactivate last owner → 422
```

---

## 3. Shared Contract Artifacts (5-dev parallel plan)

### 3.1 Package boundaries

```
packages/core   — THE CONTRACT. Zero runtime deps beyond zod. Importable by client & server.
  src/enums.ts                 ORDER_STATUSES, PAYMENT_STATUSES, ... as `as const` tuples — single source
  src/errors.ts                ErrorCode union + code→HTTP map
  src/envelope.ts              ApiOk/ApiErr/ApiResult
  src/money.ts                 formatPaise(), paise arithmetic helpers
  src/gst.ts                   taxFromInclusive(gross, rateBp), cgst/sgst/igst split
  src/datetime.ts              formatIST(), istDayToUtcRange()
  src/order-state-machine.ts   ORDER_TRANSITIONS map + canTransition()
  src/contracts/*.ts           every request/response zod schema in §2, one file per module
                               (catalog.ts, cart.ts, auth.ts, checkout.ts, orders.ts, admin/*.ts, webhooks.ts)
  src/fixtures/*.ts            typed fixture data (10 prototype products, sample orders in every status, quotes)
  src/mocks/handlers.ts        MSW handlers built from contracts + fixtures

packages/db     — server-only ('server-only' import guard). Depends on core (never the reverse).
  src/schema/*.ts              Drizzle tables; pgEnum(...) built FROM core enum tuples
  migrations/*.sql             committed, forward-only
  src/client.ts                pooled postgres-js client (prepare:false)
  src/seed.ts                  seeds categories, 10 products + variants, settings, owner admin
  Row types (InferSelectModel) exported for repository code only — NEVER used as API types.

apps/web        — the one deployed app. Route groups (storefront)/, admin/, api/.
  lib/actions/*.ts             Server Actions: parse input with core schemas, return ApiResult
  lib/api-client.ts            typed fetch wrapper: api.checkout.quote(input) → parses response with core schema
```

**Dependency rule:** `web → db → core`. If a type is needed in the browser, it lives in core, full stop. DB row shape ≠ API DTO shape by design (e.g., `unit_price_paise` column vs `unitPricePaise` DTO — mapping happens in repositories/actions).

### 3.2 What a frontend dev mocks against

1. `pnpm dev:mock` runs apps/web with `NEXT_PUBLIC_API_MODE=mock`: MSW (browser + node) serves every Route Handler path from `packages/core/src/mocks/handlers.ts`; Server Actions are swapped via a single `lib/actions/index.ts` barrel that re-exports mock implementations returning fixture `ApiResult`s.
2. Fixtures cover the unhappy paths, not just success: an `OUT_OF_STOCK` variant (`sku: KK-CHAMP-MOCK-OOS`), an expiring OTP challenge, one order fixture per order_status (all 11), a `PRICE_CHANGED` quote, a 429 response. Mock Razorpay checkout resolves after 1.5s with a fake signature accepted only by the mock verify handler.
3. Because handlers parse inputs with the same zod schemas the real routes use, a frontend integration that passes against mocks fails only on data, never on shape.

### 3.3 Backend dev obligations

Every Route Handler/action: (a) parse input with the core schema — 400 with `fieldErrors` from `zodError.flatten()`; (b) construct responses through core response schemas (`schema.parse(payload)` in dev/test — drift throws in CI); (c) contract tests in `packages/core/contracts.test.ts` assert every fixture parses against its schema.

### 3.4 Versioning discipline during the build

1. `CONTRACT_VERSION = '1.0.0'` exported from `packages/core`. Semver: **additive** (new optional field, new endpoint, new enum value) = minor; **breaking** (rename/remove/retype, required field, enum value removal, status-code change) = major.
2. **Contract lands first.** Any PR touching `packages/core/src/contracts|enums|errors` must: carry the `contract-change` label, update fixtures + mock handlers in the same PR, bump `CONTRACT_VERSION`, and append a row to the Contract Changelog table in `PROJECT_PLAN.md` (version, date, change, migration note). Breaking changes need approval from both the FE lead and BE lead before merge; consuming code merges only after the contract PR is on main.
3. No parallel truth: TS types are only ever `z.infer<>` from the schemas — hand-written interfaces for API shapes are banned by ESLint rule (`no-restricted-imports` on type-only duplicates).
4. DB migrations follow the same "schema lands first" rule: the Drizzle migration PR merges before feature code that reads the new columns; enum additions are always their own migration file.
5. Weekly contract freeze review; after launch, v1 endpoints are frozen and changes go through `/api/v2` only if a major bump is unavoidable.

---

### Critical Files for Implementation

- /Users/yagneshpatel/Downloads/Projects/Kakoa/PROJECT_PLAN.md — this contract embedded as the load-bearing section; contract changelog table lives here
- /Users/yagneshpatel/Downloads/Projects/Kakoa/packages/core/src/contracts/checkout.ts — the highest-risk DTOs (quote, place order, verify) every dev converges on
- /Users/yagneshpatel/Downloads/Projects/Kakoa/packages/core/src/order-state-machine.ts — ORDER_TRANSITIONS map shared by API, admin UI, webhook workers, and tests
- /Users/yagneshpatel/Downloads/Projects/Kakoa/packages/db/src/schema/orders.ts — orders/order_items/order_status_history Drizzle schema with the snapshot columns and CHECK constraints
- /Users/yagneshpatel/Downloads/Projects/Kakoa/apps/web/app/api/webhooks/razorpay/route.ts — reference implementation of the persist-then-ack contract that the Shiprocket handler mirrors

---

## §3.1 — Module: Design System & UI Foundation (`packages/ui`)

### 1. Purpose & Ownership

The shared component library and design-token layer every other lane builds screens from. It exists so that four feature lanes can ship storefront, checkout, account, and admin UI in parallel **without ever re-styling a primitive locally** — a Button on the COD confirmation queue and a Button on the PDP are the same Button. It also carries the brand system extracted from the prototype (§0): palette, type ramp, motion rules, and image-placeholder tones, so the rebuild is pixel-faithful to the design spec without shipping the 9.7 MB bundle.

- **Owner:** Dev A (Storefront & SEO). Dev A reviews every PR touching `packages/ui` (per §2.1); admin-facing usage reviewed jointly with Dev D.
- **Phase:** Phase 0 (Weeks 1–2), run **in parallel** with the contract work — this is the one Phase 0 lane that depends only on the prototype, not on schema v1 (§2.2 dependency map / team-phases Phase 0). Primitives must be merged by end of W2 so Lanes A–D start Phase 1 against real components + MSW fixtures.
- **Boundaries (Contract §3.1):** `packages/ui` sits beside `core` in the dependency graph — it may import `packages/core` (enums, `formatPaise()`, `ApiResult` types for state props) and **nothing app-side, nothing from `db`**. It ships zero data-fetching code; every component is presentational and receives contract-typed props. The import-boundary lint enforces this from day 1–2 of W1.

### 2. Database Schema

**None.** This module owns no tables and issues no queries — that is a design constraint, not an omission. What it does own is the **rendering side of contract data**:

- Money renders exclusively through `formatPaise()` from `packages/core/src/money.ts` (Contract §3.1) — no component ever does float math or accepts a pre-formatted price string for totals.
- Status chips/badges are keyed off the `as const` enum tuples in `packages/core/src/enums.ts` (`ORDER_STATUSES`, `PAYMENT_STATUSES`, …) — the Badge variant map is exhaustive over the enum, so adding an order state without a badge color fails `tsc`, mirroring the state machine in Contract §1.27.
- Components displaying order lines render **snapshot columns** (`title_snapshot`, `unit_price_paise`, GST fields per Contract §1.15/§1.29) passed as props — the UI never "freshens" a historical price from catalog data.
- Dates render via `formatIST()` from `core/datetime.ts`; no component calls `Date.now()` for display logic.

### 3. API Design

**No endpoints, no Server Actions.** Contractual obligations to API consumers instead:

- Every stateful component accepts props shaped as `ApiResult<T>`-derived discriminated unions (Contract §2.1 envelope) — e.g. `<Toast>` takes `{ code: ErrorCode; message: string }` from an `ApiErr` and renders the `message` field (which the contract guarantees is safe to show), never raw `details`.
- Error-code → UI mapping table ships in `packages/ui/src/error-display.ts`: `OUT_OF_STOCK`/`PRICE_CHANGED` → inline line-item notice; `RATE_LIMITED` → toast with `Retry-After` countdown; `VALIDATION_ERROR` → `fieldErrors` (zod `flatten()` output) rendered under the matching `<Input>`; `UPSTREAM_ERROR` → full-width retry banner. Consumers may not invent local copy for registry codes.
- `<Form>` wrapper standardizes `useActionState` wiring (Server Actions return `ApiErr`, never throw — Contract §2.1) including the pending-disable pattern that backs checkout's double-submit defense (client side of Checkout #2; the idempotency key is Lane C's server-side guarantee).

### 4. Frontend Requirements

**Tokens (`packages/ui/src/tokens.css` + Tailwind preset in `packages/config`):**
- Palette from §0: Ink `#2A1D12`, Cocoa `#4A2E1C`, Espresso `#8A5A34`, Cream `#FBF6EF`, Card `#F3E7D5`, Line `#EADBC6`; accents Gold `#C69A4C`, Caramel `#CE8A3E`, Raspberry `#C25B5B`, Pistachio `#7C8A4E`, Plum `#8A5A78`. Semantic aliases (`--color-bg`, `--color-danger` → Raspberry, `--color-success` → Pistachio) so components never hardcode hex.
- Type via `next/font` (self-hosted, `display: swap`, subset latin): DM Serif Display (headlines), Hanken Grotesque (body), DM Mono (eyebrow labels, uppercase, `0.14em` tracking). Exported as CSS variables from `apps/web/app/layout.tsx`; `packages/ui` consumes variables only.
- Radii: pill buttons, `999px` chips, card rounding per prototype. Spacing scale 4-px base.
- **Image placeholder tones:** until real photography lands (§0 issue 3), `<ProductImage>` renders a deterministic two-tone gradient placeholder derived from category (Bars → Cocoa/Caramel, Pralines → Espresso/Gold, Signature → Plum/Gold, Gifts → Raspberry/Cream) with the product title in DM Serif — same aspect ratio as final photography so no CLS on the swap.

**Primitives (shadcn-based, restyled once, `pnpm ui:add` workflow documented):** Button (primary/secondary/ghost/destructive, loading spinner state, pill), Card, Chip (filter chips w/ selected state), Input + Textarea (error state consumes `fieldErrors`), Select, Stepper (qty, min/max clamped, holds-to-repeat), Toast (queue, 5s auto-dismiss, action slot), Modal + Drawer (focus-trapped, ESC/scrim close, mobile bottom-sheet variant for cart), StarRating (**partial fill** via SVG `clipPath` — displays 4.3 as 4.3, not 4.5; interactive variant for review entry), Badge (enum-exhaustive status colors), Skeleton (shimmer, dimension-locked to the component it replaces).

**Scope boundary (decision 2026-07-02):** the `@kakoa/ui` inventory above serves the **storefront** surface. The **admin** surface uses **shadcn/ui + TanStack Table** installed as owned source in `apps/web` (see §3.14 and §4.4) — both surfaces consume the same KAKOA token layer, and neither imports the other's components.

**Motion rules (single `packages/ui/src/motion.ts`):**
- Section **fade-up on IntersectionObserver**, 24px translate, 400ms ease-out, stagger 60ms.
- **Reduced-motion safe with never-hide fallback (§0):** base CSS renders content fully visible; the observer only *adds* the animation class. If JS fails, IO is unsupported, or `prefers-reduced-motion: reduce` — content is simply there. No `opacity: 0` in base styles, ever.
- Cart-icon pop on add (scale keyframe, also gated on reduced-motion). Sticky header scroll shadow via one scroll listener with rAF throttle.

**Required UI states — every stateful primitive/pattern ships all five, demonstrated in the kitchen-sink route:**
- **Loading:** Skeleton matching final layout dimensions (card grid → card-shaped skeletons; totals → line skeletons). Buttons show inline spinner + stay width-locked; never layout shift.
- **Empty:** illustrated empty state with one CTA (empty cart → "Explore the collection" → `/shop`; no search results → trending chips). Never a bare "No data".
- **Error:** inline for field errors (`fieldErrors` under input, Raspberry text + border); banner with Retry button for `UPSTREAM_ERROR`/`INTERNAL`; toast for transient mutation failures. Error copy comes from `ApiErr.message`.
- **Success:** toast for background mutations ("Added to cart" + cart-icon pop); full-state change for primary flows (order confirmation). Success toasts never block subsequent input.
- **Partial-failure:** list-shaped surfaces render per-item outcome — e.g. cart revalidation where one line hits `OUT_OF_STOCK`: remaining lines render normally, the failed line shows an inline notice + resolve action (per Cart #5/#6 patterns). One item failing never blanks the whole surface.

**Responsive/mobile-first:** all primitives authored mobile-first at 360px, breakpoints 640/1024/1280; touch targets ≥ 44px; the Lighthouse CI device profile (mid-tier Android, slow 4G — §2.4 gate 8) is the design target, not the desktop.

### 5. Admin Panel Requirements

Admin (`apps/web/app/(admin)/**`, Dev D) consumes the **same primitives** — no parallel admin component set. `packages/ui` additionally ships an admin-density layer: `Table` (sortable headers, sticky header, row selection, pagination bound to `meta.{page,pageSize,total}` from the envelope), `FilterBar`, dense form variants, and a `ConfirmDialog` used by destructive actions (refund, cancel, archive).

- **Staff vs owner:** `packages/ui` renders permission state but never decides it — a `disabledReason` prop pattern shows locked owner-only controls (e.g. >50%-off coupon creation, refund-over-threshold per Admin #2) as visibly disabled with a tooltip, while the server-side authz remains the actual guarantee.
- Badge enum maps cover the full admin vocabulary: all 11 `order_status` values, payment/refund/shipment states, `cod_confirmation` states — so the COD queue and RTO/NDR views (Dev D, Phase 2) compose from existing pieces.
- Admin surfaces render user-generated content (gift messages, review bodies, customer names) through the shared `<UserText>` component — output-encoded plain text, control chars stripped — because the moderation UI is itself a stored-XSS target (Reviews #3, Admin authz notes).

### 6. Edge Cases

1. **Reduced-motion / JS-failure blanking.** If fade-up sections start at `opacity: 0` and the observer never fires (Safari quirk, extension-blocked JS, `prefers-reduced-motion`), whole sections vanish. Base styles must render visible; animation class is additive-only (§0 never-hide rule). Tested with JS disabled.
2. **Optimistic-UI divergence (Cart #6).** Stepper shows qty 3, server clamps to stock 2: every optimistic mutation carries a client op ID, server response reconciles, rejected line rolls back with a toast. Double-tap "+" race must converge to server state — the Stepper primitive owns debounce + reconcile, not each consumer.
3. **Price-changed acknowledgment (Cart #5).** When `current != price_at_add`, the cart line renders an inline "price changed from X to Y" notice and checkout CTA is blocked until acknowledged — a `ui` pattern component, so cart page and cart drawer behave identically.
4. **Partial star fill precision.** StarRating must render 4.3 as a true 30% fourth star (SVG clipPath), not round to 4.5 — a rounded display contradicts the JSON-LD `aggregateRating` value (SEO #3) and is a Google rich-results mismatch.
5. **Skeleton/CLS mismatch.** A skeleton whose dimensions differ from loaded content shifts layout and blows the CLS ≤ 0.1 budget (§2.4 gate 8). Skeletons are dimension-locked variants generated alongside each component, and `<ProductImage>` placeholders share the exact aspect ratio of final photography.
6. **Grapheme-cluster length counters (Checkout tests).** Gift-message (250) and review (2,000) counters must count grapheme clusters, not UTF-16 units — emoji-heavy messages otherwise show "23 left" client-side and fail server zod. The `<Textarea maxGraphemes>` counter uses the same `Intl.Segmenter` logic as `packages/core` validation.
7. **User-content XSS at render (Reviews #3).** `<UserText>` renders stored-raw plain text output-encoded on web and admin; never `dangerouslySetInnerHTML` for user fields. The XSS fixture corpus (launch checklist) runs against these components directly.
8. **Disabled UI is cosmetic (Admin #6).** Modal/ConfirmDialog patterns disable illegal actions per live state (cancel during webhook processing), but always handle the server's `INVALID_TRANSITION`/`ALREADY_PROCESSED` rejection gracefully — a disabled button is UX, the state machine is the guarantee.
9. **Toast queue overflow.** Rapid mutations (fast repeated add-to-cart) must coalesce ("Added ×3") or cap the visible stack at 3 with FIFO eviction — an unbounded toast column on a 360px screen covers the checkout CTA.
10. **Font-loading flash.** DM Serif Display swap on slow 4G causes headline reflow; `next/font` with `adjustFontFallback` + size-matched fallback metrics keeps CLS in budget; DM Mono eyebrows reserve fixed height.
11. **Focus trapping in Drawer/Modal on mobile.** Cart drawer must trap focus, restore it on close, and not lock body scroll permanently when a toast interrupts a close animation — screen-reader users are the first to hit a stuck scrim.
12. **Enum exhaustiveness drift.** A new `order_status` added in `core` without a Badge mapping must fail `tsc` (exhaustive `satisfies Record<OrderStatus, …>` map), not render a blank chip in the admin COD queue.

### 7. Testing Requirements

- **Unit / component (Vitest + Testing Library, no Storybook — the deployed kitchen-sink route is the living catalog):**
  - Every primitive: render, all variants, disabled/loading, keyboard interaction (Stepper arrows, Modal ESC/Tab-trap, Select), and controlled/uncontrolled prop contracts.
  - StarRating fill-fraction math (4.3 → clip at exactly 86% of star width across the 5-star strip) table-tested against 0.1 increments.
  - Grapheme counter parity: same fixture corpus (emoji, ZWJ sequences, Devanagari) asserts client counter === `packages/core` zod length rule.
  - Motion: with `prefers-reduced-motion: reduce` mocked, assert no animation classes AND full visibility; with IO absent, assert content visible (never-hide fallback).
  - `error-display.ts` map: exhaustive test that every `ErrorCode` in the registry (Contract §2.1) has a defined presentation.
  - Coverage: `packages/ui` ≥ 85% (the package-wide `core` gate standard, §D CI stage 3); the enum-badge and error-display maps at 100% by exhaustiveness.
- **Visual/a11y integration:** kitchen-sink route (`/dev/ui`, noindex, excluded from prod build) deployed on every preview; Playwright screenshots diff the primitive sheet at 360/768/1280 to catch unintended restyling; axe-core scan of the sheet gates merge (no serious/critical violations).
- **Lighthouse budget (§2.4 gate 8, owned jointly with Lane E):** PDP + Home on mid-tier Android/slow 4G — LCP ≤ 2.5s, CLS ≤ 0.1, JS budget enforced; advisory W3–4, **blocking from W5**. `packages/ui` owns the component-level contributions: font strategy, skeleton dimensions, zero layout-shifting animations, tree-shakeable exports (no barrel-file import of the whole library).
- **Named E2E scenarios exercised through these primitives** (they belong to Cart/Checkout suites but are the acceptance tests for the primitives): *Optimistic rollback* — stock set to 1 via admin, rapid-click "+" to 3, UI settles at 1 with visible notice (Cart E2E #2); *price-changed acknowledgment* blocking checkout until confirmed; *reduced-motion smoke* — Playwright with `reducedMotion: 'reduce'` asserts all Home sections visible without scroll.

### 8. Production-Readiness & Definition of Done

- **Validation:** `packages/ui` performs display-side validation only (counters, clamps); it must never be the sole validator — every input component's constraints mirror, and are tested against, the corresponding `core` zod schema.
- **Authz:** none owned; the `disabledReason` pattern must never leak role internals in tooltip copy beyond "Owner permission required".
- **Rate limits:** the `RATE_LIMITED` presentation honors `Retry-After` (countdown on the retry button, Class A–E agnostic); components never auto-retry into a 429.
- **Logging/alerting:** client-side render errors in `ui` components report to Sentry (browser) with component name tag; a `ui`-tagged error spike is triaged by Dev A. Error boundaries at section level — one broken component degrades a section (with the shared error card), never white-screens the page.
- **Accessibility baseline:** axe-clean kitchen sink; visible focus rings on Cream and Card backgrounds (contrast-checked against `#FBF6EF`/`#F3E7D5`); all interactive primitives operable by keyboard alone; Toast announcements via `aria-live="polite"`.

**Definition of Done (end of Phase 0, verified before the Contract gate lets Phase 1 lanes build screens):**
- [ ] Tokens, fonts (`next/font`), Tailwind preset merged; no raw hex or font-family literals outside `tokens.css` (lint-enforced)
- [ ] All 12 primitives (Button, Card, Chip, Input, Select, Stepper, Toast, Modal/Drawer, StarRating, Badge, Skeleton, + Table for admin) merged with all five UI states demonstrated on the kitchen-sink route
- [ ] **Every primitive consumed by ≥ 2 lanes without local re-styling** — verified by grep gate: no `packages/ui` class overrides or wrapper re-styles in `(storefront)`, `checkout`, or `(admin)` route groups
- [ ] Motion layer merged with reduced-motion + never-hide fallback tests green; JS-disabled render verified manually once
- [ ] `error-display.ts` covers the full ErrorCode registry; enum-badge maps exhaustive over `core` enums (tsc-enforced)
- [ ] Image placeholder system live with photography-matching aspect ratios; swap path documented for when real photography lands
- [ ] axe-core clean on kitchen sink; screenshot baseline recorded at 3 viewports; Lighthouse wiring live (advisory) on preview
- [ ] Import-boundary check green: `ui` imports only `core`; nothing in `ui` imports `db` or app code
- [ ] README in `packages/ui`: shadcn add workflow, token usage rules, "do not re-style locally" policy, and the five-states requirement for any new component

---

## §3.2 — Module 11 — Webhooks & Jobs Infrastructure

> The async backbone: inbound webhook intake (Razorpay + Shiprocket), Inngest durable jobs, and the reconciliation crons that make the system *eventually correct even when every webhook is lost*. Webhooks are accelerators; **polling reconciliation is the primary correctness path** (§1 decision record). Everything here is idempotent by construction or it does not merge.

### 1. Purpose & Ownership

- **What it does:** receives, verifies, persists, and acknowledges every inbound webhook (persist-then-ack, Contract §2.6); processes events asynchronously via Inngest with dedup and retries; runs the scheduled reconciliation jobs (stuck-payment sweep, Shiprocket poller, nightly full sweep, COD remittance matcher) that repair any state webhooks missed; wires dead-man monitoring so a cron that silently stops running pages someone.
- **Why needed:** Razorpay delivers at-least-once with ~24h redelivery; Shiprocket's webhook retry behavior is **undocumented**, so webhooks alone cannot be trusted for money or shipment truth. This module is where "money in Razorpay == money in DB" is enforced mechanically.
- **Owning lanes:** **Dev B** owns the infrastructure — Inngest app setup, shared job utilities, `webhook_events` schema/migrations, the persist-then-ack route skeleton, DB pooling config, healthchecks.io wiring. **Dev C** owns Razorpay event processors, the stuck-payment sweep, nightly payment reconciliation, and the COD remittance matcher. **Dev D** owns Shiprocket event processors, the tracking poller, and fulfillment jobs. Dev E is second reviewer of record on all webhook handlers (bus-factor rule, §2.1).
- **Phase:** skeleton in **Phase 0 (W1–2)** — Inngest app, `webhook_events` migration, the shared persist-then-ack handler, provider signature utils in `packages/core`. Processors land through Phase 2 (W6–8) alongside payments/fulfillment; **hardened in Phase 2/3** — poison-event handling, reconciliation crons, dead-man switches, backpressure config — and drilled in the Week 10 staging bake (missed-webhook reconciliation drill is a launch gate, §2.5 gate 4).

### 2. Database Schema

| Table | Role here | Key points |
|---|---|---|
| `webhook_events` (Contract §1.21) | **Owned.** The idempotency ledger — the "persist" half of persist-then-ack | `UNIQUE (provider, event_id)` is the dedupe gate. `provider webhook_provider` (`razorpay`/`shiprocket`), `event_id text` (Razorpay = `x-razorpay-event-id` header; Shiprocket has no event id ⇒ `sha256(awb|current_status|current_timestamp)` from payload), `event_type`, `payload jsonb` (raw body verbatim), `headers jsonb`, `status webhook_status` (`received → processing → processed | failed | skipped`), `error`, `attempts`, `received_at`, `processed_at`. Partial index `webhook_events_pending_idx ON (received_at) WHERE status IN ('received','failed')` — worker claims and ops dashboard only scan unfinished rows |
| `orders` (Contract §1.14) | Used by processors + sweeps | `orders_pending_expiry_idx` (partial, `status='pending_payment'`) is the stuck-payment sweep's scan; all transitions via `SELECT ... FOR UPDATE` + `ORDER_TRANSITIONS` map (Contract §1.27) — the state machine, not the processor, decides legality |
| `payments` (Contract §1.17) | Used | `payments_provider_payment_idx` / `payments_provider_order_idx` (partial uniques) correlate Razorpay ids; `payments_cod_remit_idx` (partial on `cod_collected`/`cod_pending_remittance`) is the remittance matcher's scan; `cod_remitted_at` + `cod_remittance_ref` written by the matcher |
| `shipments` (Contract §1.19) | Used | `shipments_stale_poll_idx` (partial on active non-terminal statuses, keyed on `last_synced_at`) is the poller's scan; poller updates `last_synced_at` as its watermark |
| `shipment_events` (Contract §1.20) | Used | `UNIQUE (shipment_id, status, occurred_at)` natural-key dedupe — webhook/poll overlap can never double-insert; `source IN ('webhook','poll','manual')` |
| `order_status_history` (Contract §1.16) | Written | every transition a processor/sweep makes logs `actor_type='webhook'|'system'` |
| `inventory_adjustments` (Contract §1.22) | Written | `inv_adj_once_per_cause_idx` makes webhook-triggered restocks (cancel, `payment_expired`, `rto_restock`) replay-proof |

**Concurrency patterns that bind this module (Contract §1.28):** workers claim rows with `UPDATE webhook_events SET status='processing' WHERE id=$1 AND status IN ('received','failed')` (zero rows = someone else has it); all order mutations take `FOR UPDATE` on the order row so webhook vs. sweep vs. admin races have a single winner; lock ordering is documented as **order → payment**, always. **DB pooling for serverless (Contract §0):** Supabase transaction-mode pooler on port 6543, Drizzle + postgres-js with `prepare: false` — Inngest fan-out plus Vercel function fan-out WILL exhaust direct connections at the first traffic spike if this is unconfigured; it is configured in `packages/db/src/client.ts` and asserted by a boot check.

### 3. API Design

All Route Handlers (raw body required); auth tier `webhook` — signature/secret only, exempt from session middleware, `Cache-Control: no-store`, unlimited rate class with a per-IP flood guard.

| Method & Route | Auth | Request/Response | Errors |
|---|---|---|---|
| `POST /api/webhooks/razorpay` | HMAC SHA256 of **raw body** with webhook secret, header `x-razorpay-signature` | Razorpay event JSON → `200 { ok: true, data: { received: true } }` or `{ duplicate: true }` on conflict | `401 SIGNATURE_INVALID` (nothing persisted); `500` only if the `webhook_events` insert itself fails (DB down — provider retry is the recovery path) |
| `POST /api/webhooks/shiprocket` | shared secret header `x-api-key` (configured in SR panel) | SR tracking push → same ack shape | same: `401 SIGNATURE_INVALID`; `500` on insert failure only |
| `POST /api/webhooks/inngest` | Inngest signing key (framework-managed) | Inngest serve endpoint hosting all functions | framework-handled |

**Persist-then-ack contract (Contract §2.6, verbatim — this is the flow, nothing else runs inline):**
1. Read **raw** body (no framework JSON parsing before the signature check).
2. Verify signature/secret. Fail → **401** `SIGNATURE_INVALID`, *nothing persisted*.
3. Compute `event_id` (Razorpay header; Shiprocket payload hash as above).
4. `INSERT INTO webhook_events ... ON CONFLICT (provider, event_id) DO NOTHING`. Conflict → **200** `{ ok: true, data: { duplicate: true } }` — ack, never reprocess.
5. `inngest.send('{provider}/event.received', { webhookEventId })`.
6. Return **200** `{ ok: true, data: { received: true } }` — target **< 2s**, always before any business logic.
7. **500 only if the insert fails.** Processing errors live in Inngest (retries with backoff) and never surface to the provider.

**Handled events:** Razorpay — `payment.captured`, `payment.failed`, `payment.authorized`, `refund.processed`, `refund.failed`, `order.paid`. Shiprocket — status pushes mapped to `shipment_status`, driving `shipment_events` inserts + order transitions (`packed→shipped→out_for_delivery→delivered`, RTO states) through the state machine; stale/unknown statuses are marked `skipped`, never errored.

**Inngest function conventions (enforced at review):** one function per event type/cron, named `{domain}.{verb}` (`payments/confirm`, `shipping/poll-tracking`, `reconcile/stuck-payments`); every function starts by claiming its `webhook_events` row (atomic UPDATE above); any step calling an external API is **a single `step.run` whose output persists the external ID**, preceded by an existence check keyed by our idempotency key; step outputs are zod-validated on read (deploy-safe across code swaps); `onFailure` handlers mark rows `failed` terminal and alert. **Idempotent external-call registry:** a repo-level doc (`packages/jobs/EXTERNAL_CALLS.md`) lists every external call and its idempotency mechanism (Razorpay order create → `receipt = idempotencyKey`; refund create → our refund id; Shiprocket order create → our order number as channel reference; SMS/email → per-message dedupe key) — reviewed on every PR that adds an external call.

**Scheduled jobs (Inngest crons — no HTTP surface, listed as owned actions):**

| Cron | Cadence | What it does | Owner |
|---|---|---|---|
| Stuck-payment sweep | every 15–30 min | orders `pending_payment` > 45 min → poll Razorpay Orders API (receipt = idempotency key); captured ⇒ idempotent `confirmPayment` (same path as webhook, FOR UPDATE); unpaid past expiry ⇒ `cancelled` + restock; finds orphan payments (captured, no matching order) ⇒ alert | C |
| Shiprocket poller | every 30 min | scan `shipments_stale_poll_idx` for active shipments with `last_synced_at > 6h`, poll `track/awb` batched with backoff on 429, upsert `shipment_events` (`source='poll'`), drive monotonic order transitions | D |
| Nightly full sweep | daily 02:00 IST | full Razorpay payments-list vs. orders diff (orphans, amount mismatches, stuck states) + full Shiprocket re-sync of everything non-terminal; findings deduped by `(order_id, anomaly_type)` with open/resolved state, only flags anomalies older than 2× sweep interval (no self-noise), alerts on NEW findings only | C + D |
| COD remittance matcher | daily | match Shiprocket COD remittance report lines (AWB → order) → payments `cod_collected → cod_pending_remittance → cod_remitted` with `cod_remittance_ref`; `delivered + 14d` unremitted ⇒ `cod_remittance_overdue` alert (real money leakage) | C |
| Housekeeping | nightly | expired `otp_challenges` purge, abandoned-cart marking (`carts_abandoned_sweep_idx`), orphan-image GC | B |

**Every cron pings its healthchecks.io dead-man switch on successful completion** — absence of success, not presence of failure, triggers the page. Registered switches: stuck-payment sweep, Shiprocket poller, nightly sweep, COD remittance matcher, Shiprocket token refresh, housekeeping.

### 4. Frontend Requirements

This module has no customer-facing pages of its own; it powers the freshness of others and must degrade honestly:

- **Order confirmation / tracking timeline (Dev A surfaces):** when a webhook is late, the success page renders from `/checkout/verify`'s fast path; if neither has landed, show a **pending state** — "Payment received, confirming your order…" with auto-refresh — never an error, because the sweep will settle it within one interval. Tracking timeline renders whatever `order_status_history` + `shipment_events` hold; a stale `last_synced_at` (> 12h) adds a quiet "last updated Xh ago" note rather than fake freshness.
- **Loading:** timeline skeleton while `/api/orders/[orderNumber]/tracking` resolves.
- **Empty:** shipment not yet created → timeline shows `placed/confirmed` done, later steps `future`; no AWB row shown.
- **Error:** tracking fetch failure → retry affordance with `requestId`; webhook endpoints themselves return only the §2.6 ack shapes and are never called by our UI.
- **Success:** timeline steps flip `done` as processors/poller land transitions; "Expected Jul 4" from `shipments.expected_delivery_at`.
- **Partial-failure:** order `confirmed` but Shiprocket push job failed past retries → customer sees honest "preparing shipment" (never a fake "shipped"); the order sits in the admin exceptions queue meanwhile.

### 5. Admin Panel Requirements

- **Webhook events view** (`/admin` ops area, backed by `webhook_events_pending_idx`): filterable list by provider/status; row detail shows `event_type`, `payload` (pretty JSON), `error`, `attempts`, timestamps. **Staff:** view + "retry" (re-emits the Inngest event for a `failed` row — safe because processors are idempotent). **Owner:** additionally "mark skipped" (poison events, with mandatory note → `admin_audit_log`).
- **Reconciliation findings queue:** open anomalies from the sweeps (orphan payments, amount mismatches, stuck orders, remittance-overdue) with age-sort; resolving requires a note; owner-only for anything that moves money (orphan auto-refund approval — manual-only for the first month per Payments policy).
- **Job health strip on the admin dashboard:** last-success timestamp per cron (from healthchecks.io pings or a `job_runs` log line), Inngest failure count 24h, oldest unprocessed `webhook_events` row age. Red state links to the runbook.
- **Permissions:** all views staff-readable; retry = staff; skip/resolve-with-money-effect = owner. Every action writes `admin_audit_log`.

### 6. Edge Cases

(From risk-engineering Module 11; numbering preserved.)

1. **Persist-then-ack violated by slow persist.** Razorpay expects fast 2xx; a slow `webhook_events` insert ⇒ timeout ⇒ redelivery storm. Handler does exactly: verify sig (raw body) → single INSERT → 200 → Inngest emit. Nothing else inline. Postgres down ⇒ return 500 and *rely* on redelivery — that's the design, documented.
2. **Duplicate event, different payload bytes.** Same `(provider, event_id)`, differing payloads (provider bug or tampering that passed sig on both). UNIQUE gate keeps the first; on conflict with differing payload hash, log `webhook.payload_divergence` + alert — never overwrite the original.
3. **Inngest retry re-fires an external side effect.** Any step calling an external API must be a single `step.run` persisting the external ID, preceded by an existence check keyed by our idempotency key; the external-call registry doc is reviewed at PR time.
4. **Poison event / permanent failure.** Malformed-but-signed event crashes its processor every retry. Retry budget exhausts → `onFailure` marks the row `failed` terminal, alerts; the nightly sweep is the backstop for the affected order. No infinite crash loops, no lost money-truth.
5. **Ordering hazards.** `refund.processed` processed before `payment.captured` (async fan-out, no ordering guarantee). Processors are order-independent: each reads current order state and applies the monotonic state machine; premature events park via `step.sleep` + recheck, not failure.
6. **Sweep and webhook race on the same order.** Both funnel through the same idempotent `confirmPayment` with `SELECT ... FOR UPDATE` on the order — single winner, no double transition, no deadlock (lock ordering: order → payment).
7. **Cron didn't run — the silent killer.** Deploy broke the schedule or Inngest misconfig. Every scheduled job pings healthchecks.io on completion; missed ping = page. Absence of success is the alert condition.
8. **Reconciliation self-noise.** Nightly job flags orders the sweep is mid-fixing. Only flag anomalies older than 2× sweep interval; dedupe findings by `(order_id, anomaly_type)` with open/resolved state; alert on NEW findings only.
9. **Clock skew across Vercel/Inngest/DB.** Every "is it expired/stuck" comparison uses DB `now()` or stored timestamps compared in-DB — never mixed wall-clocks (OTP expiry, stock holds, token expiry all inherit this).
10. **Deploy racing in-flight jobs.** Vercel swaps code mid-multi-step run; step 3 runs new code against step-1 output shape. Step outputs are zod-validated on read; breaking payload changes ship as a new function version while the old one drains.
11. **Event storm backpressure.** Flash-sale burst: thousands of webhooks + jobs. Per-function Inngest concurrency caps (Shiprocket push ≤ 5 concurrent — their rate limits) with queueing; the transaction-mode pooler absorbs serverless fan-out.
12. **Unknown-AWB tracking event** (Fulfillment #3, handled here): persist to `webhook_events`, ack 200, log `tracking.unknown_awb`, alert > 5/day — never 500 (that trains undocumented retry behavior we can't reason about).

### 7. Testing Requirements

- **Unit (`packages/core` / `packages/jobs`):** signature verification as a shared util with per-provider fixtures — known key/body/signature positive case plus mutated-raw-body negative (whitespace-shifted, re-serialized JSON must fail); Shiprocket `event_id` hash derivation; event dedup decision including the payload-hash-divergence branch; reconciliation anomaly matchers as pure functions (given payments list + orders list → expected findings; table-driven fixtures for orphans, mismatches, stuck orders, remittance-overdue).
- **Integration (ephemeral Postgres + webhook replay fixtures, on every PR):** persist-then-ack handler latency < 1s p99 in test; duplicate insert conflict → 200 `duplicate:true`, single state change; poison event exhausts retries → `failed` terminal + backstop finds the order; **sweep vs. webhook concurrency test** — both fire on one order, FOR UPDATE yields exactly one transition; DB-down handler returns 5xx cleanly with no half-writes; worker claim UPDATE excludes rows already `processing`.
- **E2E (named scenarios from risk-engineering Module 11):**
  1. *Late-webhook resilience:* complete a Razorpay test payment with webhook delivery disabled to the preview; assert the sweep confirms the order within one interval; re-enable and replay the webhook, assert no-op.
  2. *Job failure visibility:* force a Shiprocket-push failure (mock 500 × past retry budget); assert Inngest shows the failure, the alert fires, and the order appears in the admin exceptions queue.
  3. *Dead-man check:* deploy with a cron disabled in a test env; assert the healthchecks.io alert path fires (scripted staging drill — also run during the Week 10 bake).

### 8. Production-Readiness & Definition of Done

- **Validation:** signature verified over raw bytes before any parse; event payloads zod-parsed **at processing time, not ack time** — malformed-but-signed payloads go to `failed` (dead-letter), never a crash loop; Inngest step outputs schema'd; env vars (webhook secrets, Inngest keys, healthchecks URLs) validated by the `packages/config` zod schema at boot.
- **Authz:** webhook routes signature-only, exempt from session middleware, `Cache-Control: no-store`; Inngest signing key verified on its serve endpoint; admin webhook/reconciliation views per §5 (retry = staff, money-effect resolution = owner), all actions audited.
- **Rate limits:** webhook class unlimited but per-IP flood-guarded (Razorpay source-IP allowlist optional in prod); admin views under Class E (600/min/admin session); poller throttles itself against Shiprocket limits (batch + backoff on 429).
- **Idempotency:** the module's whole point — `webhook_events UNIQUE (provider, event_id)`; atomic row claim; order-independent processors converging through the state machine; `inv_adj_once_per_cause_idx` for restocks; external-call registry covering every outbound side effect.
- **Logging:** every event `{provider, event_id, type, outcome: processed|duplicate|stale|skipped|sig_failed, processing_lag_ms}`; every job run `{function, run_id, step, duration, outcome}`; reconciliation findings with counts `{orders_checked, orphans_found, mismatches}`; `request_id` propagated into Inngest events for cross-system tracing; no card data or raw PII in any of it.
- **Alerting:** signature-failure spike (> 10/hour — attack or secret-rotation mismatch); processing lag p95 > 10 min; **ANY terminal `failed` row** (page-level); Inngest function failure rate; `webhook.payload_divergence`; unknown-AWB spike; healthchecks.io misses for every registered cron; orphan payment found; COD remittance overdue.

**Definition of Done**
- [ ] Persist-then-ack skeleton shared across both providers, exact §2.6 flow, ack measured < 2s (< 5s hard ceiling per launch gate)
- [ ] Dedup + payload-divergence detection with alert
- [ ] Order-independent processors; all transitions through `ORDER_TRANSITIONS` with FOR UPDATE — convergence proven by the sweep-vs-webhook concurrency test
- [ ] All five crons live: stuck-payment sweep (15–30 min), Shiprocket poller (30 min), nightly full sweep, COD remittance matcher, housekeeping
- [ ] Dead-man switch registered for every cron; one deliberately tripped as a staging drill
- [ ] DB pooling configured for serverless (transaction-mode pooler, `prepare: false`) and load-smoked in Phase 3
- [ ] External-call idempotency registry exists, complete, and enforced in review
- [ ] Poison-event dead-letter path + admin retry/skip UI live
- [ ] Missed-webhook reconciliation drill passes in the Week 10 staging bake
- [ ] The 3 E2E scenarios green in CI

---

## §3.3 — Module: Product Catalog (products, variants, images, categories, search)

### 1. Purpose & Ownership

The catalog is the sellable-truth layer of the store: what exists, what it costs (MRP in integer paise, GST-inclusive), what's in stock, and how it renders on Home / Shop / PDP / Search. It carries the India-specific compliance payload — FSSAI ingredient/allergen copy, veg mark, Legal Metrology net quantity, HSN + `gst_rate_bp` as data — that every downstream order snapshot (Contract §1.29) is copied from. Nothing in checkout, fulfillment, or invoicing works without it, which is why it lands in **Phase 1 (Weeks 3–5)**, immediately after the contract gate.

| Concern | Owner |
|---|---|
| Storefront pages (Home, Shop/Collection, PDP, Search) + SEO/JSON-LD + ISR strategy | **Dev A** |
| Admin products/variants/images/inventory CRUD (`/api/admin/*` catalog routes + admin UI) | **Dev D** |
| Drizzle schema, migrations, seed (10 prototype SKUs across Bars/Pralines/Signature/Gifts), `packages/core` catalog contracts | **Dev B** |

Dev D's products/variants/inventory admin is explicitly sequenced early in Phase 1 because it unblocks real content entry; Dev A builds against MSW handlers from `packages/core/src/mocks` on day 1 and swaps to real queries mid-phase.

### 2. Database Schema

All catalog entities are soft-deleted only (`is_active` flags, §0 Deletes rule). Full DDL is embedded in the contract section; summary:

| Table | Contract | Key columns / constraints | Indexes |
|---|---|---|---|
| `categories` | §1.2 | `slug` UNIQUE with `^[a-z0-9-]+$` CHECK, `name`, `position`, `is_active`. Table not enum — admin adds seasonal collections without a migration. Seeds: Bars, Pralines, Signature, Gifts. | PK only |
| `products` | §1.3 | `slug` UNIQUE (same CHECK), `category_id` FK `ON DELETE RESTRICT`, FSSAI/Legal-Metrology copy (`ingredients`, `allergens`, `nutrition_facts` jsonb, `shelf_life_days > 0`, `is_veg`), `badge`, `tone`, **denormalized `rating_avg numeric(3,2)` / `rating_count`** (recomputed transactionally on review moderation — Reviews module writes, catalog reads), `is_active` | `products_category_active_idx` (partial, `WHERE is_active`); `products_search_idx` GIN `gin_trgm_ops` on `name \|\| ' ' \|\| blurb` |
| `product_variants` | §1.4 | The purchasable SKU. `sku` UNIQUE, `price_paise > 0` (MRP, GST-inclusive), `compare_at_price_paise > price_paise` CHECK, `gst_rate_bp` (default 500) + `hsn_code` (default '1806') **as data**, `weight_grams`/`ship_weight_grams` + dims for Shiprocket, **`stock_quantity >= 0` CHECK — the authoritative on-hand counter**, `low_stock_threshold` (default 10), `is_default`, `is_active` | `product_variants_product_idx`; `product_variants_one_default_idx` (partial UNIQUE — exactly one default per product); `product_variants_low_stock_idx` (partial, feeds admin low-stock list) |
| `product_images` | §1.5 | `product_id` FK CASCADE, `variant_id` FK `SET NULL` (variant-pinned shots), `url` (Supabase Storage public URL), `alt`, `position` | `product_images_product_pos_idx (product_id, position)` |
| `inventory_adjustments` (read/write via admin adjust; placement writes belong to Checkout) | §1.22 | Append-only ledger: `delta <> 0`, `reason` enum, `stock_after >= 0`, optional `order_id`/`admin_user_id` | `inv_adj_variant_idx`; `inv_adj_once_per_cause_idx` partial UNIQUE `(order_id, variant_id, reason)` — makes order-driven restocks idempotent |
| `store_settings` (read-only here) | §1.1 | `fssai_license_number`, seller legal details — rendered on PDP/footer | — |

**Concurrency patterns that apply:**
- **Oversell prevention (§1.28.1):** `stock_quantity` is only ever mutated by the atomic conditional `UPDATE ... WHERE stock_quantity >= $qty AND is_active RETURNING stock_quantity`. Catalog code never does check-then-write; admin manual adjustments are **relative deltas** through `/api/admin/inventory/adjust` with the same guarded update (409 `CONFLICT` if it would go negative), writing the ledger row in the same transaction.
- **Optimistic concurrency on admin edits:** admin product/variant PATCH carries the row's `updated_at` (maintained by `set_updated_at()` trigger); the UPDATE's WHERE clause checks it; mismatch → 409 `CONFLICT` with a "changed since you loaded it" diff.
- **Snapshot boundary (§1.29):** `product_name`, `variant_name`, `sku`, `image_url`, `hsn_code`, `gst_rate_bp`, `unit_price_paise` are copied onto `order_items` at placement. Catalog edits are therefore never retroactive — a price or GST change affects future orders only, and the admin UI says so inline.

### 3. API Design

**Storefront (public Route Handlers, rate-limit Class A — 120/min/IP; all GETs send `Cache-Control: s-maxage=60, stale-while-revalidate=300`):**

| Method + Route | Auth | Request → Response | Endpoint-specific errors |
|---|---|---|---|
| `GET /api/catalog/categories` | public | → `{ categories: Category[] }` (active only, ordered by `position`) | — |
| `GET /api/catalog/products` | public | `?category=&sort=featured\|price_asc\|price_desc\|rating&page=&pageSize=24&q=` → `{ products: ProductCard[] }` + `meta.total` | — (unknown category = empty list, not 404) |
| `GET /api/catalog/products/[slug]` | public | → `{ product: ProductDetail }` — variants with `inStock`/`stockLow`, images, `fssaiLicense` from `store_settings`, `related`, `frequentlyBoughtTogether` (co-occurrence in `order_items`, fallback best sellers) | 404 `NOT_FOUND` (missing or inactive) |
| `GET /api/catalog/products/[slug]/reviews` | public | `?page=&pageSize=10` → `{ reviews: ReviewPublic[]; summary: { avg, count, histogram } }` (approved only) | 404 `NOT_FOUND` |
| `GET /api/catalog/search` | public | `?q=truffle&limit=8` → `{ results: SearchHit[] }` — `pg_trgm`-backed, active products only, input passed as a bind parameter (never interpolated) | — (empty `q` → empty results) |
| `GET /api/stock/[variantId]` | public | → `{ variantId, inStock, stockLow }` — **uncached** (`Cache-Control: no-store`); the PDP live-stock hydration path | 404 `NOT_FOUND` (unknown/inactive variant) |

**Admin (Route Handlers under `/api/admin/*`, Class E — 600/min/session, `admin:staff` unless noted; every mutation writes `admin_audit_log`):**

| Method + Route | Request → Response | Errors |
|---|---|---|
| `GET /api/admin/products` | `?q=&category=&active=&page=` → `{ products: AdminProductRow[] }` | — |
| `POST /api/admin/products` | `ProductInput` → 201 `{ product }` | 409 `CONFLICT` (slug taken) |
| `GET /api/admin/products/[id]` | → `{ product: AdminProductDetail }` | 404 `NOT_FOUND` |
| `PATCH /api/admin/products/[id]` | `Partial<ProductInput>` + version check → `{ product }` | 404; 409 `CONFLICT` (stale `updated_at`) |
| `DELETE /api/admin/products/[id]` | soft: `is_active=false` → `{ product }` — never 409, never a hard delete | 404 |
| `POST /api/admin/products/[id]/variants` | `VariantInput` → 201 `{ variant }` | 409 `CONFLICT` (SKU taken) |
| `PATCH /api/admin/variants/[id]` | `Partial<VariantInput>` → `{ variant }` — price/`gst_rate_bp` changes affect future orders only | 404; 409 (version) |
| `DELETE /api/admin/variants/[id]` | soft archive → `{ variant }` | 404 |
| `POST /api/admin/products/[id]/images` | `{ fileName; contentType }` → `{ uploadUrl; image }` — DB row first (signed-URL flow), then client PUTs to Supabase Storage | 404 |
| `PATCH /api/admin/products/[id]/images` | `{ order: imageId[] }` → `{ images }` (reorder) | 404 |
| `DELETE /api/admin/images/[id]` | → `{ }` | 404 |
| `GET /api/admin/inventory` | `?lowStock=true&page=` → `{ rows: { variant; stockQuantity; threshold }[] }` | — |
| `POST /api/admin/inventory/adjust` | `{ variantId; delta; reason: 'manual_adjustment'\|'stock_correction'\|'damage_writeoff'\|'initial_stock'; note? }` → `{ variant; adjustment }` | 409 `CONFLICT` (would go negative — atomic guarded update) |
| `GET /api/admin/inventory/ledger` | `?variantId=&page=` → `{ adjustments: InventoryAdjustment[] }` | — |

Common codes (400 `VALIDATION_ERROR`, 401, 403, 429 `RATE_LIMITED`, 500) apply everywhere per §2.1 and aren't repeated. **Idempotency:** all catalog GETs trivially; inventory adjustments are deliberate deltas (double-submit guarded by a client op id in the admin UI); order-driven restocks are idempotent via `inv_adj_once_per_cause_idx`; `revalidateTag` calls are naturally idempotent and retried via Inngest on failure.

**ISR + revalidation strategy (Dev A, normative):**
- PDP (`/product/[slug]`) and Shop/Collection are ISR with tags: `product:{slug}`, `category:{slug}`, `catalog` — plus a 15-minute time-based fallback revalidate so a missed tag can never go stale forever.
- Every admin catalog mutation calls `revalidateTag` for the affected product + its category + `catalog`; failures are logged and retried through an Inngest job (edge case #1).
- **Stock is never trusted from the ISR payload.** The PDP renders cached content, but the add-to-cart button hydrates from the uncached `GET /api/stock/[variantId]` on mount and on variant switch. Cached "in stock" with live "out" ⇒ button disables with "Just sold out".

### 4. Frontend Requirements

**Pages/components powered:** Home (featured 4, category tiles), Shop/Collection (filter chips All/Bars/Pralines/Signature/Gifts, 4 sorts), PDP (4-image gallery, variant selector, qty stepper, tabs desc/ingredients/reviews, related, FBT, FSSAI/veg-mark block, MRP + net quantity per Legal Metrology), Search overlay (trending/popular/results states), cart drawer product data, JSON-LD `Product`/`Breadcrumb`, sitemap.

Required UI states, concretely:

- **Loading:** Shop grid renders 8 skeleton cards preserving card aspect ratio (CLS budget ≤ 0.1 is a blocking CI gate from W5); PDP gallery shows the tone-colored placeholder block; search overlay shows the trending list until first keystroke result.
- **Empty:** Shop with a filter yielding nothing → "No chocolates match" + one-tap chip reset; search with no hits → "No results for 'x'" + popular products; category with zero active products is hidden from nav entirely.
- **Error:** catalog fetch failure on Shop/PDP → route-level error boundary with retry button (never a blank grid); live-stock check failure → button stays enabled but checkout re-verifies (server is authoritative); search error → inline "Search is unavailable, try again" inside the overlay, overlay stays open.
- **Success:** grid cards show `fromPricePaise` formatted via `formatPaise()`, `compareAtPricePaise` strikethrough, badge pill, partial-fill stars from denormalized `rating_avg`; PDP variant switch swaps price, weight, variant-pinned images, and stock state without navigation.
- **Partial-failure:** PDP renders even if `related`/FBT queries fail (sections simply omitted); stale-ISR price drift detected at hydration → "price updated" toast, never a silent higher charge (checkout re-verifies with 409 `PRICE_CHANGED`); a variant going inactive while others live → selector shows it disabled with "no longer available".

### 5. Admin Panel Requirements

- **Products list:** search/filter by category and active state; row shows default-variant price, stock roll-up, rating, active toggle. **Product editor:** all §1.3 fields incl. FSSAI copy with a publish-validation panel (blocks activation if HSN missing, no image, price ≤ 0, weight missing — fail loudly at publish, per edge case #7).
- **Variant editor:** SKU, price/compare-at in paise (input in ₹, stored int), GST bp, HSN, weights/dims, default-variant radio (one-default constraint surfaced as a radio, not checkboxes), archive.
- **Images:** signed-URL upload, drag-reorder (PATCH order array), variant pinning, alt-text required for save.
- **Inventory:** low-stock view (partial index backed), delta-only adjust form with reason enum + note, full ledger per variant with actor and `stock_after`. No absolute "set stock" input exists anywhere in the UI.
- **Concurrent-edit UX:** 409 on save shows a field-level diff of what changed and a reload-and-reapply path.
- **Staff vs owner:** staff can create/edit products, variants, images, and record inventory adjustments; **activate/archive (publish) and price/GST changes on live products are owner-only** — enforced per-route server-side (UI hiding is cosmetic), covered by the exhaustive authz checklist test. Every mutation lands in `admin_audit_log` with before/after.

### 6. Edge Cases

(From Risk Engineering — Module 1; adapted to Contract v1 naming.)

1. **Stale ISR shows "in stock" after sellout.** `revalidateTag` fails (Vercel API hiccup) or tag unregistered. Mitigation: stock never trusted from ISR payload — add-to-cart hydrates from uncached `GET /api/stock/[variantId]`; revalidation failures logged + retried via Inngest.
2. **Variant archived while sitting in carts and in Google's index.** Archive is soft (`is_active=false`); PDP returns 410 for a fully-archived product, redirects to the product if other variants live; cart line resolution flags the line `unavailable` instead of 500ing (Cart module owns the render).
3. **Staff edits product while owner archives it concurrently.** Save must not resurrect the archived row: `updated_at` optimistic check in the UPDATE WHERE clause; conflict → 409 with a diff.
4. **Price change while PDP is cached.** Cached page shows ₹499, server prices ₹549. Server price is authoritative at add-to-cart, re-verified at placement (409 `PRICE_CHANGED`); hydration drift shows a "price updated" toast — never silently charge more than displayed.
5. **Short-dated stock vs delivery window.** Stock with best-before inside `transit_days + safety_buffer` is technically on hand but not sellable. v1 handles via owner `damage_writeoff` ledger adjustments guided by `shelf_life_days`; the sellable-stock cutoff is unit-tested as a pure function so batch tracking can slot in later without API change.
6. **Summer melt / seasonal gating.** Heat-sensitive products may be month/pincode-gated (no non-metro shipping in May–June without cold pack) — modeled as product data so PDP shows "unavailable in your region right now" instead of a checkout-time surprise; checkout evaluates whole-cart shippability against the same data.
7. **HSN/GST integrity.** `gst_rate_bp` + `hsn_code` are resolved at order-snapshot time only, never joined live. A product activated with missing/blank HSN must fail publish validation loudly — never silently tax at 0%. Nightly integrity check alerts on any active variant with a bad HSN/GST mapping.
8. **Search leaks archived/draft products.** The trgm query filters `is_active` on both product and variant **in the query**, never relying on index rebuild timing. A draft SKU in search results = data exposure of unlaunched products.
9. **Image upload orphans.** Storage PUT succeeds, DB insert fails (or vice versa). Order enforced: DB row first (`pending`), then signed-URL upload, then flip ready; nightly Inngest job garbage-collects `pending > 24h` blobs.
10. **Category deletion with assigned products.** Blocked by `ON DELETE RESTRICT` on `products.category_id`; UI requires explicit reassignment; a deactivated category's slug 301s to `/shop` to preserve SEO.
11. **Duplicate slugs after transliteration.** "Café Mocha" and "Cafe Mocha" both slugify to `cafe-mocha`. UNIQUE constraint is the backstop; generator appends `-2` deterministically; slug changes create a redirect row (old → new).

### 7. Testing Requirements

- **Unit (`packages/core`, ≥ 90% line coverage on these pure functions):** sellable-stock computation (best-before cutoff, threshold flags); slug generation + collision suffixing; publish validation (HSN present, price > 0, ≥ 1 image, weight present); GST rate resolution by HSN + date; `formatPaise` on catalog price display paths.
- **Integration (ephemeral Postgres, migrations applied):** archive-while-editing 409 path; search query excludes inactive products/variants; category delete restriction; slug redirect row creation; concurrent version-conflict UPDATE; `inventory/adjust` guarded update rejects negative-going deltas under concurrency with the checkout decrement (ledger never negative, no lost updates); one-default-variant partial unique enforced.
- **E2E (Playwright, Vercel preview + Supabase preview branch):**
  1. **Sellout freshness:** buy the last unit of a variant via API, load the PDP, assert add-to-cart disables within one revalidation cycle — and immediately via the live stock check even if ISR is stale.
  2. **Archive flow:** admin archives a variant → PDP shows remaining variants, fully-archived product returns 410, sitemap no longer lists it after regeneration.
  3. **Search integrity:** create an inactive product, assert absent from storefront search; activate, assert present.

### 8. Production-Readiness & Definition of Done

- **Validation:** zod schemas (`packages/core/src/contracts/catalog.ts`, `admin/*.ts`) on every mutation with `.strict()` — price as positive int paise, HSN whitelist, weight grams int, slug pattern; unknown keys rejected; 400 `VALIDATION_ERROR` with `fieldErrors` from `flatten()`.
- **Authz:** all catalog mutations behind `admin:staff`; activate/archive and live price/GST edits behind `admin:owner`; enumerated in the exhaustive per-route authz checklist test.
- **Rate limits:** Class A (120/min/IP) on all `/api/catalog/*`; the live stock endpoint additionally capped at 60/min/IP and search effectively tighter via a 30/min/IP bucket (search is the scraping/DoS vector); Class E on admin routes. 429s carry `Retry-After` + `X-RateLimit-*` headers.
- **SQLi/XSS:** Drizzle parameterized everywhere; search input bound, never string-built; product descriptions are admin-authored markdown rendered through an allowlist sanitizer (no script/event handlers) at save time AND React-encoded at render.
- **Logging:** structured event on publish/archive/price-change: `{actor_id, product_id, variant_id, field, old_value, new_value}` — this plus `admin_audit_log` is the audit trail for pricing disputes; `catalog.revalidate_failed {tag, error}` on every failed tag purge.
- **Alerting:** revalidation failure rate > 5% over 15 min; nightly integrity check firing on any active variant with missing HSN/GST; image GC deleting > 100 blobs in one run (upload-bug signal); low-stock count spike on the admin dashboard.

**Definition of Done:**
- [ ] zod `.strict()` on all admin catalog inputs; responses parsed through core schemas in dev/CI
- [ ] Optimistic version-conflict (409 + diff) live on product/variant/coupon-style edits
- [ ] Sellable-stock function unit-tested including best-before cutoff
- [ ] Live stock check wired on PDP (uncached), ISR tags + Inngest retry on revalidation failure
- [ ] Slug redirects working (old slug 301s), duplicate-slug suffixing deterministic
- [ ] `admin_audit_log` row on every catalog mutation (meta-test enforced)
- [ ] Search excludes non-active in-query; trgm input parameterized
- [ ] Delta-only inventory adjustments with ledger + `stock_after`, proven under concurrency with checkout decrement
- [ ] Image pending→ready pipeline + nightly orphan GC
- [ ] Alerts wired (revalidation, HSN integrity, image GC)
- [ ] The 3 E2E scenarios green in CI (merge queue)

---

## §3.4 — Module — Cart (guest cookie carts, merge on login, optimistic UI)

### 1. Purpose & Ownership

The cart is the bridge between browsing and checkout: a server-side, database-backed cart that works identically for anonymous guests (keyed by a signed httpOnly cookie token) and logged-in customers (keyed by `customer_id`), with a deterministic merge when a guest logs in via OTP. It powers the cart drawer, the full cart page, per-line gift wrap/message, and pre-checkout coupon application. Cart lines are **never price snapshots** — every read reprices against live `product_variants` data (Contract §1.29); the authoritative total only exists at `/checkout/quote` and placement.

- **Owning lanes:** Dev A (cart drawer + page UI, optimistic interactions, `packages/ui` cart components) + Dev B (carts/cart_items schema, cookie/session plumbing, merge-on-login inside the OTP verify path, server actions' data layer). Dev C consumes the cart at checkout (cart→order conversion) and reviews `applyCoupon` since it touches money math (bus-factor rule).
- **Phase:** Phase 1 (Weeks 3–5). Lane A builds cart UI against MSW mocks from day 1; Lane B lands guest sessions + cart persistence early in the phase because C's checkout consumes both. Merge-on-login ships with OTP auth in the same phase.
- **Why it exists:** guest checkout is the conversion norm in Indian D2C (§1 decision record) — the cart must survive without an account, survive login without losing intent, and never lie about price or stock.

### 2. Database Schema

| Table | Role | Key columns / constraints |
|---|---|---|
| `carts` (owned — Contract §1.10) | One row per cart; guest or owned | `token uuid UNIQUE DEFAULT gen_random_uuid()` (the cookie value for guests), `customer_id` nullable FK → customers `ON DELETE CASCADE`, `status cart_status` (`active`/`merged`/`converted`/`abandoned`), `coupon_id` FK → coupons `ON DELETE SET NULL`, `merged_into_cart_id` self-FK, `expires_at DEFAULT now() + 30 days`. Partial unique `carts_one_active_per_customer_idx` — at most one `active` cart per customer. `carts_abandoned_sweep_idx ON (updated_at) WHERE status='active'` feeds the abandonment sweep. |
| `cart_items` (owned — Contract §1.11) | One line per variant per cart | `UNIQUE (cart_id, variant_id)` — add-again upserts quantity; `quantity CHECK BETWEEN 1 AND 20`; `gift_wrap boolean`, `gift_message CHECK char_length ≤ 300`; `ON DELETE CASCADE` from carts and variants. Hard deletes permitted (one of only four hard-delete exceptions in §0). |
| `product_variants` (read — Contract §1.4) | Live price + stock on every cart read | `price_paise`, `stock_quantity`, `is_active` — cart never copies these. |
| `products` / `product_images` (read — §1.3, §1.5) | Line display data | name, slug, image URL resolved live. |
| `coupons` (read — Contract §1.12) | Pre-checkout coupon attach | validated on apply AND re-validated at quote/placement; the cart only stores `coupon_id`. |
| `customers` / `customer_sessions` (read — §1.6–1.7) | Owner resolution for logged-in carts | merge runs inside OTP verify. |

**State machine:** `cart_status` is a simple one-way machine — `active → merged` (guest cart folded on login), `active → converted` (order placed), `active → abandoned` (sweep after 30 days idle). No transitions out of terminal states; a `merged`/`converted` cart token presented in a cookie yields a fresh empty cart.

**Concurrency & integrity patterns that apply:**
- No snapshot columns here by design — the snapshot register (Contract §1.29) explicitly lists cart prices as *not snapshotted*; drift is surfaced as 409 `PRICE_CHANGED` at placement against `expectedTotalPaise`.
- Quantity clamping happens against live stock at read time; the atomic conditional decrement (Contract §1.28.1) only runs at placement — the cart never reserves stock.
- Merge is idempotent: re-running it against an already-`merged` cart is a no-op (status check first), and the `UNIQUE (cart_id, variant_id)` constraint makes line-folding an upsert.
- Cart cookie: `token` uuid, HMAC-signed value, `HttpOnly; Secure; SameSite=Lax`. Tampered signature ⇒ treated as no cookie ⇒ new empty cart, no error leaked.

### 3. API Design

All cart mutations are **Server Actions** (Contract §2.3; zod input schemas exported from `packages/core/src/contracts/cart.ts`, implementations in `apps/web/lib/actions/cart.ts`), returning `ApiResult<CartView>`. Rate-limit **Class B** (60/min per session/cart-token). Auth tier: `public` — scoped to the cart cookie or customer session; a request can only ever touch its own cart (itemId lookups are always joined against the resolved cart id, never trusted bare).

| Owner surface | Auth | Request → Response | Endpoint-specific errors |
|---|---|---|---|
| `GET /api/cart` (Route Handler) | public (cart cookie / session) | → `{ cart: CartView }` — lines live-priced + live-stock (`stockState: 'ok'\|'low'\|'out'`), subtotal, gift-wrap total, coupon, free-shipping threshold, count. **Never 404** — no cart ⇒ empty `CartView`. Uncached. | none beyond common set |
| `addToCart({ variantId, qty, giftWrap?, giftMessage? })` | public | upsert line (existing line ⇒ qty summed, clamped to 20/stock) → `CartView` | `OUT_OF_STOCK` (409-equiv, `details: { available }`), `NOT_FOUND` (inactive/unknown variant) |
| `updateCartItem({ itemId, qty })` | public | set qty; **qty 0 = remove** → `CartView` | `NOT_FOUND` (not this cart's line), `OUT_OF_STOCK` |
| `setGiftOptions({ itemId, giftWrap, giftMessage? })` | public | per-line gift wrap + message (≤300 chars, zod-trimmed) → `CartView` | `NOT_FOUND` |
| `removeCartItem({ itemId })` | public | delete line → `CartView` | `NOT_FOUND` |
| `applyCoupon({ code })` | public | attach `coupon_id` after full eligibility check → `CartView` with `coupon: { code, discountPaise }` | `COUPON_INVALID` \| `COUPON_EXPIRED` \| `COUPON_MIN_NOT_MET` \| `COUPON_EXHAUSTED` \| `COUPON_LIMIT_REACHED` (all 422-equivalent; identical generic message text — no oracle distinguishing "doesn't exist" from "not for you") |
| `removeCoupon()` | public | detach → `CartView` | none |

**Idempotency:** every optimistic mutation carries a client op ID for reconciliation; server-side, add/update are natural upserts against `UNIQUE (cart_id, variant_id)` so a retried action converges to the same row. The **merge contract** (Contract §2.3, executed inside `POST /api/auth/otp/verify`, surfaced as `cartMerged: boolean` in the verify response) is idempotent by construction: guest lines fold into the customer's active cart — same variant ⇒ quantities sum (capped at 20 and at stock); guest gift fields win on conflict; guest coupon wins only if the customer cart has none; guest cart → `status='merged'` + `merged_into_cart_id` set; cookie rotated to the surviving cart. Lines are copied **by value** — the guest cart row is never re-parented (session-fixation defense, Edge Case 1).

Common failures (`VALIDATION_ERROR`, `RATE_LIMITED`, `INTERNAL`) apply per Contract §2.1 and are not repeated above.

### 4. Frontend Requirements

**Surfaces (Dev A):** cart drawer (opens on add-to-cart from PDP/shop, cart-icon pop animation from the prototype), full `/cart` page (line steppers, free-shipping progress bar toward `freeShippingThresholdPaise`, totals block, coupon field, per-line gift wrap toggle + message input), cart badge count in the sticky header, and the "price/stock changed" notice band. All money rendered via `formatPaise()` from `packages/core` — no float formatting anywhere.

Required UI states:

- **Loading:** drawer/page render skeleton lines (image + two text bars + stepper ghost) while `GET /api/cart` resolves; header badge shows last-known count from the previous render, never a spinner.
- **Empty:** illustrated empty state with "Your cart is empty" + CTA to `/shop` + 2–4 best-seller `ProductCard`s. Also the state after a tampered/expired cookie — indistinguishable from a genuinely new cart by design.
- **Error:** `GET /api/cart` failure ⇒ inline retry panel ("Couldn't load your cart — Retry") inside the drawer/page; the rest of the page stays interactive. Mutation failure ⇒ toast with the error message from `ApiErr` + automatic rollback of the optimistic change.
- **Success:** every mutation optimistically updates line qty/totals immediately (React `useOptimistic`), then reconciles to the returned `CartView` — server state always wins. Coupon apply success shows the discount row with the code as a removable chip.
- **Partial-failure / degraded:**
  - Line with `stockState: 'out'` (or dangling/archived variant): rendered greyed with "No longer available", excluded from subtotal, checkout CTA disabled until removed — never a 500.
  - Line auto-clamped (requested qty > live stock): server-clamped qty shown with inline notice "Only N left — we've updated your cart".
  - Price drift detected at checkout entry: blocking inline "price changed from ₹X to ₹Y" acknowledgment before proceeding (checkout consumes this; the cart surfaces it).
  - Optimistic rejection (double-tap "+" past stock): line rolls back to the server value with a toast; client op IDs ensure the UI converges to server truth, not to the last optimistic guess.
  - Coupon auto-detach (line removal drops subtotal below `min_subtotal_paise`): coupon row disappears with notice "Coupon WELCOME10 removed — order is below ₹X minimum".
- **Merge notice (post-login):** when OTP verify returns `cartMerged: true`, show a one-time toast "We combined your cart with your saved one", listing any qty clamps or gift-field conflicts resolved.

### 5. Admin Panel Requirements

The cart module has no dedicated admin CRUD — carts are customer-owned ephemera. Admin touchpoints:

- **Read-only cart visibility:** the admin customer detail view (`GET /api/admin/customers/[id]`, Dev D) may show the customer's active cart line count/value as a support aid; no admin ever mutates a customer cart.
- **Abandonment metrics:** active-cart count and abandoned-cart sweep results surface on the admin dashboard as informational metrics (Phase 2+, nice-to-have — not a launch gate).
- **Coupons admin** (owner-only CRUD per Contract §2.9) is Module: Coupons / Dev D; the cart only consumes `applyCoupon` validation. Staff cannot create/edit coupons; deactivating a coupon takes effect on the next cart revalidation (applied coupons re-check at quote/place, so no admin "detach from carts" tooling is needed).
- **Permission note:** no staff/owner distinction applies inside this module because there are no admin cart mutations; audit-log requirements therefore don't attach here.

### 6. Edge Cases

(From risk-engineering.md Module 2; binding.)

1. **Session fixation on cart merge.** Attacker plants a guest cart cookie; victim logs in. Defense: rotate the session identifier on login, copy guest lines **by value** into a fresh/existing user cart (never re-parent the guest cart row), invalidate the guest token (`status='merged'`). Cookie is `HttpOnly, Secure, SameSite=Lax` and HMAC-signed so cart IDs can't be forged.
2. **Merge collision — same variant in both carts.** Quantities **summed and clamped** to 20 and available stock; gift message/wrap conflicts resolve in favor of the guest (most recent intent) with a UI notice. Implemented as a pure merge function in `packages/core`, unit tested against the full collision matrix.
3. **Merge with expired/foreign/already-merged guest cart.** Cookie references a cart that is `merged`, expired (>30 days), or customer-owned by someone else: merge verifies the guest cart is unowned and `active`; merging twice = merging once (idempotent).
4. **Variant archived/deleted while in cart.** Cart render must not 500 on a dangling variant: line flagged `unavailable`, excluded from totals, checkout blocked until removed, with the reason visible.
5. **Price changed between add and checkout.** Totals are always computed from current `price_paise` server-side; the client may show at-add price for display, but drift triggers an inline "price changed from X to Y" requiring acknowledgment before checkout. Placement re-verifies against `expectedTotalPaise` → 409 `PRICE_CHANGED`. Never silently charge more than displayed.
6. **Optimistic UI divergence.** Client shows qty 3, server rejects at stock 2: every optimistic mutation carries a client op ID; on rejection the line rolls back with a toast. The double-tap "+" race (two increments in flight) must converge to the server-clamped value.
7. **Someone else bought it — qty > sellable stock at render.** Cart page revalidates stock server-side on every load; over-stock lines auto-clamp with a notice rather than failing at payment.
8. **Gift wrap on a changing line.** Gift wrap fee is **per line**, flat, in paise, snapshotted only at checkout (`order_items.gift_wrap_fee_paise`); reducing qty must not orphan the fee, and removing the line removes its message.
9. **Cookie size blowout.** The cookie holds only a signed cart token — lines are never serialized into the cookie (4KB limit + tamper surface). Assert in test.
10. **Two tabs, one cart.** Both tabs submit checkout: the cart converts (`status='converted'`) atomically with placement; the second tab's placement hits the stale cart and gets a 409/410 (`CART_EXPIRED`) with a refresh path — never two orders from one cart absent distinct idempotency keys.
11. **Totals rounding.** `unit_price_paise * qty + wrap_fee_paise` — pure integer math; any float in money code fails lint (branded `Paise` type).

### 7. Testing Requirements

- **Unit (`packages/core`) — ≥ 95% on cart math:**
  - Merge function: full collision matrix — same variant, conflicting gift wrap/message, unavailable lines, quantity clamp to 20/stock, guest-coupon-wins-only-if-none rule.
  - Totals computation in integer paise: property tests — `totals(lines)` is associative under line ordering, never negative, never a float.
  - Clamp logic (requested vs available vs 20-cap).
  - Zod schemas for all six action inputs (qty bounds, uuid, gift-message length post-trim).
- **Integration (ephemeral Postgres, migrations applied):**
  - Merge-on-login idempotency: run merge twice, assert byte-identical end state and single `merged` guest cart.
  - Session rotation on login: pre-login cart/session token invalid afterward.
  - Dangling-variant render: archive a variant with an existing line, `GET /api/cart` returns 200 with the line flagged, totals exclude it.
  - Cart conversion lock: concurrent placements against one cart ⇒ exactly one converts, second gets 409/410.
  - Signed-cookie tamper: mutated cookie value ⇒ fresh empty cart, no error/stack leak.
  - Forged-ID authz: session A calling `updateCartItem` with cart B's `itemId` ⇒ `NOT_FOUND`, never a cross-cart mutation.
- **E2E (Playwright, named scenarios from risk-engineering.md):**
  1. *Guest-to-user merge:* guest adds 2 items with a gift message → logs in via OTP mid-session → cart shows merged state with message intact → replaying the old guest cookie in a fresh browser context yields an empty cart.
  2. *Optimistic rollback:* admin sets variant stock to 1 → rapid-click "+" to 3 → UI settles at 1 with a visible notice.
  3. *Price-drift acknowledgment:* add to cart → admin raises price → proceed to checkout → blocking "price changed" acknowledgment appears before the payment step.

### 8. Production-Readiness & Definition of Done

- **Validation:** zod on every action input (variantId uuid, qty integer 1–20 per DB CHECK, gift message trimmed and length-capped, coupon code normalized uppercase+trim before lookup); `strict()` — unknown keys rejected.
- **Authz:** cart operations scoped strictly to the resolving cookie/session owner; the forged-itemId negative test is a merge gate. Merge runs only inside a successful OTP verify.
- **Rate limits:** Class B — 60/min per session/cart-token on all mutations (bot add-to-cart inflates demand signals); `applyCoupon` additionally rides the coupon-enumeration posture (identical error copy across all five coupon codes, attempt logging).
- **SQLi/XSS:** Drizzle parameterized everywhere; gift message stored raw, rendered React-encoded on web, and **sanitized before any email/packing-slip template interpolation** (the forgotten sink); coupon codes rendered encoded (user-echoed input).
- **Idempotency:** merge idempotent (tested twice-run); line mutations carry client op IDs; upsert semantics on `UNIQUE (cart_id, variant_id)`.
- **Logging (structured):** `cart.merged {customer_id, guest_cart_id, lines_merged, conflicts}`; `cart.clamped {variant_id, requested, granted}` (aggregated clamps = unmet-demand signal); `coupon.applied/detached {code, cart_id}` with failed attempts `{code_hash, ip, session}`.
- **Alerting:** merge failure rate > 1% over 1h; unusual add-to-cart velocity per IP (bot signal); coupon-apply miss-rate spike.
- **Jobs:** abandoned-cart sweep (Inngest cron) flips `active` carts idle > 30 days to `abandoned` via `carts_abandoned_sweep_idx`; expired `otp`-style purge does not apply here, but the sweep must be idempotent and dead-man-pinged like every cron (§1 webhook discipline).

**Definition of Done (all boxes checked before the module exits Phase 1):**

- [ ] Signed httpOnly cart cookie (`HttpOnly, Secure, SameSite=Lax`, HMAC) live; tamper test green
- [ ] Session rotation on login proven by integration test (old token dead)
- [ ] Merge idempotent and by-value (never re-parented), proven by twice-run test
- [ ] Integer-paise-only math enforced by branded `Paise` type + lint rule; property tests green
- [ ] Unavailable-line handling (archived/dangling variant) renders without error and blocks checkout
- [ ] Cart conversion lock — concurrent checkout 409/410 path tested
- [ ] Forged-ID authz negative tests green across all six actions
- [ ] Class B rate limits + rate-limit headers live
- [ ] `cart.merged` / `cart.clamped` structured logs emitting; alerts wired
- [ ] The 3 named E2E scenarios green in CI on the Vercel preview

---

## §3.5 — Module — Customer Auth & Accounts (OTP, sessions, addresses, order history, wishlist)

### 1. Purpose & Ownership

Passwordless customer identity for an account-optional store: phone/email OTP login (MSG91 SMS via the `SmsProvider` interface), opaque revocable sessions, the saved address book, account order history, and the wishlist. Guest checkout never requires this module; it exists because repeat buyers convert better with saved addresses and order history, and because COD verification, guest order lookup, and admin login all reuse the same `otp_challenges` infrastructure. It is also the trigger point for cart merge: guest cart lines fold into the customer cart inside OTP verify.

- **Owner:** Dev B (Platform, DB & Core Domain) — auth/session code sits with the schema owner because every other lane consumes sessions; Dev A owns the wishlist/account UI shells that render this module's data.
- **Reviews:** any PR touching auth or sessions requires Dev B per §2.1; OTP endpoints shared with C (guest order lookup) and D (admin login) — interface changes announced at Order Council.
- **Phase:** OTP + sessions + cart persistence land in **Phase 1 (W3–5)** — checkout (Lane C) consumes them mid-phase. Account dashboard complete (order history, addresses backend, wishlist backend) in **Phase 2 (W6–8)**.

### 2. Database Schema

| Table | Key columns / constraints | Notes |
|---|---|---|
| `customers` (Contract §1.6) | `phone text UNIQUE CHECK (~ '^\+91[6-9][0-9]{9}$')`, `email citext UNIQUE`, `phone_verified_at`, `email_verified_at`, `is_blocked`, `CHECK (phone IS NOT NULL OR email IS NOT NULL)` | Row created on first successful OTP verify. Phone is the practical PK; email optional. `is_blocked` feeds COD eligibility (serial-RTO abusers). |
| `customer_sessions` (Contract §1.7) | `token_hash text UNIQUE` (SHA-256 of raw cookie token), `expires_at`, `revoked_at`, `ip`, `user_agent`; partial index on `(customer_id) WHERE revoked_at IS NULL` | Opaque token in httpOnly cookie `kakoa_session`; DB stores only the hash. 30-day rolling expiry, 90-day absolute cap. **Rotation on every auth event** — new row on login, old guest identifiers invalidated. |
| `otp_challenges` (Contract §1.8) | `channel`, `destination`, `purpose` (`customer_login`/`cod_verification`/`order_lookup`/`admin_login`), `code_hash = sha256(code ‖ pepper)`, `attempts CHECK (<= 5)`, `expires_at`, `consumed_at`, `ip`; partial index `otp_open_idx (destination, purpose) WHERE consumed_at IS NULL`; `otp_rate_idx (destination, created_at)` | 6-digit, 10-min TTL. **Class C rate limits are enforced authoritatively by counting rows here** — the DB is the authority, not middleware token buckets alone. Expired rows hard-deleted by cron purge. |
| `customer_addresses` (Contract §1.9) | `phone` + `pincode CHECK ('^[1-9][0-9]{5}$')`, `state_code char(2)`; partial unique `customer_addresses_one_default_idx (customer_id) WHERE is_default` | Hard-deletable by design: **orders snapshot the address into `orders.shipping_address` jsonb (Contract §1.14, §1.29)** — address-book edits/deletes never touch placed orders. |
| `wishlist_items` (Contract §1.24) | composite `PRIMARY KEY (customer_id, product_id)`, both FKs `ON DELETE CASCADE` | Product-level (prototype hearts). PK makes double-tap idempotent by construction. |

**Reads from (not owned):** `orders` via `orders_customer_idx (customer_id, placed_at DESC)` for order history; `orders_phone_idx` for guest-order attach on verify; `carts` for the merge contract (§2.3); `return_requests` for the account returns tab.

**Concurrency patterns that apply:** atomic OTP consume (`UPDATE otp_challenges SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL AND expires_at > now()` — one row = winner); default-address swap clears the old default and sets the new one in a single transaction (partial unique index is the backstop); cart merge is idempotent (guest cart flips to `status='merged'` with `merged_into_cart_id`, re-running is a no-op).

### 3. API Design

Route Handlers (Contract §2.4). Common codes (400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 429 `RATE_LIMITED`, 500 `INTERNAL`) apply everywhere and are not repeated.

| Method & route | Auth | Rate class | Request → response | Endpoint-specific errors |
|---|---|---|---|---|
| `POST /api/auth/otp/request` | public | **C** (1/60s + 3/10min + 10/day per destination; 20/hr per IP) | `{ channel: 'sms'\|'email', destination, purpose: 'customer_login' }` → `{ challengeId, resendAfterSec: 60 }`. **Always 200 whether or not the customer exists — no enumeration.** | 502 `UPSTREAM_ERROR` (MSG91/email provider down) |
| `POST /api/auth/otp/verify` | public | C (5 attempts per challenge) | `{ challengeId, code }` → `Set-Cookie kakoa_session`; `{ customer, cartMerged, isNewCustomer }`. Side effects in one flow: create customer if new, rotate session, merge guest cart, attach guest orders matching the now-verified phone. | 401 `OTP_INCORRECT` (details: `{ attemptsLeft }`); 410 `OTP_EXPIRED` (also after 5 attempts or already consumed) |
| `POST /api/auth/logout` | customer | — | → `{}`; sets `revoked_at`, clears cookie. Idempotent. | — |
| `GET /api/auth/me` | customer | — | → `{ customer: CustomerProfile }` | 401 if no/expired session |
| `GET /api/account/wishlist` | customer | — | → `{ items: ProductCard[] }` (archived products included with unavailable state) | — |
| `GET /api/account/orders?page=` | customer | — | → `{ orders: OrderSummary[] }`, paginated via `meta` | — |
| `GET /api/account/orders/[orderNumber]` | customer | — | → `{ order: OrderDetail }` — scoped strictly to owner | 404 `NOT_FOUND` if not owner's (never 403 — no existence oracle) |
| `GET /api/account/returns` | customer | — | → `{ returns: ReturnRequestView[] }` | — |

Server Actions (return `ApiResult`, never throw for expected failures):

| Action | Rate class | Request → response | Errors |
|---|---|---|---|
| `updateProfile({ name?, email? })` | B | → `CustomerProfile`. Email change triggers the email-OTP re-verify flow before the new email attaches. | 409 `CONFLICT` (email on another account — blocked, merge deferred post-launch) |
| `listAddresses()` | — | → `{ addresses: Address[] }` | — |
| `createAddress(AddressInput)` | B (60/min/session) | zod: pincode `^[1-9]\d{5}$`, phone `+91[6-9]\d{9}`, 20-address cap → `Address` | 422 on cap exceeded |
| `updateAddress({ id } & Partial<AddressInput>)` | B | → `Address` | `NOT_FOUND` if not owner's |
| `deleteAddress({ id })` | B | → `{}` — always safe: orders hold snapshots | `NOT_FOUND` |
| `setDefaultAddress({ id })` | B | → `{ addresses }` — transactional clear-then-set, last-write-wins | `NOT_FOUND` |
| `toggleWishlist({ productId })` | B | → `{ wished: boolean }` — idempotent via composite PK | `NOT_FOUND` (inactive product) |

**Idempotency:** OTP consume is atomic (single-winner UPDATE); logout, cart merge, guest-order attach, and wishlist toggle are all idempotent by construction; session rotation on verify means a replayed verify with a consumed challenge gets 410, never a second session.

### 4. Frontend Requirements

**Pages/components powered:** login/OTP sheet (replaces the prototype's password auth), account dashboard (`/account`: overview, orders, addresses, wishlist tabs — rewards tab deferred), header account/wishlist indicators, saved-address picker inside checkout step 2 (consumed by Lane C).

- **OTP request — loading:** button spinner, inputs locked. **Success:** code entry screen with masked destination ("+91 98•••••210"), 60s resend countdown from `resendAfterSec`. **Error:** 429 shows the `Retry-After` countdown inline ("Try again in 4:32"); 502 `UPSTREAM_ERROR` shows "Couldn't send the code — try again shortly" with a retry button (and email fallback if phone chosen). Never reveal whether the number has an account.
- **OTP verify — loading:** 6-box input disabled during submit. **Error:** `OTP_INCORRECT` shows "Incorrect code — {attemptsLeft} attempts left"; `OTP_EXPIRED`/lockout shows a clear "Code expired — request a new one" state gating back to request (Risk M7 E2E #2). **Success:** toast; if `cartMerged` show "Your cart items were saved"; redirect to origin (checkout step or `/account`).
- **Order history — loading:** skeleton rows. **Empty:** "No orders yet" + shop CTA. **Success:** paginated `OrderSummary` cards with status chips (IST dates via `formatIST`). **Error:** inline retry, never a blank page.
- **Addresses — empty:** "Add your first address" card. **Partial-failure:** a failed `setDefaultAddress` rolls the optimistic radio back with a toast; delete confirms first and notes in-flight orders are unaffected. **Error:** `fieldErrors` from zod `flatten()` render per-field.
- **Wishlist — empty:** heart illustration + browse CTA. **Success:** `ProductCard` grid. **Partial-failure:** an archived/unavailable product renders greyed with "No longer available" — never vanishes, never 500s (Risk M7 #10). Heart toggles are optimistic with rollback on `ApiErr`.

### 5. Admin Panel Requirements

- **Customers list** (`GET /api/admin/customers?q=&page=`): search by phone/email/name; columns id, name, phone, email, orderCount, ltvPaise, rtoCount, isBlocked. **Customer detail** (`GET /api/admin/customers/[id]`): profile + `OrderSummary[]`.
- **Block/unblock** (`POST /api/admin/customers/[id]/block`): staff-accessible; feeds COD eligibility. Every block/unblock writes `admin_audit_log`.
- **PII discipline:** any admin view of customer phone/email/address is a logged PII access (audit trail per Risk M7); customer-authored names/addresses render encoded — stored-XSS-via-name attacks target the admin's browser.
- **Staff vs owner:** customer viewing and blocking = `staff`. Data export of customer lists = `owner` only (Module 10 export rules — signed URLs, logged). No admin can read raw OTP codes or session tokens — only hashes exist.

### 6. Edge Cases (from Risk Module 7)

1. **OTP brute force.** 10⁶ space: 5 verify attempts per challenge then invalidate (410); Class C send limits; constant-time hash comparison; alert on distributed spray (many destinations, one IP block).
2. **Resend abuse = SMS cost attack.** Attacker sprays random numbers, we pay MSG91 per SMS. 60s cooldown + 10/day per destination + 20/hr per IP; CAPTCHA escalation past threshold; **daily SMS spend alert** — cost anomaly is the attack detector.
3. **Clock skew on expiry.** TTL computed and verified against **DB `now()` in the consume query** — never `Date.now()` on a Vercel function vs DB insert time. Boundary tests at expiry ±1s.
4. **OTP verify race.** Two requests with the correct code: atomic consume UPDATE — one row updated = winner and session; loser gets 410 `OTP_EXPIRED`. Never two sessions from one challenge.
5. **Phone number recycling (real in India).** Telco reassigns a number; new owner OTPs in and would see the previous owner's orders/addresses. Mitigation: >18 months inactivity → re-verification with masked history until email co-verification if on file; documented residual risk.
6. **Session fixation on login.** Rotate the session identifier on every auth event; guest cart lines copied by value into a fresh customer cart (never re-parent the guest row); old guest cart token invalidated; cookies `HttpOnly, Secure, SameSite=Lax`.
7. **Guest orders attaching on signup.** Only **verified** identifiers attach (phone verified at OTP → orders matching normalized `contact_phone` link via `orders_phone_idx`); email-matched orders attach only after email verification — otherwise it's an enumerate-and-claim attack on other people's order history.
8. **Email/phone identity collision.** Profile adds an email already on another account: block with 409, merge path explicitly deferred post-launch and logged. Never silently link two identities.
9. **Address deleted while referenced by an in-flight order.** Safe by design — `orders.shipping_address` is a jsonb snapshot; verified by an explicit test. 20-address cap enforced; two tabs setting different defaults resolve last-write-wins with the single-default transactionally maintained.
10. **Wishlist with archived product.** Renders "no longer available" instead of vanishing or 500; add is idempotent (composite PK); back-in-stock notification hook designed in even though notify ships later.
11. **Order history enumeration.** `GET /api/account/orders/[orderNumber]` returns 404 for any order not owned by the session customer — forged-ID negative test required; the guest lookup path (Module: Checkout, §2.7) must not be walkable either.
12. **No-enumeration on request.** `POST /api/auth/otp/request` returns identical 200 bodies for existing and non-existing customers; error messages never differ by account existence.

### 7. Testing Requirements

- **Unit (`packages/core`):** OTP generation (CSPRNG, no modulo bias), expiry/attempt policy, atomic-consume decision logic, peppered hash; phone normalization (+91, 0-prefix, spaces/dashes → E.164); attach-on-verify matching rules (verified-phone-only matrix); address zod schemas (pincode, phone, cap). Target ≥ 90% on these pure functions.
- **Integration (ephemeral Postgres, migrations applied):** brute-force lockout — 6th attempt fails **even with the correct code**; resend cooldown and daily caps enforced by row counts; concurrent verify → exactly one winner; session rotation — pre-login token dead post-login; guest-order attach fires on verified phone only; address-snapshot independence (delete address, in-flight order unchanged); **forged user-ID access tests on addresses/orders/wishlist/returns — all return 404/403, run as a single checklist test.**
- **E2E (Playwright, named scenarios from Risk M7):**
  1. *Full auth journey:* guest checkout → later signup with the same phone via OTP (test-mode fixed code) → order history shows the guest order → adds address → reorders with the saved address.
  2. *OTP lockout UX:* 5 wrong codes → clear lockout message → resend after cooldown → correct code works.
  3. *Wishlist persistence:* guest hearts 2 products → logs in → wishlist retained → one product archived by admin → wishlist shows "unavailable" state without error.

### 8. Production-Readiness & Definition of Done

- **Validation:** zod on every input — destination E.164 `+91[6-9]\d{9}` or lowercased email, OTP exactly 6 digits, address fields length-capped, `strict()` (reject unknown keys). All schemas live in `packages/core/src/contracts/auth.ts`.
- **Authz:** every account resource scoped by session `customer_id` with the negative-test checklist; sessions checked against `customer_sessions` (revocable, not JWT-only); admin PII access audited.
- **Rate limits:** Class C on both OTP endpoints, enforced authoritatively by counting `otp_challenges` rows in Postgres (single deployable, no Redis at launch — documented as the future extraction point); Class B on address/wishlist/profile mutations; standard `X-RateLimit-*` + `Retry-After` headers.
- **SQLi/XSS:** Drizzle parameterized throughout; names/addresses output-encoded everywhere rendered **including the admin panel**.
- **Logging:** `auth.otp_requested/verified/failed/locked {identifier_hash, ip, ua_hash}` — **identifiers hashed in logs, never raw phone/email**; `session.created/rotated/revoked`; `cart.merged {customer_id, guest_cart_id, lines_merged, conflicts}`; `orders.attached {customer_id, count}`.
- **Alerting:** OTP failure-rate spike; daily SMS spend > budget (page-level — this burns real money on day one); OTP verify-success rate < 70% (SMS delivery problem = revenue problem); auth 5xx spike; MSG91 `UPSTREAM_ERROR` rate.
- **Definition of Done:**
  - [ ] Lockout (5 attempts), 60s cooldown, daily caps, and SMS spend alert live and tested
  - [ ] Atomic OTP consume proven by the concurrent-verify integration test
  - [ ] Session rotation on login proven by test (old token dead), cookie flags asserted
  - [ ] Cart merge idempotent and triggered inside verify; `cartMerged` surfaced to UI
  - [ ] Verified-identifier-only guest-order attach, with negative test for unverified email
  - [ ] Address snapshot independence test green; single-default invariant enforced
  - [ ] No-enumeration verified on request and lookup paths (identical responses)
  - [ ] PII-hashed structured logging in place; zero raw phone/email in logs (lint/grep check in CI)
  - [ ] Forged-ID negative tests across all account resources green
  - [ ] `SmsProvider` interface with MSG91 implementation + test-mode fixed-code fake used by Playwright
  - [ ] Expired-OTP cron purge scheduled (Inngest) and observable
  - [ ] The 3 named E2E scenarios green in CI

---

## §3.6 — Module: Checkout & Order Creation

### 1. Purpose & Ownership

Converts a live-priced cart into an immutable, money-truthful order: the 4-step checkout flow (address → delivery → payment mode → review), pincode serviceability, the authoritative server quote, the placement transaction, and the 11-state order lifecycle that every other module (payments, fulfillment, admin, tracking) hangs off. This module is where every rupee the business earns is first recorded — its correctness is non-negotiable.

- **Owning lane:** **Dev C (Payments & Checkout)** — owns `apps/web/app/(storefront)/checkout/**`, cart→order conversion, order confirmation page, guest OTP order lookup backend. Dev B co-owns `packages/core/src/order-state-machine.ts` (state-machine PRs need B + C + D per §2.2); Dev A consumes tracking data for the storefront tracking page.
- **Phase assignment:** Phase 1 (W3–5) — 4-step checkout UI on MSW mocks → cart→order server action → Razorpay test-mode order → confirmation page. Phase 2 (W6–8) — real placement transaction, COD path + OTP-at-placement, retry-payment, guest lookup/tracking/cancel, PRICE_CHANGED re-quote flow. Gated by the order-lifecycle gate (end W8).
- **Bus-factor rule applies:** every PR here requires 2 approvals (Dev C + one of B/E; if C authored, B + E).

### 2. Database Schema

| Table | Role here | Key columns / constraints (see Contract anchors) |
|---|---|---|
| `orders` (owns) | Aggregate root — Contract §1.14 | `order_number` (`'KK-' \|\| lpad(nextval,5,'0')`, UNIQUE), `invoice_number` (assigned at `packed`), nullable `customer_id` (NULL = guest) with NOT NULL `contact_phone`, `cod_phone_verified_at`, `status order_status`, `payment_mode`, **snapshot columns**: `shipping_address`/`billing_address` jsonb, `coupon_code`, all fee columns (`shipping_fee_paise`, `cod_fee_paise`, `gift_wrap_total_paise` — copied from `store_settings`, never joined live), CHECK `total_paise = subtotal − discount + shipping + cod_fee + gift_wrap`. `idempotency_key text UNIQUE` (retry-safe placement), `access_token uuid UNIQUE` (guest success page, ≤24h). Indexes: `orders_customer_idx`, `orders_status_idx`, `orders_open_ops_idx` (partial, admin queue), `orders_phone_idx` (guest lookup + COD abuse), `orders_pending_expiry_idx` (partial, expiry sweep). |
| `order_items` (owns) | Immutable invoice lines — Contract §1.15 | Full snapshot per line: `product_name`, `variant_name`, `sku`, `image_url`, `hsn_code`, `gst_rate_bp`, `unit_price_paise`, per-line `taxable_value_paise` + CGST/SGST/IGST split, `gift_wrap_fee_paise` (settings snapshot). `variant_id` is `ON DELETE RESTRICT` — variants archive, never delete. Indexes: `order_items_order_idx`, `order_items_variant_idx`. |
| `order_status_history` (owns) | Append-only transition log — Contract §1.16 | `from_status` (NULL on creation), `to_status`, `actor_type` (`system`/`customer`/`admin`/`webhook`), `actor_id`, `note`. Renders the tracking timeline; settles COD/RTO disputes. Index `osh_order_idx (order_id, created_at)`. |
| `store_settings` (reads) | Fee/policy source — Contract §1.1 | Reads `shipping_fee_standard_paise`, `shipping_fee_express_paise`, `free_shipping_threshold_paise`, `cod_fee_paise`, `gift_wrap_fee_paise`, `payment_expiry_minutes`, `seller_state_code` (drives CGST/SGST vs IGST). Every value read at quote/placement is snapshotted onto the order. |
| `carts`/`cart_items` (reads/updates) | Input; cart set `status='converted'` in the placement tx — Contract §1.10–1.11. Cart lines are never price snapshots; quote is authoritative (§1.29). |
| `product_variants` (updates) | Atomic conditional stock decrement — Contract §1.28.1. |
| `coupons`/`coupon_redemptions` (updates) | Atomic exhaustion increment + redemption row inside placement tx — Contract §1.28.2. |
| `payments` (inserts) | One `created` row per prepaid placement; retry creates a new row — Contract §1.17. |
| `inventory_adjustments` (inserts) | `order_placed` ledger row per decremented variant, same tx; restocks idempotent via `inv_adj_once_per_cause_idx` — Contract §1.22. |
| `otp_challenges` (reads/consumes) | Purposes `cod_verification` (placement) and `order_lookup` (guest tracking) — Contract §1.8. Atomic consume. |

**State machine (Contract §1.27, normative — full 11 states):**

| State | Meaning | Terminal |
|---|---|---|
| `pending_payment` | Prepaid placed; Razorpay order created; stock reserved (decremented) | no |
| `payment_failed` | Last attempt failed; retryable 24h | no |
| `cod_pending_confirmation` | COD placed (phone OTP verified at placement); awaiting merchant confirmation | no |
| `confirmed` | Money captured / COD confirmed; committed to fulfil | no |
| `packed` | Picked & packed; GST `invoice_number` assigned | no |
| `shipped` | AWB assigned, courier picked up | no |
| `out_for_delivery` | Courier OFD scan | no |
| `delivered` | POD; COD payment → `cod_collected` | **yes** |
| `cancelled` | Pre-dispatch cancel; restocked; prepaid auto-refunded | **yes** |
| `rto_initiated` | Courier returning to origin | no |
| `rto_delivered` | Back at warehouse; QC restock; COD loss recorded | **yes** |

Legal transitions are exactly the Contract §1.27 table (e.g. `pending_payment → confirmed|payment_failed|cancelled`; `payment_failed → pending_payment|cancelled`; `cod_pending_confirmation → confirmed|cancelled`; `confirmed → packed|cancelled`; `packed → shipped|cancelled`; `shipped → out_for_delivery|delivered|rto_initiated`; `out_for_delivery → delivered|rto_initiated`; `rto_initiated → out_for_delivery|rto_delivered`). Anything else → 422 `INVALID_TRANSITION`. The map is data (`ORDER_TRANSITIONS` in `packages/core/src/order-state-machine.ts`, 100% branch coverage in CI); every transition executes as `SELECT ... FOR UPDATE` on the order row → validate → `UPDATE orders` + `INSERT order_status_history` + side effects in one transaction (Contract §1.28.3).

**Concurrency patterns applied here:** §1.28.1 atomic stock decrement (zero rows ⇒ abort ⇒ 409 `OUT_OF_STOCK`), §1.28.2 coupon exhaustion increment, §1.28.3 FOR-UPDATE transitions, §1.28.5 idempotent placement via `idempotency_key UNIQUE`.

### 3. API Design

All checkout endpoints are Route Handlers (external calls involved), **rate-limit Class D (10/min per session)** unless noted. Envelope per Contract §2.1; common errors (400/401/403/429/500) not repeated.

| Endpoint | Method | Auth | Class | Request → Response | Endpoint-specific errors |
|---|---|---|---|---|---|
| `/api/shipping/serviceability?pincode=&cod=` | GET | public | A (120/min/IP) | pincode → `{ serviceable, codAvailable, options[{option, feePaise, etaDaysMin/Max}] }` | 400 (bad pincode); 422 `PINCODE_UNSERVICEABLE`; 502 `UPSTREAM_ERROR` (Shiprocket down — UI falls back to "standard only, verified at dispatch") |
| `/api/checkout/quote` | POST | public (cart cookie) | D | `{ pincode, deliveryOption, paymentMode, couponCode? }` → `{ quote: CheckoutQuote }` (lines, subtotal/discount/shipping/codFee/giftWrap/total paise, informational CGST/SGST/IGST, ETA) | 410 `CART_EXPIRED`; 409 `OUT_OF_STOCK` (details: lines); 422 `COUPON_INVALID`/`COUPON_EXPIRED`/`COUPON_MIN_NOT_MET`/`COUPON_EXHAUSTED`/`COUPON_LIMIT_REACHED`; 422 `PINCODE_UNSERVICEABLE`/`COD_UNAVAILABLE` |
| `/api/checkout/orders` | POST | public (cart cookie) \| customer | D | **Place order.** `{ idempotencyKey, contact{phone,email?}, shippingAddress, billingAddress?, deliveryOption, paymentMode, couponCode?, customerNote?, expectedTotalPaise, codOtp?{challengeId,code} }` → 201 prepaid: `{ orderId, orderNumber, accessToken, razorpay{orderId,keyId,amountPaise,currency,prefill} }`; 201 cod: `{ orderId, orderNumber, accessToken, status:'cod_pending_confirmation' }` | 401 `OTP_INCORRECT` / 410 `OTP_EXPIRED` (COD OTP); 409 `OUT_OF_STOCK` (details: `[{variantId, requested, available}]`); 409 `PRICE_CHANGED` (details: fresh `CheckoutQuote`); 409 `DUPLICATE_REQUEST` → replays original 201 body; 410 `CART_EXPIRED`; 422 coupon/serviceability codes; 502 `UPSTREAM_ERROR` (Razorpay create failed — order rolled to `payment_failed`, stock released) |
| `/api/checkout/verify` | POST | public | D | Razorpay JS success handler. `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` → `{ orderNumber, status:'confirmed' }` | 401 `SIGNATURE_INVALID`; 404 unknown razorpayOrderId; 409 `ALREADY_PROCESSED` (idempotent — returns confirmed state); 502 |
| `/api/checkout/orders/[orderId]/retry-payment` | POST | guest-token \| customer | D | → `{ razorpay: {...} }` (new `payments` row, `payment_failed → pending_payment`) | 404; 409 `CONFLICT` (already paid); 410 `GONE` (cancelled/expired); 502 |
| `/api/orders/lookup/request-otp` | POST | public | C (OTP limits) | `{ orderNumber, phone }` → `{ sent: true }` — **always 200 generic body, no enumeration** | 429; 502 `UPSTREAM_ERROR` |
| `/api/orders/lookup/verify` | POST | public | C | `{ orderNumber, phone, code }` → `{ trackingToken (JWT 30 min {orderId, scope:'tracking'}), order: OrderSummary }` | 401 `OTP_INCORRECT`; 410 `OTP_EXPIRED` |
| `/api/orders/[orderNumber]/tracking` | GET | customer-owner \| Bearer trackingToken \| `?accessToken=` (≤24h) | A | → `{ order, timeline: TimelineStep[], shipment{awb, courierName, expectedDeliveryAt} \| null }` | 401; 404; 410 `TOKEN_EXPIRED` |
| `/api/orders/[orderNumber]/cancel` | POST | customer-owner \| Bearer trackingToken | D | `{ reason }` → `{ order }` (state machine: restock + auto-refund if captured) | 422 `INVALID_TRANSITION` (already packed/shipped); 404; 401 |

**Idempotency (normative):** placement is keyed by client-minted `idempotencyKey` (UUID generated when the review step renders), UNIQUE in `orders`; replay returns the original 201 (`IDEMPOTENCY_REPLAY` in meta / 409 `DUPLICATE_REQUEST` semantics per §2.5). The same key becomes the Razorpay order `receipt` so a Vercel timeout mid-create is reconcilable. `/checkout/verify` is idempotent by construction — it converges on `confirmed` with the `payment.captured` webhook via the shared `confirmPayment`.

**Placement transaction (normative order, Contract §2.5 — reproduce exactly):**
1. Validate quote server-side (server recomputes everything; compare against `expectedTotalPaise` → 409 `PRICE_CHANGED` on drift)
2. `INSERT orders` (status `pending_payment` | `cod_pending_confirmation`)
3. Atomic stock decrements (§1.28.1) — abort whole tx on any failure
4. Coupon increment (§1.28.2) + `coupon_redemptions` row
5. `order_items` snapshot inserts
6. `payments` row (`created`; COD's `cod_pending_collection` is set later at confirm)
7. Commit → **then** call Razorpay Orders API (prepaid, outside the tx)
8. On Razorpay failure: compensating tx (restock, payment `failed`, order `payment_failed`) → 502

### 4. Frontend Requirements

Pages/components: `/checkout` (4 steps: Address → Delivery → Payment → Review, single route with step state), Razorpay JS modal mount, order success page `/order/success` (via `access_token` for guests), retry-payment screen, guest order lookup (`/account/track` OTP flow), tracking timeline page, cancel-order dialog. Phase 1 builds all of this against MSW fixtures (including the `PRICE_CHANGED` quote fixture and `KK-CHAMP-MOCK-OOS` variant per Contract §3.2).

- **Loading:** step transitions show skeleton totals panel (never stale totals); serviceability check inline spinner on pincode blur; "Placing your order…" full-button spinner with the button disabled and the idempotency key already minted; verify step shows "Confirming payment…" interstitial after Razorpay modal closes.
- **Empty:** checkout entered with empty/expired cart (410 `CART_EXPIRED`) → redirect to `/cart` with "Your cart is empty" state and shop CTA — never a blank checkout.
- **Error:** field-level `fieldErrors` rendered inline from zod flatten; 422 `PINCODE_UNSERVICEABLE` blocks progression at the address step with the message and a pincode edit affordance; 422 `COD_UNAVAILABLE` disables the COD option with reason ("COD not available for this pincode/order value"); 502 serviceability fallback banner "standard only, verified at dispatch"; 502 on placement shows "Payment setup failed — your card was not charged" with retry.
- **Success:** 201 → success page with `orderNumber` (KK-XXXXX), IST-formatted ETA, itemized snapshot totals, COD orders show "We'll call to confirm" state; prepaid shows confirmed after `/checkout/verify`.
- **Partial-failure:** 409 `PRICE_CHANGED` → **blocking re-quote sheet** diffing old vs new totals line-by-line; user must explicitly accept the fresh quote before re-submitting (with a new quote, same idempotency key semantics per attempt). 409 `OUT_OF_STOCK` at review → per-line "just sold out" markers from `details`, cart auto-updated, no order/payment created. Razorpay modal dismissed/failed → order exists in `pending_payment`/`payment_failed`; show "Complete your payment" panel wired to retry-payment (24h window), not a dead end.

### 5. Admin Panel Requirements

Owned by Dev D's admin surface but driven by this module's state machine and endpoints (`/api/admin/orders/*`, Contract §2.9):

- **View:** orders list filtered by status/paymentMode/q/IST date range; order detail (items, payments, refunds, shipments + events, full `order_status_history`, return requests); ops queue backed by `orders_open_ops_idx` (`cod_pending_confirmation`/`confirmed`/`packed`).
- **Edit (staff):** `POST /transition` (buttons enabled from `ORDER_TRANSITIONS`; server rejection with 422 `INVALID_TRANSITION` + `details.allowed` is the guarantee), `POST /confirm-cod` (`confirmed`/`cancelled` outcome + note), `POST /cancel` (restock + auto-refund if captured). COD queue rows are claim-locked (visible assignee, 15-min auto-release) so two staff never call the same customer.
- **Owner-only:** refunds (`POST /api/admin/orders/[id]/refunds` — and >₹5,000 refunds are owner-gated per risk Module 4); order-data CSV exports. Staff cannot initiate refunds at all.
- Every admin mutation writes `admin_audit_log` (`order.transition`, before/after) and an `order_status_history` row with `actor_type='admin'`.

### 6. Edge Cases

(From risk-engineering Module 3; numbering theirs.)

1. **Concurrent oversell on the last unit:** two buyers both pass the stock read. Defense is the atomic conditional `UPDATE ... WHERE stock_quantity >= $qty` inside the placement tx; zero rows = clean "just sold out" at review. Never check-then-write. Prepaid holds stock for 30 min pending payment; expired holds released by the stuck-payment sweep.
2. **Double-click double-submit on "Place Order":** server-side idempotency key (minted at review render, UNIQUE on `orders`); replay returns the original order. Same key = Razorpay receipt.
3. **Pincode serviceable at checkout, not at fulfillment:** 24h-TTL cache said yes; courier delists it later. Order lands in the admin fulfillment-blocked queue (alternate courier / refund / hold) — never silently stuck. Serviceability snapshot (courier, ETD, check timestamp) stored for dispute forensics.
4. **Gift message hostile input:** XSS payload, 2000-char paste, ZWJ emoji, RTL/Bengali mix. Zod caps at 300 chars measured in **grapheme clusters**; stored raw; encoded at every render (web, email, packing-slip PDF); control chars stripped; packing-slip generator handles non-Latin scripts.
5. **Illegal state transitions:** `delivered → cancelled`, double-cancel, `cancelled → shipped`. Pure transition function in `packages/core`; every transition writes `order_status_history`; anything off-map is 422 `INVALID_TRANSITION`.
6. **Vercel timeout mid-order-creation:** tx committed, response never reached the client. Client retries with the same idempotency key → gets the existing order. This is exactly why the key is client-minted *before* submission.
7. **Address edge cases:** pincode validated against a real dataset (`000000` passes `\d{6}`); `#`/`/`/floor markers in lines; apostrophes in names; +91 normalization; APO-style unserviceable pincodes blocked at the address step, not at payment.
8. **COD offered then ineligible:** COD depends on pincode COD-serviceability AND order-value cap AND fraud signals (repeat-RTO phone). Recomputed on every step render and again at final submission — cart contents changing on the review step must flip it live.
9. **COD OTP verification at placement:** `codOtp` required for COD unless the customer session already has a verified phone; the challenge (`purpose='cod_verification'`) is consumed atomically; success sets `orders.cod_phone_verified_at`. Wrong code → 401 `OTP_INCORRECT` with `attemptsLeft`; 5 fails / TTL → 410 `OTP_EXPIRED`.
10. **IST vs UTC boundaries:** storage UTC; "orders today" and reconciliation windows are IST calendar days converted server-side. The 11:30 PM IST order landing in "tomorrow" is a mandatory boundary test.
11. **GST snapshot at placement:** lines store `{hsn_code, gst_rate_bp, taxable_value_paise, tax split}` computed from tax-inclusive paise at placement; later rate changes never alter historical orders (refund side uses the snapshot too).
12. **Guest contact collides with an existing account:** order is created as guest; it attaches to the account only on later OTP verification of that phone/email. Never leak "this email has an account" during guest checkout (enumeration).

### 7. Testing Requirements

- **Unit (`packages/core`) — the highest-priority suite in the repo:** order state machine full transition matrix (every state × every event, legal and illegal, table-driven — **100% branch coverage on `order-state-machine.ts`, CI-enforced**); GST extraction from inclusive paise (`tax = round(gross * rate_bp / (10000 + rate_bp))`) against hand-computed fixtures including rounding boundaries; total CHECK invariant; COD eligibility; pincode validation; grapheme-cluster gift-message length; delivery-option pricing. **≥ 95% coverage on state machine and money/GST math; CI fails below.**
- **Integration (ephemeral Postgres, migrations applied):** the **concurrent-oversell test** — two parallel transactions buying the last unit, assert exactly one succeeds (non-negotiable, runs on every PR); idempotency-key replay returns the same order; stock-hold expiry releases units; compensating tx on simulated Razorpay 5xx (restock + `payment_failed`); illegal transition rejected at the API layer; COD OTP atomic-consume race (one winner); `PRICE_CHANGED` when the quote drifts from `expectedTotalPaise`; guest tracking-token scope (token for order A cannot read order B).
- **E2E (Playwright, named scenarios from risk Module 3):**
  1. *The golden path:* guest buys 2 bars prepaid via Razorpay test card → confirmation page + email → admin sees the order confirmed → mocked Shiprocket push → tracking page shows AWB.
  2. *Double-submit:* intercept and replay the place-order request 3× via a Playwright route handler; assert one order in admin and one Razorpay order created.
  3. *Sold-out at review:* second browser context buys the last unit while the first sits on review; first submits, sees "just sold out," cart updated, no order or payment created.

### 8. Production-Readiness & Definition of Done

- **Validation:** zod (from `packages/core/src/contracts/checkout.ts`) on every step payload, `strict()`; address schema backed by the pincode dataset; **server recomputes ALL totals — client sends line refs + coupon code + `expectedTotalPaise` only, never prices.**
- **Authz:** order readable only by owning session, valid tracking token, or ≤24h `access_token`; guest lookup requires orderNumber + phone + OTP (no enumeration — `order_number` is non-sequential-guessable in practice and the lookup endpoint always returns generic 200); forged-ID negative tests required.
- **Rate limits:** placement/quote/verify/retry Class D (10/min/session); serviceability Class A (120/min/IP); lookup OTP Class C (1/60s + 3/10min + 10/day per destination, 20/hr/IP, 5 verify attempts).
- **SQLi/XSS:** Drizzle parameterized throughout; gift messages and address fields output-encoded on web, emails, and packing slips (per Edge Case 4).
- **Idempotency:** client-minted key UNIQUE in DB covering placement end-to-end; Razorpay order create keyed by receipt; verify/webhook converge idempotently on `confirmed`.
- **Logging:** structured `order.created {order_id, idempotency_key, user/guest, total_paise, payment_mode, item_count, coupon}`; every state transition (also persisted in `order_status_history`); `order.oversell_rejected {variant_id}`; `order.fulfillment_blocked {reason}`; `checkout.price_changed {delta_paise}`. Hash phone/email in logs, never raw PII.
- **Alerts:** orders stuck `pending_payment` > 30 min (sweep-detected); fulfillment-blocked queue > 0 for > 4h; oversell-rejection spike (stock-accounting bug signal); order-creation error rate > 2%; COD queue oldest-unconfirmed > 24h.
- **Definition of Done:**
  - [ ] Atomic stock decrement proven by the concurrency test in CI
  - [ ] Idempotent creation proven by the replay test
  - [ ] State machine table-driven-tested; `order-state-machine.ts` at 100% branch coverage
  - [ ] GST/HSN/price snapshots on every order line; fee snapshots from `store_settings` on every order
  - [ ] Placement transaction implements the Contract §2.5 normative order incl. compensating tx on Razorpay failure
  - [ ] COD OTP at placement with atomic consume; `cod_phone_verified_at` set
  - [ ] `PRICE_CHANGED` re-quote flow blocking and explicit in the UI
  - [ ] IST day-boundary test green
  - [ ] `order_status_history` written on every transition, all actors
  - [ ] Guest lookup non-enumerable; tracking/cancel token-scoped with negative tests
  - [ ] Rate limits (A/C/D) live with `X-RateLimit-*` headers
  - [ ] Alerts wired; 3 E2E scenarios green in CI

---

## §3.7 — Module 24 — Content, Blog & SEO (MDX journal, structured data, sitemap, static pages)

### 1. Purpose & Ownership

Everything Google, WhatsApp link previews, and first-visit browsers see that isn't transactional: the MDX journal (6 full articles carried over from the prototype with real copy), all structured data (JSON-LD), the sitemap/robots pipeline, canonical URLs, OG images, and the static page set — Help/FAQ, Our Story, Contact, Store locator, Legal pages (including the FSSAI license and Legal Metrology seller details rendered from `store_settings`). For a D2C brand with zero marketplace presence, organic discovery and shareable PDPs are the acquisition floor; a JSON-LD price bug or an indexed staging domain is publicly visible and merchandising-fatal.

- **Owning lane:** **Dev A** (Storefront & SEO) — owns `apps/web/content/**` (MDX), all metadata/JSON-LD/sitemap/OG code, and reviews every PR touching public-facing metadata. Dev B is consulted for the shared visibility predicate helper (it queries `packages/db`).
- **Phase:** **Phase 1 (W3–5)** — static pages, journal, legal content final; **Phase 2 (W6–8)** — the dedicated SEO pass (JSON-LD, sitemap, OG images) per the phase plan. Lighthouse CI budgets (Dev A's responsibility) turn blocking from W5.
- **Explicitly not owned here:** product copy authoring (admin catalog, Module: Catalog/Admin), review aggregates (Reviews module — this module only *consumes* `products.rating_avg/rating_count`), `store_settings` mutations (owner-edited via admin; this module reads only).

### 2. Database Schema

**This module owns zero tables.** Blog content is MDX files in `apps/web/content/journal/**` (decision record §1: no CMS until a non-developer writes content). Store locator locations are static typed data in `apps/web/content/stores.ts` — real India locations TBD by owner before launch (prototype addresses are fictional US ones and must not ship).

Tables **read** (never written) by this module:

| Table | What this module reads | Contract ref |
|---|---|---|
| `products` | `slug`, `name`, `blurb`, `description`, `rating_avg`, `rating_count` (denormalized, recomputed on moderation), `is_active`, `updated_at` — sitemap entries, `Product` JSON-LD, OG image text | Contract §1.3 |
| `product_variants` | default variant's `price_paise` (MRP, GST-inclusive), `compare_at_price_paise`, `stock_quantity > 0` → `offers.availability`; `weight_grams` for Legal Metrology net-quantity display | Contract §1.4 |
| `product_images` | primary image URL for JSON-LD `image` and OG fallback | Contract §1.5 |
| `categories` | `slug`, `name`, `is_active` — sitemap + `BreadcrumbList` | Contract §1.2 |
| `store_settings` | `fssai_license_number`, `seller_gstin`, `seller_legal_name`, `seller_address`, `support_phone`, `support_email` — footer, Legal pages, Contact, `Organization` JSON-LD | Contract §1.1 |

**The shared visibility predicate** is the load-bearing pattern: one exported query helper (`visibleProducts()` — `is_active = true` on product AND ≥1 active variant, matching Contract §1.3's `products_category_active_idx` partial index) is used by storefront search, catalog routes, **and** the sitemap generator. Sitemap must never have its own hand-rolled WHERE clause — one source of truth, per risk-engineering Module 12 #1.

No snapshot columns, state machines, or concurrency patterns apply — all reads, no writes. MDX frontmatter (title, slug, description, publishedAt, heroImage, draft flag) is zod-validated at build time; invalid frontmatter fails `next build`.

### 3. API Design

No JSON API endpoints. This module owns file-convention routes and one revalidation hook. All public routes are Class A rate-limited (120/min/IP) by the global middleware and edge-cached.

| Route / mechanism | Method | Auth tier | Behavior | Errors |
|---|---|---|---|---|
| `/sitemap.xml` (`app/sitemap.ts`, index + chunk structure, <50k URLs/file from day one) | GET | public | Home, shop, category pages, PDPs via shared visibility predicate, published journal posts, static pages. `lastModified` from `updated_at`/frontmatter. `Cache-Control: s-maxage=3600`. Regenerated on publish events + daily cron (pings healthchecks.io dead-man switch) | none custom; generation failure alerts |
| `/robots.txt` (`app/robots.ts`) | GET | public | Prod: allow + sitemap URL; disallow `/admin`, `/api`, `/checkout`, `/account`. Non-prod: `Disallow: /` | — |
| `/journal`, `/journal/[slug]` | GET | public | Static-generated from MDX; draft-frontmatter posts excluded from build output and sitemap | 404 `NOT_FOUND` for unknown slug; renamed slugs 301 via shared redirect map |
| `/about`, `/help`, `/contact`, `/stores`, `/legal/*` (privacy, terms, refund, shipping) | GET | public | Static/ISR pages; Legal + footer render FSSAI license and Legal Metrology seller details live from `store_settings` (ISR, revalidated on settings change) | — |
| `opengraph-image.tsx` per PDP/journal/category (ImageResponse) | GET | public | 1200×630 branded OG card: product name, `formatPaise` price, brand palette. Stable URLs — keep serving for inactive products (old social shares must not break) | falls back to static brand OG on render failure |
| `POST /api/revalidate` | POST | `admin:staff` (Class E, 600/min) | Body `{ tag: string }`, zod-validated against an allowlisted tag set (`product:{slug}`, `journal`, `settings`, `sitemap`). Backs the admin "force revalidate" button; failed automatic revalidations retried via Inngest | 400 `VALIDATION_ERROR` (unknown tag), 401 `UNAUTHORIZED`, 403 `FORBIDDEN` |

**Idempotency:** sitemap regeneration and `revalidateTag` calls are idempotent by construction; publish-revalidation retries are safe to replay. **Canonical URLs:** every page emits a self-referencing absolute canonical built from validated `NEXT_PUBLIC_SITE_URL` (`packages/config` zod schema — build fails on missing/malformed value; a staging domain can never leak into prod canonicals). **noindex:** non-prod deployments send `X-Robots-Tag: noindex` via middleware, gated on env, and serve no sitemap.

**JSON-LD emitted (server-rendered, same data as the page render — atomically consistent):**
- `Product` + `Offer` on PDP: `price` as decimal string from paise via the shared `formatPaise()` in `packages/core/src/money.ts` (49900 → `"499.00"`), `priceCurrency: "INR"`, `availability` from live variant stock. **`AggregateRating` is emitted only when `rating_count ≥ 1` from approved reviews — omitted entirely otherwise; never `ratingCount: 0`, never pending reviews** (risk Module 12 #3 / Reviews #11).
- `BreadcrumbList` on PDP/category/journal. `Article` on journal posts. `Organization` + `LocalBusiness` (store locator) from `store_settings`.
- Serialization rule: `JSON.stringify` with `<` escaped into the script tag — never string-concatenated templates.

### 4. Frontend Requirements

**Pages powered:** Journal list + article (`/journal`, `/journal/[slug]`), Our Story (`/about`), Help/FAQ (`/help` — 6 categories, 8 FAQs from prototype copy), Contact (`/contact`), Store locator (`/stores`), Legal pages (`/legal/*`), plus metadata/JSON-LD/OG contributions to every storefront page (Home, Shop, PDP, category).

Required UI states (all static/ISR pages, so "loading" is mostly build-time — but client islands still need states):

- **Loading:** journal list shows 6 card skeletons matching final card dimensions (CLS budget 0.1 is CI-blocking); store locator map/list area shows skeleton while the (static) location list hydrates.
- **Empty:** journal with zero published posts renders "Stories are brewing — first post soon" with a shop CTA, not a blank grid; Help search with no matching FAQ shows "No answers found" + Contact link; store locator with no locations yet (owner hasn't confirmed real addresses) renders "Find us online" fallback — this state WILL ship if owner data is late, design it properly.
- **Error:** MDX article that fails to compile fails the **build** (never a runtime 500); unknown journal slug → styled 404 with journal-index link; `store_settings` read failure on Legal pages renders the page with a "details temporarily unavailable" block for the FSSAI/seller section rather than 500ing legally required pages — and logs at error level (missing FSSAI display is a compliance bug).
- **Success:** article page with hero image, reading time, Article JSON-LD, prev/next post links; Legal pages showing FSSAI license number, seller legal name/address, GSTIN, and Legal Metrology fields (MRP inclusive-of-all-taxes wording, net quantity, best-before guidance) from `store_settings`.
- **Partial failure:** contact form (posts to a simple server action → Resend to `support_email`) failing shows inline retry + the `support_phone`/`support_email` values as fallback so the page still fulfills its purpose; OG image render failure falls back to the static brand card (never a broken image in a share preview).

### 5. Admin Panel Requirements

Deliberately thin — content is in-repo MDX, so "publishing" is a merged PR (Dev A is the editor at launch; CMS is a deferred decision).

- **Force revalidate** button on admin product detail and a global "Content" utility page: calls `POST /api/revalidate` with an allowlisted tag; answers the editorial "why isn't my change live" question. **Staff** may trigger it (Class E limits apply).
- **`store_settings` display fields** (FSSAI license, seller GSTIN, legal name/address, support contacts): edited in the admin Settings surface (owned by the Admin module) — **owner-only** for legal-identity keys. This module's obligation is that footer/Legal/Contact/JSON-LD re-render within one ISR window of a change (settings revalidation tag).
- **Read-only SEO health panel** (Phase 2, nice-to-have within the phase): last sitemap generation time + URL count, last JSON-LD integrity-sample result, count of pending revalidation retries. Staff-visible.
- No admin blog editor at launch — explicitly out of scope; do not build one.

### 6. Edge Cases

(From risk-engineering Module 12, adapted to contract vocabulary.)

1. **Sitemap listing inactive/draft content.** Sitemap must be generated from the same `is_active` predicate helper as search/catalog (one source of truth); draft-frontmatter journal posts excluded; regenerated on publish events + daily.
2. **Structured data with stale price/stock.** `offers.price`/`availability` cached in ISR while price changed → Google flags mismatch, rich results drop. JSON-LD renders from the same server data as the page (atomically consistent per render); PDP revalidation triggers on price/stock change; **nightly integrity check samples N PDPs and diffs JSON-LD price vs DB**, alerting on divergence.
3. **`AggregateRating` with zero/unmoderated reviews.** Emitting `ratingCount: 0` or counting pending reviews violates Google guidelines — omit the block entirely below ≥1 approved review; values come only from the DB aggregate (`products.rating_avg/rating_count`), never client-influenced.
4. **Paise formatting bug in JSON-LD.** `price` must be `"499.00"` (decimal string) with `priceCurrency: "INR"` — emitting `49900` is publicly visible in rich results. Single shared formatter in `packages/core/src/money.ts`, unit-tested, used by JSON-LD, OG images, and UI alike.
5. **Blog/product slug rename.** Renames create entries in the shared slug-redirect infrastructure (same mechanism as Catalog); old URL 301s to new; canonicals are always self-referencing absolute URLs; env-derived base URL asserted at build so a staging domain never leaks into canonicals.
6. **Preview/staging deployments indexed.** Non-prod serves `X-Robots-Tag: noindex` and no sitemap, gated by env var — asserted by an integration test that hits a preview URL and checks the header (also on the launch-gate checklist).
7. **ISR revalidation failure on publish.** Revalidate-on-publish failures are logged and retried via Inngest; the admin force-revalidate button is the manual escape hatch.
8. **Perishable data leaking into machine-readable offers.** Best-before/batch info shown on PDP stays out of `Offer` (no misread as offer expiry); melt-season regional gating must not cloak — serve identical HTML to bots and users, gate at add-to-cart, not at content.
9. **OG images for renamed/inactive products.** OG image URLs stay stable or 301; inactive-product OG endpoints keep serving so old social embeds don't break (the 410/inactive page still carries valid OG).
10. **Sitemap growth.** Chocolate-catalog scale won't hit limits, but the generator uses an index + chunk structure (<50k URLs/file) from day one so growth never breaks it.
11. **MDX/markdown XSS.** No raw-HTML passthrough in the MDX pipeline (rehype-sanitize allowlist); iframes allowlisted to known hosts or blocked. Authors are semi-trusted devs, but their accounts can be compromised — the pipeline is the guard, not trust.
12. **`store_settings` key missing at render.** Legal page requests `fssai_license_number` and gets no row: render degraded block + error log + alert (nightly integrity check includes required-settings-keys presence) — never a silent blank in legally required copy.

### 7. Testing Requirements

- **Unit (`packages/core` + `apps/web` utils):** paise→JSON-LD price formatter (`49900 → "499.00"`, zero, single-digit paise like `50 → "0.50"`, large values — hand-computed fixtures); canonical URL builder across the env matrix (local/preview/prod); sitemap visibility-predicate helper (shared with search — test they are literally the same export); MDX sanitize pipeline against an XSS fixture corpus (script tags, event handlers, `javascript:` hrefs, disallowed iframes); frontmatter zod schema (missing/invalid fields fail).
- **Integration (ephemeral Postgres, seeded):** sitemap contents vs seeded DB — the published-only invariant (create inactive product + draft post, assert absent); JSON-LD schema validity for `Product`/`Offer`/`Article`/`BreadcrumbList` validated against schema.org shapes with a fixture validator in CI; `AggregateRating` omitted at `rating_count = 0` and present at ≥1 approved; noindex header asserted on a non-prod-configured render; slug-redirect rows honored (old slug → 301 → new); `/api/revalidate` rejects unknown tags (400) and non-admin sessions (401/403).
- **E2E (Playwright, the 3 named scenarios from risk-engineering Module 12):**
  1. *Publish-to-index pipeline:* admin publishes a product → sitemap includes the URL after regeneration → PDP JSON-LD parses (Playwright extracts and JSON-parses the script tag) with correct INR decimal price and availability.
  2. *Archive cleanup:* deactivate a product → sitemap drops the URL → old URL returns the gone/inactive treatment with noindexable body → OG endpoint still serves a valid image.
  3. *Blog flow:* publish a post containing an XSS-attempt fixture → renders sanitized → `Article` JSON-LD valid → post appears in sitemap → rename slug → old URL 301s to new.

### 8. Production-Readiness & Definition of Done

- **Validation:** zod on MDX frontmatter at build; zod on `/api/revalidate` body with tag allowlist; `NEXT_PUBLIC_SITE_URL` validated by the `packages/config` boot schema — **build fails on missing/malformed value**.
- **Authz:** revalidation endpoint `admin:staff`; content "publishing" is PR review (Dev A CODEOWNERS on `apps/web/content/**` and all metadata code); `store_settings` legal keys owner-only (enforced in the Admin module, asserted in its exhaustive authz test).
- **Rate limits:** nothing beyond global Class A on public reads; sitemap/robots cached at edge (`s-maxage`), so they cannot become a DB-load vector; `/api/revalidate` under Class E.
- **XSS/injection:** rehype-sanitize allowlist on the MDX pipeline; JSON-LD via serializer with `<` escaping — string-template JSON-LD fails review; all `store_settings` values encoded at render.
- **Logging:** publish/unpublish events; revalidation failures with tag + error; sitemap generation `{url_count, duration}` per run; degraded-legal-block renders at error level.
- **Alerting:** JSON-LD nightly integrity-sample failure; sitemap generation failure or daily-cron dead-man miss (healthchecks.io); required-`store_settings`-key missing; Search Console error review is a **manual weekly runbook item** at launch (noted in the ops runbook, owner: Dev A).
- **Definition of Done:**
  - [ ] Shared visibility predicate — sitemap, search, and catalog import the same helper (asserted by test)
  - [ ] JSON-LD (`Product`/`Offer`/`Article`/`BreadcrumbList`) validated against schema.org shapes in CI; `AggregateRating` omitted below 1 approved review
  - [ ] `formatPaise` JSON-LD price formatter unit-tested with hand-computed fixtures
  - [ ] noindex-on-preview asserted by integration test AND verified absent on prod (launch-gate item)
  - [ ] Canonicals absolute + self-referencing; build fails on bad `NEXT_PUBLIC_SITE_URL`
  - [ ] Slug-redirect infra shared with Catalog; blog rename 301 tested
  - [ ] Sanitized MDX pipeline passing the XSS fixture corpus
  - [ ] 6 prototype journal articles migrated to MDX with valid frontmatter; Help (6 categories / 8 FAQs), Our Story, Contact live
  - [ ] Legal pages render FSSAI license + Legal Metrology seller details from `store_settings`, with degraded-state handling; India-rewritten legal copy final (Phase 1 exit)
  - [ ] Store locator ships with real India locations from owner, or the designed "Find us online" fallback — fictional prototype addresses are a launch blocker either way
  - [ ] OG images render for PDP/journal/category with stable URLs for inactive products
  - [ ] Sitemap index+chunk structure, daily regen cron on a dead-man switch, JSON-LD integrity sampler alert-wired
  - [ ] The 3 E2E scenarios green in CI

---

## §3.8 — Module: Payments — Razorpay Prepaid + COD Lifecycle

### 1. Purpose & Ownership

This module is the money-truth layer: it takes an order from `pending_payment` / `cod_pending_confirmation` to a truthful terminal financial state — captured, refunded, COD-remitted, or written off. It owns the Razorpay integration (order create at placement, checkout verify, webhook processing, refunds), the full COD lifecycle (pre-dispatch confirmation queue → collection → remittance matching), and the reconciliation crons that make the system correct even when webhooks never arrive. Nothing ships, and no marketing spend unlocks (COD gate, §2.5), until this module works.

- **Owning lanes:** **Dev C** (Razorpay client in `packages/integrations/src/razorpay/**`, `/api/webhooks/razorpay`, `/api/checkout/verify`, retry-payment, refunds, payment reconciliation crons) + **Dev D** (COD confirmation queue admin UI + `confirm-cod` action, COD remittance admin views). Dev E is second reviewer of record on all webhook code.
- **Bus-factor rule applies to every PR here:** two approvals — Dev C + one of Dev B/Dev E (if C authored: B + E).
- **Phase:** Phase 2 (Weeks 6–8). Build order within the phase: payment webhooks first (everything downstream hangs off them) → COD path + confirmation queue → refunds → reconciliation crons.

### 2. Database Schema

| Table | Role here | Key columns / constraints |
|---|---|---|
| `payments` (Contract §1.17) | One row **per payment attempt** — retries create new rows, never mutate old ones | `provider` (`razorpay`\|`cod`), `provider_order_id`/`provider_payment_id` with partial UNIQUE indexes `payments_provider_payment_idx` / `payments_provider_order_idx` (webhook correlation keys), `amount_paise > 0`, `amount_refunded_paise <= amount_paise`, `signature_verified` boolean, `failure_code`/`failure_reason`, `cod_remitted_at`/`cod_remittance_ref`, `raw_payload` jsonb. Partial index `payments_cod_remit_idx` on `status IN ('cod_collected','cod_pending_remittance')` drives the remittance queue. |
| `refunds` (Contract §1.18) | One row per refund instruction | `provider_refund_id` (`rfnd_xxx`, partial UNIQUE `refunds_provider_idx`), `destination` (`original_method`\|`bank_transfer`\|`upi`), `status` (`initiated → processed\|failed`), `payout_reference` (UTR/UPI ref for manual COD refunds), `initiated_by` FK to `admin_users`, links to `payment_id` and `return_request_id`. |
| `webhook_events` (Contract §1.21) | Idempotency ledger — the "persist" half of persist-then-ack (Contract §2.6) | `UNIQUE (provider, event_id)` is the dedupe gate; Razorpay `event_id` = `x-razorpay-event-id` header. `status`: `received → processing → processed\|failed\|skipped`; partial index `webhook_events_pending_idx` feeds the worker + ops dashboard. Raw `payload`/`headers` stored verbatim. |
| `orders` (§1.14) | Read/transition | Transitions via `SELECT ... FOR UPDATE` + `ORDER_TRANSITIONS` map only (§1.28.3). `total_paise` is the amount-match reference; `idempotency_key` doubles as the Razorpay `receipt` for reconciliation matching. |
| `order_status_history` (§1.16) | Written on every transition this module drives | `actor_type` = `webhook`/`system`/`admin`; settles COD disputes. |
| `inventory_adjustments` (§1.22) | Side effect of cancel/expiry paths | Restock rows with reasons `payment_expired`/`order_cancelled`; `inv_adj_once_per_cause_idx` makes webhook-replay restocks idempotent. |
| `otp_challenges` (§1.8) | COD phone verification at placement (`purpose='cod_verification'`) | Consumed atomically; sets `orders.cod_phone_verified_at`. |

**Payment state machine (Contract §1.17, normative):**
- Prepaid: `created → authorized → captured`; `created|authorized → failed`; `captured → partially_refunded → refunded`.
- COD: `cod_pending_collection` (set at order confirm) `→ cod_collected` (on `delivered`) `→ cod_pending_remittance → cod_remitted`; RTO ⇒ `failed`.
- Lives in `packages/core` next to `order-state-machine.ts`; illegal transitions rejected, full matrix table-tested.

**Concurrency patterns in force:** order-row `FOR UPDATE` serializes webhook vs redirect vs sweep vs admin (§1.28.3, lock ordering always order → payment); webhook workers claim rows via conditional `UPDATE ... WHERE status IN ('received','failed')` (§1.28.4); all restocks idempotent via the ledger index (§1.28, stock lifecycle).

### 3. API Design

| Endpoint | Method / auth | Rate class | Summary | Endpoint-specific errors |
|---|---|---|---|---|
| `/api/checkout/verify` | POST · public | D (10/min/session) | Razorpay JS success handler: body `{razorpayOrderId, razorpayPaymentId, razorpaySignature}`. Verifies HMAC(`order_id\|payment_id`, key secret), amount-matches, converges via `confirmPayment()` → `{orderNumber, status:'confirmed'}` | 401 `SIGNATURE_INVALID`; 404 `NOT_FOUND` (unknown razorpayOrderId); 409 `ALREADY_PROCESSED` (idempotent — returns confirmed state, `meta.duplicate`); 502 `UPSTREAM_ERROR` |
| `/api/checkout/orders/[orderId]/retry-payment` | POST · guest-token \| customer | D | New `payments` row (`created`) + fresh Razorpay order for a `payment_failed` order (24h window) → `{razorpay: {...}}` | 404; 409 `CONFLICT` (already paid); 410 `GONE` (cancelled/expired); 502 `UPSTREAM_ERROR` |
| `/api/webhooks/razorpay` | POST · webhook (HMAC SHA256 of **raw body**, header `x-razorpay-signature`) | unlimited, signature-gated; per-IP flood guard | Persist-then-ack per Contract §2.6: raw body → verify → `INSERT webhook_events ON CONFLICT DO NOTHING` → `inngest.send` → 200 in < 2s. Handles `payment.captured/failed/authorized`, `refund.processed/failed`, `order.paid` | 401 `SIGNATURE_INVALID` (nothing persisted); 200 `{duplicate:true}` on conflict; 500 **only** if the insert fails (DB down — provider retry is recovery) |
| `/api/admin/orders/[id]/confirm-cod` | POST · admin:staff | E (600/min) | `{outcome:'confirmed'\|'cancelled', note?}` — the COD queue action; on confirm: order → `confirmed`, payment → `cod_pending_collection`; on cancel: restock + close | 422 `INVALID_TRANSITION` (not in `cod_pending_confirmation`) |
| `/api/admin/orders/[id]/refunds` | POST · **admin:owner** | E | `{amountPaise, reason, destination, payoutReference?, returnRequestId?}` → 201 `{refund}`. Prepaid: Razorpay refund keyed by our refund id (idempotent); COD: manual payout recorded with `payout_reference` | 422 `REFUND_EXCEEDS_PAID` (details: `{refundablePaise}` = captured − already refunded, per line); 409 `CONFLICT` (refund already in flight); 502 `UPSTREAM_ERROR` |
| Inngest cron: stuck-payment sweep | every 15–30 min | — | Polls Razorpay Orders API for orders `pending_payment` > 45 min (by `receipt` = idempotency key); settles truth from API, then expires (`cancelled`, restock) via the state machine | — |
| Inngest cron: nightly Razorpay reconciliation | nightly (IST day) | — | Lists captured payments (24h/7d) → match to orders by receipt; orphans → alert + auto-refund policy (config-gated, manual-only first month) | — |
| Inngest cron: COD remittance matching | nightly | — | Matches Shiprocket remittance report lines (AWB → order) → `cod_collected → cod_pending_remittance → cod_remitted` with `cod_remittance_ref`; flags `delivered + 14d` unremitted | — |
| Inngest job: COD unreachable expiry | scheduled per order | — | 3 contact attempts / 48h in `cod_pending_confirmation` → auto-cancel + restock + notification | — |

**Idempotency (all of it, explicitly):** Razorpay order create keyed by `receipt = idempotency_key` (on retry, query by receipt before creating anew); `webhook_events` UNIQUE gate; refund create keyed by our refund row id; `confirmPayment()` idempotent by construction; restocks via `inv_adj_once_per_cause_idx`.

**Webhook-before-redirect convergence (normative design).** The `payment.captured` webhook (fast) and the browser redirect to `/checkout/verify` (slow 3DS return) race. Both paths call ONE function, `confirmPayment(order, payment)`: take the order row `FOR UPDATE` → if already `confirmed`, no-op and return current state → else verify signature + assert `payment.amount == orders.total_paise` and currency INR → transition `pending_payment → confirmed`, payment → `captured`, write history → commit. First writer wins; second sees `confirmed` and renders success. Client-initiated confirmation is **provisional truth**: the 15–30 min sweep polling the Razorpay Orders API is the guarantee; the webhook is an accelerator. The staging-bake missed-webhook drill (kill webhook delivery, verify the sweep repairs state) exercises exactly this.

### 4. Frontend Requirements

**Pages/components powered:** Razorpay Checkout modal launch (from place-order response), payment-processing interstitial, order confirmation page, payment-failed retry screen, COD placement confirmation screen ("we'll call to confirm"), refund status lines on order detail/tracking.

- **Loading:** after Razorpay modal success, a "Confirming your payment…" interstitial polls order status (verify call in flight); never render success from the client-side Razorpay callback alone — wait for the server's `confirmed`.
- **Success:** confirmation page (order number, `accessToken`-gated for guests, 24h) showing snapshot totals; COD variant shows `cod_pending_confirmation` copy: "Order placed — we'll confirm by phone before dispatch."
- **Error:** `SIGNATURE_INVALID` / verify 502 → "We couldn't confirm your payment yet. If money was deducted, it will be confirmed automatically within 30 minutes or refunded." (the sweep's promise — never say "failed" when we don't know). `payment.failed` → payment-failed screen with a Retry Payment button (calls retry-payment, 24h window) and the failure reason if safe.
- **Empty:** confirmation page hit with expired/invalid `accessToken` → 410 `TOKEN_EXPIRED` screen routing to guest OTP order lookup, no order data leaked.
- **Partial-failure:** modal dismissed mid-payment → order sits `pending_payment` with a visible "complete payment" banner + countdown to the 30-min expiry; partial refund on an order → order detail shows per-refund rows with `initiated`/`processed`/`failed` states, "approved, processing" until `refund.processed` actually lands (never "refunded" early).

### 5. Admin Panel Requirements

- **COD confirmation queue** (Dev D): age-sorted `cod_pending_confirmation` list (fed by `orders_open_ops_idx`), row claiming ("handling" soft lock, visible assignee, 15-min auto-release), logged contact attempts (channel, timestamp, count), Confirm / Decline actions calling `confirm-cod`; attempt history prevents two staff calling the same customer. Queue depth and oldest-age surfaced on the dashboard (`pendingCodConfirmations` in `/api/admin/metrics/dashboard`).
- **Order payment panel:** all `payments` rows (attempts, method, status, Razorpay ids, failure reason), refund history, `raw_payload` viewer for debugging.
- **COD remittance view:** `cod_collected`/`cod_pending_remittance` orders with amounts owed, remittance batch refs, and the `cod_remittance_overdue` (>14d) flag list.
- **Webhook events ops view:** unfinished `webhook_events` (`received`/`failed`), retry/inspect actions.
- **Permissions:** COD confirm/decline = **staff**. Refund initiation = admin only; refunds above ₹5,000 (config) = **owner**; the refunds endpoint itself is owner-tier per the contract. All actions write `admin_audit_log`; staff cannot approve refunds for flagged serial-refund identities (owner review).

### 6. Edge Cases

1. **Webhook beats redirect** — both converge on idempotent `confirmPayment`; first writer transitions, second no-ops (design in §3 above).
2. **Redirect arrives, webhook never does** — client confirmation is provisional; the 15–30 min sweep polls Razorpay Orders API for anything still `pending_payment` and settles truth. Webhook = accelerator, sweep = guarantee.
3. **Duplicate webhook delivery (at-least-once, ~24h redelivery)** — `UNIQUE (provider, event_id)` insert is the gate; conflict → ack 200 immediately; handler must return 2xx < 5s or Razorpay counts it failed.
4. **Signature failure vs replay vs stale — distinguish all three:** (a) bad HMAC over raw bytes (`req.text()` before any `JSON.parse`) → 401, log `webhook.signature_failed` with source IP, alert on spikes; (b) valid sig + seen event id → benign, 200; (c) valid sig, old event for a terminal-state order → log `webhook.stale_event`, mark `skipped`, no-op.
5. **Orphan payment** — captured at Razorpay, no `confirmed` order (tx failure / permanent processing crash). Reconciliation matches captured payments to orders by receipt; unmatched → page-level alert + auto-refund after 24h unmatched (config-gated; manual-only for month one).
6. **Vercel timeout mid-Razorpay-order-create** — always send `receipt = idempotency_key`; on retry, query Razorpay by receipt before creating anew, so limbo rows are resolvable by the sweep.
7. **Amount mismatch** — webhook says ₹499, order total ₹549 (stale Razorpay order or attacker). `confirmPayment` MUST assert `payment.amount == total_paise` and currency INR; mismatch → hold + alert + manual review, never fulfil.
8. **User pays a stale Razorpay order after cancelling** — terminal-state order + captured payment → auto-refund path + log; never resurrect the cancelled order (stock may be gone).
9. **Partial refund of a partially shipped order** — refund is line-level: cancelled lines' tax-inclusive totals minus proportional coupon-discount allocation (consumes the Coupons allocation function), never `total − shipped_guess`; validated against `REFUND_EXCEEDS_PAID`.
10. **Refund after a GST rate change** — refund/credit note uses the **order-snapshot** `gst_rate_bp` from `order_items`, never the live rate. Tested explicitly.
11. **COD customer unreachable** — attempts logged (channel, count, timestamps); 3 attempts over 48h → auto-cancel with stock release + notification; queue age-sorts and shows attempt history.
12. **COD delivered but never remitted** — nightly job matches Shiprocket remittance (AWB → order); `delivered + 14d` without remittance → `cod_remittance_overdue` alert with amount owed. Untested reconciliation = silent revenue loss. RTO-closed COD orders are excluded from this alerting.
13. **Card-testing fraud (day-one threat)** — Razorpay fraud settings ON; 5 payment attempts/hour per IP and per phone/email on top of Class D; alert on payment-failure rate > 30% over 15 min; CAPTCHA escalation on repeated failures; failed attempts logged with IP/UA-hash fingerprints.

### 7. Testing Requirements

- **Unit (`packages/core`, ≥ 95% coverage — CI-gated):** HMAC signature verification over exact raw bytes (fixture with known key/body/signature + mutated-body negative case); payment state machine full matrix (prepaid + COD, legal and illegal transitions, table-driven); refund amount computation for line-level partials with coupon allocation and snapshot GST; amount-match assertion; COD confirmation-attempt policy (3-attempts/48h).
- **Integration (ephemeral Postgres + recorded webhook replay fixtures):** replay a `payment.captured` fixture twice → exactly one state change; deliver webhook before simulated redirect AND after → identical terminal state (order-independence proof); orphan-payment reconciliation against seeded Razorpay-API mock; amount-mismatch fixture → hold state; raw-body verification rejects re-serialized/whitespace-shifted bodies; concurrent sweep + webhook on one order → single winner via the order-row lock, no deadlock (lock ordering: order → payment).
- **E2E (Playwright, Razorpay test mode):**
  1. *Prepaid happy path with webhook race* — assert the order reaches `confirmed` exactly once whether webhook or redirect lands first (run twice with an artificial redirect-delay toggle).
  2. *Failed-then-retry payment* — Razorpay test failure card then success card on the same order: one order, one captured payment, no duplicate stock decrement.
  3. *Partial refund* — admin refunds 1 of 2 lines on a captured order; Razorpay test refund for the exact line amount incl. coupon share; payment → `partially_refunded`; customer email fired.
- Plus the staging-bake drills this module owns: webhook duplicate/out-of-order replay, and the missed-webhook reconciliation drill (§2.5 gate 4).

### 8. Production-Readiness & Definition of Done

- **Validation:** zod on webhook payloads **after** signature verification — malformed-but-signed payloads go to a dead-letter `failed_permanent` state, never a crash loop; refund requests validated against refundable balance (captured − already refunded, per line); `confirm-cod` outcome enum-validated.
- **Authz:** refunds owner-tier with the ₹5,000 threshold; COD confirm staff-tier; webhook routes authenticated by signature **only** — excluded from session middleware, never cached; negative tests for staff hitting the refunds route.
- **Rate limits:** Class D on verify/retry; card-testing limits (5 attempts/hr per IP and per identity) live **before launch**; webhook endpoint unlimited but per-IP flood-guarded (optionally allowlist Razorpay's published source IPs).
- **Logging (structured):** every webhook `{provider, event_id, event_type, order_id, amount, outcome: processed|duplicate|stale|sig_failed}`; every payment/refund transition; reconciliation runs `{orders_checked, orphans_found, mismatches}`; COD attempt logs. Payment logs NEVER contain card data or full contact PII (hash identifiers).
- **Alerting:** stuck `pending_payment` > 30 min; **ANY orphan payment (page-level)**; signature-failure spike > 10/hour; refund `failed`; webhook processing lag > 10 min; payment failure rate > 30%/15 min (card-testing signal); COD remittance overdue; every cron pings its healthchecks.io dead-man switch.
- **Definition of Done:**
  - [ ] Raw-body HMAC verification with negative tests (mutated body, re-serialized body)
  - [ ] Persist-then-ack handler responding < 5s (target < 2s), 500 only on insert failure
  - [ ] Dedup proven by the double-replay integration test
  - [ ] `confirmPayment` convergence proven by the webhook-vs-redirect order-independence test
  - [ ] Stuck-payment sweep + nightly Razorpay reconciliation implemented AND alert-wired
  - [ ] Orphan-payment handling decided and coded (auto-refund config-gated)
  - [ ] Line-level refunds with coupon allocation + snapshot GST, `REFUND_EXCEEDS_PAID` enforced
  - [ ] Full COD lifecycle: OTP-verified placement → confirmation queue → `cod_collected` on delivery → remittance matching → overdue alerting
  - [ ] Card-testing rate limits + failure-rate alert live before launch
  - [ ] Bus-factor review rule enforced on every PR in this module
  - [ ] 3 E2E scenarios green in CI; staging-bake webhook and reconciliation drills passing

---

## §3.9 — Module: Coupons & Discounts

### 1. Purpose & Ownership

Percent or flat-amount discounts applied to the cart pre-checkout and redeemed atomically inside the order-placement transaction. The module has two halves with two owners:

- **Dev C (Payments & Checkout)** owns the redemption path: `applyCoupon`/`removeCoupon` server actions, coupon validation inside `/api/checkout/quote` and `/api/checkout/orders`, the atomic exhaustion counter (Contract §1.28.2), and the **discount allocation engine** in `packages/core` (largest-remainder paise allocation) that line-level refunds (Payments module) consume.
- **Dev D (Fulfillment & Admin)** owns the admin CRUD surface (`/api/admin/coupons`), which is **owner-gated** per Contract §2.9.
- **Dev B** reviews any change to the allocation math in `packages/core` (bus-factor rule: money-math PRs need Dev C + one of B/E).

**Phase 2 (Weeks 6–8)** — coupon redemption at checkout lands in Lane C's Phase 2 scope; coupons admin lands in Lane D's Phase 2 scope. The allocation function itself is contract-level `packages/core` code and its zod schemas exist from Phase 0.

Why it matters: discounts touch every money invariant in the system. A wrong paisa allocation breaks the `orders.total_paise` CHECK constraint, corrupts GST extraction on lines, and makes partial refunds unreconcilable.

### 2. Database Schema

| Table | Role | Key columns / constraints |
|---|---|---|
| `coupons` (Contract §1.12) | Rule definition | `code citext UNIQUE` (case-insensitive, 3–24 chars); `percent_bp` (1–10000) XOR `flat_paise` enforced by `CHECK (num_nonnulls(percent_bp, flat_paise) = 1)`; `max_discount_paise` (cap for percent coupons); `min_subtotal_paise`; `starts_at`/`ends_at` window; `usage_limit` (global) + `redemption_count` (the atomic counter); `per_customer_limit` (default 1); `first_order_only`; `is_active`; `created_by → admin_users` |
| `coupon_redemptions` (Contract §1.13) | Per-order audit + limit enforcement | `UNIQUE (coupon_id, order_id)`; `customer_id` nullable (guest), `contact_phone NOT NULL` — per-customer limits are checked against **phone** so they survive guest checkouts; `discount_paise` snapshot; index `(coupon_id, contact_phone)` |
| `carts.coupon_id` (Contract §1.10) | Pre-checkout attachment | `ON DELETE SET NULL`; revalidated at every quote and at placement — never trusted stale |
| `orders.coupon_id / coupon_code / discount_paise` (Contract §1.14) | **Snapshot** | `coupon_code` is text snapshot (survives coupon edits/soft-deletes, per snapshot register §1.29); `discount_paise` participates in the `total_paise` CHECK |

**Concurrency pattern (Contract §1.28.2, normative):** redemption is an atomic conditional increment inside the placement transaction —
`UPDATE coupons SET redemption_count = redemption_count + 1 WHERE id = $1 AND is_active AND (usage_limit IS NULL OR redemption_count < usage_limit) RETURNING id` — zero rows ⇒ 422 `COUPON_EXHAUSTED`, transaction aborts. A failed placement rolls the count back automatically; the `coupon_redemptions` row is inserted in the same tx. Never count-then-insert.

**State:** coupons have no state machine — only `is_active` + time window. Deletes are soft (`is_active = false`); `coupon_redemptions.coupon_id` is `ON DELETE RESTRICT` so audit rows can never orphan.

### 3. API Design

**Storefront (Dev C) — Server Actions, rate class B (60/min per session/cart-token) with a tighter apply-specific bucket (10/min/session + 30/hour/IP, per risk Module 5 #9):**

| Action | Auth | Request → Response | Errors |
|---|---|---|---|
| `applyCoupon({ code })` | public (cart cookie) / customer | code only — discount computed 100% server-side → `ApiResult<CartView>` with `coupon: { code, discountPaise }` | 422 `COUPON_INVALID` \| `COUPON_EXPIRED` \| `COUPON_MIN_NOT_MET` \| `COUPON_EXHAUSTED` \| `COUPON_LIMIT_REACHED` |
| `removeCoupon()` | public (cart cookie) / customer | → `ApiResult<CartView>` (coupon: null) | — |

Enumeration defense: the storefront UI renders one identical message for `COUPON_INVALID`/`COUPON_EXPIRED` when the caller has no session context to deserve specifics — no existence oracle (risk Module 5 #9). The distinct codes exist for logging and for legitimately-attached coupons detaching.

**Checkout integration (Dev C, rate class D — 10/min/session):**
- `POST /api/checkout/quote` accepts `couponCode?` and returns `CheckoutQuote.coupon` + `discountPaise`; re-validates every rule live. Errors: the five 422 coupon codes above.
- `POST /api/checkout/orders` (idempotent via `idempotencyKey UNIQUE`) re-validates the coupon and runs the §1.28.2 atomic increment inside the placement tx. Redemption is tied to the order idempotency key — a replayed placement (409 `DUPLICATE_REQUEST` → original 201 body) **cannot double-redeem**. Errors surface as the same 422 coupon codes; a mid-checkout exhaustion returns a clean re-priced quote path, not a 500.

**Admin (Dev D) — Route Handlers, rate class E (600/min per admin session), all owner-gated per Contract §2.9:**

| Method / route | Auth | Behavior | Errors |
|---|---|---|---|
| `GET /api/admin/coupons?q=&active=&page=` | admin:owner | list with `redemption_count`, window, limits | — |
| `POST /api/admin/coupons` | admin:owner | create; zod: code alphabet `[A-Z0-9-]`, percent ≤ 100%, `starts_at < ends_at`, XOR percent/flat | 409 `CONFLICT` (code taken) |
| `PATCH /api/admin/coupons/[id]` | admin:owner | edit rules; placed orders unaffected (snapshot) | 404 `NOT_FOUND` |
| `DELETE /api/admin/coupons/[id]` | admin:owner | soft: `is_active = false`; never 409 | 404 `NOT_FOUND` |

**Core exports (Dev C, `packages/core`):** `computeDiscount(coupon, lines)` and `allocateDiscount(discountPaise, lines)` — pure functions, zod-typed, consumed by quote, placement, and refund paths.

### 4. Frontend Requirements

**Powered surfaces:** cart page + drawer coupon field, checkout review-step coupon row, order confirmation page discount line, account order-detail discount line, admin coupons pages (§5).

- **Loading:** apply button shows inline spinner, field disabled; totals show a subtle skeleton on the discount row while the action is in flight. No optimistic discount — never display a discount the server hasn't confirmed.
- **Empty:** collapsed "Have a coupon?" disclosure; expanding reveals input + Apply. No coupon-suggestion list (no code disclosure surface).
- **Error:** inline message under the field, exact copy per code — `COUPON_MIN_NOT_MET` shows "Add ₹X more to use this code" (from `details`); `COUPON_EXHAUSTED` "This code has been fully redeemed"; `COUPON_LIMIT_REACHED` "You've already used this code"; `COUPON_INVALID`/`COUPON_EXPIRED` share the generic "This code isn't valid" on the public path. Field keeps the entered code for correction. 429 shows "Too many attempts — try again in a minute" with `Retry-After`.
- **Success:** green applied chip with code + "−₹X" on the totals block, remove (×) affordance; discount row appears in cart totals and again on the checkout review step, both from server `CartView`/`CheckoutQuote` — never client-computed.
- **Partial-failure / detach:** if a line removal drops the cart below `min_subtotal_paise`, next totals render shows the coupon auto-detached with a non-blocking notice: "Coupon KAKAO10 removed — order below ₹X minimum" (risk Module 5 #4). If placement returns a coupon 422 after quote succeeded (exhausted in the race window), the review step re-prices with an explicit acknowledgment before the user can place without the discount — never silently charge full price (risk E2E #2).

### 5. Admin Panel Requirements

- **List view (owner only):** code, description, type (percent/flat), value, window (rendered IST), `redemption_count / usage_limit`, per-customer limit, active flag. Filter by active/expired; search by code.
- **Create/edit form:** all `coupons` columns; zod-mirrored client validation; percent coupons require `max_discount_paise` prompt (warn if absent); IST date-pickers converted to UTC server-side.
- **Detail view:** redemption list from `coupon_redemptions` (order number, phone masked to last 4, discount_paise, timestamp) — the audit surface for abuse review.
- **Permissions:** the entire CRUD surface is **owner** per Contract §2.9 — staff get read access to the list (for support lookups) but every mutation route rejects staff with 403 `FORBIDDEN`. Additionally, creating coupons > 50% off or > ₹1,000 flat is owner-only policy (risk Module 5 checklist) — trivially satisfied since all CRUD is owner, but the zod schema still flags these as "high-value" for the audit log. Every mutation writes `admin_audit_log` (`coupon.create/update/deactivate`, before/after).
- **Deactivate** is the delete: `is_active = false`; historical orders keep their `coupon_code` snapshot and render unchanged.

### 6. Edge Cases

(From risk-engineering.md Module 5, adapted.)

1. **Last-redemption race.** Two checkouts hit `usage_limit`'s final slot concurrently. The §1.28.2 conditional UPDATE inside the placement tx guarantees exactly one wins; the loser gets 422 `COUPON_EXHAUSTED` and a clean re-price UX. Redemption releases automatically on placement rollback; payment-expiry cancellation restores it via the same sweep that restocks inventory.
2. **Per-customer limit bypass via guest checkout.** Redeem logged-in, then again as guest with the same phone: `coupon_redemptions.contact_phone` is checked for **both** guest and account orders (index `(coupon_id, contact_phone)`), so limits survive account-less checkouts. Determined multi-identity abuse (different phone) is accepted risk — logged for pattern review.
3. **Rounding paisa allocation (the sum invariant).** 10% off ₹1,111.00 (111,100 paise) = 11,110 paise, allocated across lines proportionally by line subtotal, **largest-remainder method, remainder paise to the largest line** — deterministic. Gift-wrap fees are excluded from the discount base. Property-tested invariant: `sum(line_discounts) == orders.discount_paise` exactly, always. Line-level refunds (Payments module) consume this allocation.
4. **Min-subtotal coupon + line removal.** ₹500-min coupon applied, user drops the cart to ₹450 — coupon auto-detaches with a notice at the next totals computation, and is re-validated at placement (client cannot pin a stale coupon). Never a checkout-time 500.
5. **Stacking.** One coupon per order at launch (`carts.coupon_id` is a single column — structurally enforced). Interplay rules (e.g. sale-item exclusions) are data flags, not code branches, when added.
6. **Coupon on an order later partially refunded.** Refunding one line refunds that line's allocated discount share; if the retained order value falls below the coupon's minimum, policy is **allow — no clawback** (decided, documented, tested).
7. **IST expiry boundary.** "Valid till 30 June" = 23:59:59.999 **IST**, evaluated server-side via `istDayToUtcRange()` in `packages/core/datetime`. Coupon applied 11:58 PM IST, order placed 12:02 AM: validity is checked at apply AND at placement — **placement is authoritative**. Boundary unit tests at ±1 second in IST.
8. **Case/whitespace/lookalike codes.** ` welcome10 ` normalizes to `WELCOME10` (`citext` + uppercase-trim in the action); creation alphabet restricted to `[A-Z0-9-]` so generated codes never contain ambiguous `O/0` pairs. Failed attempts logged (`code_hash`, ip, session) for abuse detection.
9. **Brute-force enumeration.** Code spray at `applyCoupon`: 10 attempts/min/session + 30/hour/IP; identical public error for not-exists vs expired vs not-eligible (no oracle); alert on miss-rate spike.
10. **100%-off → ₹0 payable.** Razorpay cannot create a 0-amount order. Zero-total orders skip payment and transition directly to `confirmed` via an explicit zero-payment path — logged, admin-visible, and rate-limited (free-order abuse vector).
11. **Coupon edited/deactivated after orders placed.** `orders.coupon_code` + `discount_paise` are snapshots (Contract §1.29); admin edits never rewrite placed orders, invoices, or refund math.

### 7. Testing Requirements

**Unit (`packages/core`, ≥ 95% — CI-gated):**
- `allocateDiscount` is a crown jewel: **property tests** (sum invariant `Σ line_discounts == discount_paise`, no negative line, deterministic remainder placement, order-independence of input line ordering) plus fixture tests with hand-computed paise values including 1-paisa remainders across 3+ lines and gift-wrap-excluded bases.
- Eligibility matrix: min subtotal, `starts_at`/`ends_at` IST boundary (±1s), per-customer limit, `first_order_only`, percent cap via `max_discount_paise`, XOR percent/flat.
- Code normalization (case, whitespace, alphabet rejection).

**Integration (ephemeral Postgres, migrations applied):**
- Concurrent last-redemption: two parallel transactions race `usage_limit`; assert exactly one `coupon_redemptions` row and one discounted order.
- Redemption release on payment expiry (30-min sweep cancels a `pending_payment` order → `redemption_count` decremented / redemption row handling reversed alongside restock).
- Guest/account per-customer enforcement across phone match (redeem as account, retry as guest same phone → `COUPON_LIMIT_REACHED`).
- Apply → remove-line → auto-detach flow; placement re-validation rejects a stale pinned coupon.
- Idempotent placement replay does not double-increment `redemption_count`.
- Admin authz: staff mutation attempts on all four CRUD routes → 403 (part of the exhaustive admin authz checklist test).

**E2E (Playwright, named scenarios from risk Module 5):**
1. *Coupon + wrap rounding:* apply a 10% coupon to a 3-line cart with gift wrap on one line; assert on-screen totals == Razorpay charged amount == DB `orders.discount_paise`/`total_paise` to the paisa.
2. *Expired coupon UX:* apply a valid coupon, fast-forward validity via test fixture, attempt placement; assert clean re-price with notice and that the order proceeds without discount only after explicit user confirmation.
3. *Last redemption race:* two browser contexts race the final redemption; exactly one order carries the discount, the other sees the exhausted message and re-priced totals.

### 8. Production-Readiness & Definition of Done

- **Validation:** zod on creation (`code` alphabet `[A-Z0-9-]` 3–24 chars, `percent_bp ≤ 10000`, positive paise amounts, `starts_at < ends_at`, XOR percent/flat, `min_subtotal_paise ≥ 0`), `.strict()` — unknown keys rejected. `applyCoupon` accepts a code string only; every paisa of discount is computed server-side; client-sent amounts never trusted.
- **Authz:** CRUD = `admin:owner` only (route-level middleware + per-action assertion; staff 403 covered by the exhaustive authz checklist test). Redemption requires no auth beyond cart/session scope but limits key off verified phone at placement.
- **Rate limits:** apply endpoint 10/min/session + 30/hour/IP (enumeration class); admin routes class E; checkout paths class D. `X-RateLimit-*` headers + `Retry-After` on 429 per Contract §2.1.
- **SQLi/XSS:** Drizzle-parameterized lookups; coupon codes are user-echoed input — rendered encoded everywhere (storefront chip, admin list, order detail).
- **Idempotency:** redemption tied to `orders.idempotency_key` — replayed placement cannot double-redeem; admin deactivate is naturally idempotent.
- **Logging:** structured `coupon.applied/detached/redeemed/released {code, order_id, discount_paise, allocation}`; failed applies `{code_hash, ip, session}` (never log spray payloads raw); admin mutations to `admin_audit_log` with before/after.
- **Alerting:** redemption-velocity spike on a single code (leak to a coupon aggregator site); apply-endpoint miss-rate spike (enumeration in progress); any zero-total order created (each one reviewed while rare).

**Definition of Done:**
- [ ] `allocateDiscount` property-tested with the sum invariant; ≥ 95% coverage on eligibility + allocation, CI-gated
- [ ] Concurrent last-redemption integration test green (exactly one winner)
- [ ] Redemption release on payment expiry wired into the stuck-payment sweep and tested
- [ ] IST expiry boundary tests (±1s) green; placement-time validation authoritative
- [ ] Enumeration limits live (10/min/session, 30/hour/IP) with identical public error copy
- [ ] Per-customer limits enforced across guest + account via `contact_phone`, tested
- [ ] Refund integration: allocation consumed by line-level refund math (Payments module) with a shared fixture
- [ ] Admin CRUD owner-gated with staff-403 negative tests in the authz checklist; audit-log rows on every mutation
- [ ] `orders.coupon_code`/`discount_paise` snapshot behavior verified (edit coupon post-placement → order unchanged)
- [ ] Zero-total order path implemented, logged, and rate-limited
- [ ] All 3 E2E scenarios green in CI

---

## §3.10 — Module — Fulfillment & Shipping (Shiprocket, AWB/Label, Tracking, NDR/RTO, Serviceability)

### 1. Purpose & Ownership

Turns a `confirmed`/`packed` order into a delivered (or honestly RTO'd) parcel and keeps the customer and admin truthfully informed the whole way. Owns the Shiprocket integration end-to-end: order push, courier assignment, AWB, label/manifest, pickup scheduling, tracking sync (webhook + poller), NDR escalation, RTO closure with stock disposition, and pincode serviceability for checkout. Without this module, orders pile up in `confirmed` and the 20–30% COD RTO reality is invisible — which is the #1 unit-economics threat (§1 decision record).

- **Owning lane:** **Dev D** (Fulfillment & Admin) — owns `packages/integrations/src/shiprocket/**` (real client + in-repo mock + replay fixtures), fulfillment Inngest jobs, admin shipment views, RTO/NDR views, and the tracking data feed. Dev A consumes the tracking feed for the storefront tracking page; Dev E co-curates the Shiprocket fixture library and is second reviewer on webhook code.
- **Review rule:** any change to the `ShippingProvider` interface or mock fixtures requires Dev D approval; Inngest jobs that mutate order state fall under the bus-factor rule (Dev C + one of B/E).
- **Phase:** **Phase 2 (Weeks 6–8)** against the in-repo mock — full pipeline (AWB, pickup, label, tracking sync), COD/RTO/NDR views, tracking page. **Phase 3 (Week 9)** flips `FLAG_*` to the real Shiprocket client in staging: Shiprocket has **no sandbox** (verified), so a small number of real bookings are placed against a live account and cancelled, diffing behavior against the mock and fixing fixture divergence.

### 2. Database Schema

Owned tables (full DDL in Contract §1.19–§1.21):

| Table | Key columns | Constraints & indexes | Notes |
|---|---|---|---|
| `shipments` (§1.19) | `order_id`, `shiprocket_order_id`, `shiprocket_shipment_id`, `awb_code UNIQUE`, `courier_company_id`/`courier_name`, `label_url`/`manifest_url`, `status shipment_status DEFAULT 'pending'`, `cod`, `pickup_scheduled_at`, `expected_delivery_at`, `last_synced_at`, `superseded_at` | `shipments_one_active_idx` — **partial unique on `order_id WHERE superseded_at IS NULL`**: exactly one active shipment per order; reship after RTO/cancel supersedes the old row. `shipments_stale_poll_idx` — partial on `last_synced_at` over non-terminal statuses; this is the poller's scan set. | `awb_code` is the webhook correlation key. `expected_delivery_at` feeds the "Expected Jul 4" line in the timeline. `last_synced_at` is the reconciliation watermark. |
| `shipment_events` (§1.20) | `shipment_id`, `status shipment_status`, `sr_status_code` (raw SR code, e.g. `'17'`), `activity`, `location`, `occurred_at`, `source CHECK IN ('webhook','poll','manual')`, `raw jsonb` | **`UNIQUE (shipment_id, status, occurred_at)`** — natural-key dedup so retried webhooks and poll overlap never double-insert. `shipment_events_shipment_idx (shipment_id, occurred_at)`. | Append-only courier scan log; renders the tracking timeline detail rows. |
| `webhook_events` (§1.21, shared with Payments) | `provider='shiprocket'`, `event_id`, `event_type` (SR status label), `payload jsonb` (raw body verbatim), `status webhook_status`, `attempts` | **`UNIQUE (provider, event_id)`** dedupe gate; `webhook_events_pending_idx` partial on `('received','failed')`. | Shiprocket sends no event id → **synthetic `event_id = sha256(awb \| current_status \| current_timestamp)`** computed from the payload (§2.6 step 3). |

Used (not owned):

- `orders` (§1.14) — this module drives the shipping leg of the order state machine (§1.27): `packed→shipped→out_for_delivery→delivered`, `shipped|out_for_delivery→rto_initiated`, `rto_initiated→out_for_delivery` (NDR re-attempt), `rto_initiated→rto_delivered`. Every transition takes `SELECT ... FOR UPDATE` on the order row (§1.28.3) — this serializes webhook vs poller vs admin races. Sets `shipped_at`/`delivered_at`/`rto_delivered_at`.
- `order_status_history` (§1.16) — one append-only row per transition with `actor_type` (`webhook`/`system`/`admin`).
- `inventory_adjustments` (§1.22) — RTO restock writes reason `rto_restock` guarded by `inv_adj_once_per_cause_idx` (partial unique on `(order_id, variant_id, reason)`) so a replayed webhook can never restock twice. Heat-sensitive destroyed stock is written as `damage_writeoff` with a note referencing the shipment (disposition policy in §6.7).
- `payments` (§1.17) — COD payment flips to `cod_collected` on `delivered`; RTO ⇒ `failed` (excluded from remittance-overdue alerting).
- `product_variants` (§1.4) — `ship_weight_grams` + `length/breadth/height_cm` feed the push payload and volumetric weight.
- `store_settings` (§1.1) — `origin_pincode` for serviceability, seller details for labels. Shiprocket auth token + expiry cached as a `store_settings` row (`shiprocket_token`) — DB-cached, 240h lifecycle (§6.5).

**Snapshot columns:** none owned here — but shipments must never re-read `customer_addresses`; the push payload is built from `orders.shipping_address` jsonb snapshot (§1.29). **State machine:** `shipment_status` (12 values, §1.0) with **monotonic ordering** — out-of-order events must not regress state; stale events are recorded in `shipment_events` but skipped for transitions.

### 3. API Design

**Admin shipment endpoints** (Route Handlers, Contract §2.9, auth `admin:staff`, rate class **E** 600/min/admin-session):

| Method & route | Request → response | Endpoint-specific errors |
|---|---|---|
| `POST /api/admin/orders/[id]/shipments` | `{ courierCompanyId?: number }` (omit = SR-recommended courier) → `201 { shipment }`. One call = create SR order + assign AWB + generate label; **partial success is persisted with status `pending`** and resumed step-wise. | `409 CONFLICT` (active shipment exists — one-active partial unique); `422 INVALID_TRANSITION` (order not confirmed/packed); `502 UPSTREAM_ERROR` (SR error passthrough in `details`) |
| `GET /api/admin/shipments/[id]/label` | → `{ labelUrl }` (regenerates via SR if stale) | `502 UPSTREAM_ERROR` (regeneration fails); `404 NOT_FOUND` |
| `POST /api/admin/shipments/[id]/pickup` | `{ date?: string }` → `{ shipment }` with `pickup_scheduled_at` | `502 UPSTREAM_ERROR` |
| `POST /api/admin/shipments/[id]/cancel` | → `{ shipment }` (supersedes; order returns to `packed` for reship) | `422 INVALID_TRANSITION` (already picked up); `502 UPSTREAM_ERROR` |

**Idempotency:** shipment creation sends our `order_number` as the SR channel reference; before any create, an Inngest step queries SR by that reference; the create is a single `step.run` whose output persists the external ID, so job retries resume post-create rather than duplicating (risk Module 6 #1).

**Webhook** (Contract §2.6, auth tier `webhook`, unlimited rate but signature-gated):

- `POST /api/webhooks/shiprocket` — shared secret header `x-api-key` (configured in the SR panel). Exact persist-then-ack contract: raw body → verify secret (fail = `401 SIGNATURE_INVALID`, nothing persisted) → synthetic `event_id = sha256(awb|current_status|current_timestamp)` → `INSERT ... ON CONFLICT (provider, event_id) DO NOTHING` (conflict = `200 { duplicate: true }`) → `inngest.send('shiprocket/event.received')` → `200` in < 2s. `500` only if the insert itself fails.

**Serviceability** (Contract §2.5, `public`, rate class **A** 120/min/IP):

- `GET /api/shipping/serviceability?pincode=560001&cod=true` → `{ serviceable, codAvailable, options: [{ option, feePaise, etaDaysMin, etaDaysMax }] }`. Errors: `400 VALIDATION_ERROR` (bad pincode); `422 PINCODE_UNSERVICEABLE`; `502 UPSTREAM_ERROR` — UI falls back to "standard only, verified at dispatch". Results cached 24h per (pincode, cod) key; the checkout serviceability snapshot (courier, ETD, check timestamp) is retained for dispute forensics.

**Tracking read** (Contract §2.7, owned by this module's data, consumed by Dev A's page): `GET /api/orders/[orderNumber]/tracking` — auth `customer`-owner | Bearer `trackingToken` (30-min JWT from OTP lookup) | `?accessToken=` ≤24h post-placement → `{ order, timeline: TimelineStep[], shipment: { awb, courierName, expectedDeliveryAt } | null }`. Errors: `401 UNAUTHORIZED`; `404 NOT_FOUND`; `410 TOKEN_EXPIRED`. Never a bare-AWB lookup — no enumeration of customer addresses.

**Inngest jobs (not HTTP, but part of this module's contract):** `fulfillment/push-shipment` (step-wise: SR order → courier assign → AWB → label → pickup, per-step persisted state); `shiprocket/event.received` processor (claims `webhook_events` row via `UPDATE ... WHERE status IN ('received','failed')`, §1.28.4); **`shiprocket/poll-tracking` cron every 30 min** — polls SR `track/awb` for shipments matched by `shipments_stale_poll_idx` with `last_synced_at > 6h`; nightly full sweep of everything non-terminal; token-refresh job at ~9 days. Poller upserts events keyed by `(shipment_id, status, occurred_at)`.

### 4. Frontend Requirements

**Customer order tracking page** (`/account/track` + guest OTP lookup route; built by Dev A on Dev D's feed):

- **Loading:** skeleton of the 5-step timeline (placed → confirmed → packed → shipped → delivered) with shimmering step labels; order summary card skeleton.
- **Empty (pre-AWB):** timeline shows `placed`/`confirmed` done, remaining steps `future`; copy "Preparing shipment" — never a fake "shipped" (risk #9). No courier/AWB block yet.
- **Success:** timeline from `TimelineStep[]` (`done`/`active`/`future`, timestamps rendered IST via `formatIST()`), courier name + AWB, "Expected {date}" from `expected_delivery_at`, scan-level detail rows (activity + location) from `shipment_events` in a collapsible section. RTO branch renders `rto_initiated`/`rto_delivered` steps with honest copy ("Returning to seller") replacing the delivery steps.
- **Error:** `410 TOKEN_EXPIRED` → "link expired, verify again" with re-OTP CTA; `404` → generic "order not found" (no enumeration hints); `401` → OTP lookup form.
- **Partial-failure:** shipment exists but events are stale (`last_synced_at` old, poller behind): show the last known status with "Last updated {time IST}" — never invent progress. Serviceability `502` at checkout: "standard only, verified at dispatch" fallback banner.

**Checkout serviceability widget** (consumed by Dev C's checkout): pincode input → loading spinner inline → success shows delivery options with fees/ETA → `PINCODE_UNSERVICEABLE` shows blocking "We can't deliver to this pincode yet" at the **address step**, not at payment; `codAvailable: false` hides/disables the COD option with reason copy.

### 5. Admin Panel Requirements

- **Orders detail (fulfillment section):** current shipment (AWB, courier, status, label/manifest download links), full `shipment_events` log with source badges (webhook/poll/manual), superseded-shipment history. Actions: "Push to Shiprocket" (courier picker, default recommended), "Schedule pickup", "Regenerate label", "Cancel shipment" — buttons enabled strictly from `ORDER_TRANSITIONS` + shipment state; server rejection is the guarantee.
- **Fulfillment exceptions queue:** shipments stuck > 2h in an intermediate step (`pending`/`awb_assigned` without label, `pickup_scheduled` without `picked_up` in 24–48h), unknown-AWB events, poison webhook rows (`failed_permanent`). Each row has a retry action that resumes the step pipeline.
- **NDR queue:** NDR events with courier reason code, attempt count, customer-notification status; actions: request re-attempt / initiate RTO. 3 failed attempts auto-RTO.
- **RTO view:** in-flight RTOs and arrived ones awaiting QC; on `rto_delivered`, staff records disposition per line — restock (`rto_restock` ledger row) or destroy (`damage_writeoff`) per product heat-sensitivity; COD RTOs close with payment `failed` and feed the repeat-RTO phone signal used by COD eligibility.
- **Weight-dispute report:** declared vs SR-charged weight per shipment, weekly discrepancy report (margin leakage).
- **Permissions:** push/cancel/label/pickup/NDR actions = `admin:staff`. Owner-only: none in this module's mutations, but all actions write `admin_audit_log`; refunds triggered by RTO of prepaid orders route through the Refunds module's owner gate.

### 6. Edge Cases

(From risk-engineering.md Module 6, adapted.)

1. **Inngest retry duplicates SR order creation.** Job dies after SR accepted but before we persisted their ID → retry would create a second shipment (two labels, double courier charge). Every create sends `order_number` as channel reference; a preceding step queries SR by reference; create is one idempotent `step.run` persisting the external ID.
2. **AWB assigned, label generation fails mid-sequence.** Push → assign → AWB → label → pickup are discrete Inngest steps with per-step persisted state on the shipment row; resume from last completed step; stuck > 2h ⇒ exceptions queue. Never restart from step 1.
3. **Tracking event for an unknown AWB.** Persist to `webhook_events`, ack 200, log `tracking.unknown_awb`, alert if > 5/day. Never 500 — that trains undocumented SR retry behavior we can't reason about.
4. **Shiprocket webhook retries are undocumented → poller is primary.** Webhooks are best-effort accelerators. The 30-min poller over `shipments_stale_poll_idx` + nightly full sweep is the correctness guarantee. Status updates are **monotonic**: a late `out_for_delivery` after `delivered` is recorded in `shipment_events` but never regresses the order.
5. **240h bearer token expiry mid-flight.** Token cached in `store_settings`, scheduled refresh at ~9 days; dead-man alert on token age > 9 days; SR client wraps every call with 401 → auto-refresh-and-retry-once; concurrent refreshes serialized via `UPDATE ... WHERE token_expires_at < $x` guard.
6. **NDR handling.** NDR detected (poll/webhook) → order surfaces in NDR queue with courier reason code → customer notified (SMS/WhatsApp "delivery attempted — reattempt?") → admin reattempt/RTO actions → 3 failed attempts auto-RTO. Every NDR event persisted.
7. **RTO stock disposition (20–30% of COD).** On `rto_delivered`: QC inspection; perishable chocolate defaults to **destroy** (`damage_writeoff`) for heat-sensitive products, `rto_restock` otherwise — per-product flag decides, ledger row idempotent via `inv_adj_once_per_cause_idx`. COD closes with payment `failed`, excluded from remittance-overdue alerts; repeat-RTO phones feed COD eligibility.
8. **Weight/dimension dispute.** SR bills volumetric; courier reweighs and charges more. Persist declared vs charged weight per shipment; weekly discrepancy report.
9. **Pickup scheduled, courier never arrives.** `pickup_scheduled` with no `picked_up` scan within 24–48h SLA: auto-reschedule once, then exceptions queue. Customer sees "preparing shipment", never a fake "shipped".
10. **Pincode serviceable at checkout, delisted at fulfillment.** 24h-cached serviceability said yes; courier delisted the pincode by push time. SR push fails → exceptions queue with options (alternate courier / refund / hold); serviceability snapshot on the order supports the dispute.
11. **No sandbox: mock drift.** In-repo mock + replay fixtures recorded from real traffic, dated + versioned. Post-launch weekly contract-check job hits real read-only endpoints (serviceability, tracking of a known shipment) and diffs response shape against fixture schemas; drift alerts.
12. **Multi-warehouse readiness.** Launch is single pickup location, but the shipment model carries `pickup_location_id` from day one — retrofitting later touches every fulfillment query.

### 7. Testing Requirements

- **Unit (`packages/core` / integration package):** shipment state machine including monotonicity (table-driven out-of-order event tests); NDR escalation counter (3 attempts → RTO); RTO disposition policy by heat-sensitivity flag; volumetric weight calculation; token expiry/refresh decision logic; SR status-code → `shipment_status` mapping table (every known SR code, unknown code → logged + skipped). Order-transition entries this module drives are covered by the state-machine suite's 100% branch-coverage gate.
- **Integration (against the in-repo Shiprocket mock, ephemeral Postgres):** full push sequence with injected failure at **each** step, asserting resume-not-duplicate for every step; duplicate-create prevention (mock returns "already exists" on second create with same reference); tracking replay fixtures including out-of-order and unknown-AWB payloads; synthetic `event_id` dedup (same payload twice → one `webhook_events` row, one `shipment_events` row); 401-mid-call auto-refresh path; **webhook-silence test** — poller alone transitions a stale shipment through to `delivered` with zero webhooks (this is the core correctness path, tested as such); RTO restock idempotency against `inv_adj_once_per_cause_idx`.
- **E2E (Playwright, named scenarios from risk Module 6):**
  1. *Fulfillment happy path:* paid order → admin "push to Shiprocket" (mock) → AWB + label URL appear → customer tracking page shows courier + AWB → mock emits transit events → tracking page updates through `delivered`.
  2. *Label failure recovery:* mock fails the label step; shipment sits `awb_assigned` in the exceptions queue; admin retries; label appears; mock call log shows no duplicate SR order.
  3. *NDR to RTO:* mock emits NDR ×3; order auto-flips to `rto_initiated`; COD order closes at `rto_delivered` with payment `failed`; stock adjustment row with destroy disposition recorded.

### 8. Production-Readiness & Definition of Done

- **Validation:** zod on **all Shiprocket responses at the client boundary** (their API shape-shifts; parse failures land in the exceptions queue, never crash deep inside jobs); push payloads (address, weights, dims) validated before the external call; pincode `^[1-9][0-9]{5}$` plus dataset check.
- **Authz:** push/cancel/label/pickup = `admin:staff` with per-route middleware; tracking page requires customer session, trackingToken, or ≤24h `access_token` — no bare-AWB access; webhook route signature-gated only, excluded from session middleware, never cached.
- **Rate limits:** serviceability class A (120/min/IP); admin routes class E; webhook unlimited but secret-gated; poller self-throttles against SR limits (batching, backoff on 429).
- **Idempotency:** SR create keyed by channel reference + step-persisted external IDs; webhook dedup via synthetic `event_id` UNIQUE gate; event upserts keyed `(shipment_id, status, occurred_at)`; RTO/restock ledger idempotent by partial unique index.
- **Logging:** every SR call `{ endpoint, our_order_id, sr_order_id, awb, status_code, latency_ms }`; every shipment/order transition; token refreshes `{ old_expiry, new_expiry }`; poller runs `{ shipments_polled, transitions, errors }`; `tracking.unknown_awb`.
- **Alerting:** **token age > 9 days = page-level (everything downstream dies)**; shipment stuck non-terminal > 48h without an event; poller failure ×2 consecutive (cron pings healthchecks.io dead-man switch); unknown-AWB spike (> 5/day); exceptions queue depth > 10; SR 5xx rate; webhook processing lag > 10 min.
- **Definition of Done:**
  - [ ] Step-wise idempotent push pipeline with failure-injection tests passing for every step
  - [ ] Poller-as-primary proven by the webhook-silence integration test
  - [ ] Monotonic status enforcement with out-of-order table tests
  - [ ] NDR queue + auto-RTO after 3 attempts; RTO disposition (restock/destroy) writing idempotent ledger rows
  - [ ] Token refresh job + dead-man age alert live
  - [ ] In-repo mock + replay fixtures dated/versioned; weekly contract-check job specced for post-launch
  - [ ] Tracking page token-protected (customer / trackingToken / 24h accessToken), no AWB enumeration
  - [ ] Serviceability cached 24h with checkout snapshot persisted on the order
  - [ ] Real-Shiprocket staging proof (Phase 3): live bookings placed and cancelled, mock divergence fixed
  - [ ] All alerts wired and routed; 3 E2E scenarios green in CI

---

## §3.11 — Module: Reviews (post-purchase, moderated)

### 1. Purpose & Ownership

Verified-purchase product reviews with moderation-first publishing. Reviews are the storefront's social proof (PDP stars, review lists, `AggregateRating` JSON-LD for SEO) and a merchandising input (`sort=rating` on the shop grid) — but only if the numbers are trustworthy. Trust comes from three enforced properties: (1) **proof of purchase** — a review can only be written against a *delivered* order item the customer actually bought (`reviews.order_item_id UNIQUE` is simultaneously the eligibility link and the one-review-per-purchase constraint); (2) **moderation-first** — nothing renders publicly until an admin approves it; (3) **aggregate integrity** — `products.rating_avg/rating_count` are recomputed transactionally on every moderation verdict and audited nightly.

- **Owning lanes:** Dev D (moderation queue, admin API, post-purchase review trigger/email) + Dev A (PDP review display, review form UI, JSON-LD). Dev B owns the `reviews` table migration and the zod contracts per the schema-ownership rule.
- **Phase:** Phase 2 (W6–8), riding the cross-lane chain from §2.2: reviews schema (B) → post-purchase trigger (D) → moderation (D) → PDP display (A). Eligibility depends on the `delivered` order state, so this module cannot land before the fulfillment pipeline emits real delivery transitions — hence Phase 2, not Phase 1.
- **Feature flag:** `reviews_visible` in the DB `flags` table (per §2.4) gates public rendering; submission and moderation ship dark first.

### 2. Database Schema

| Table | Role for this module | Key points |
|---|---|---|
| `reviews` (Contract §1.23) — **owned** | The review rows | `order_item_id uuid NOT NULL UNIQUE REFERENCES order_items(id)` — proof of purchase + dedupe in one constraint. `rating` CHECK 1–5; `title` ≤120 chars; `body` CHECK 10–2000 chars; `status review_status DEFAULT 'pending'`; `moderated_by → admin_users`, `moderated_at`, `moderation_note`. `product_id` (CASCADE) and `customer_id` (CASCADE) denormalize the join path. Indexes: `reviews_product_approved_idx` — partial `(product_id, created_at DESC) WHERE status='approved'` (the PDP only ever reads approved); `reviews_moderation_queue_idx` — partial `(created_at) WHERE status='pending'` (admin queue scan). |
| `products` (Contract §1.3) — **writes two columns** | Denormalized aggregates | `rating_avg numeric(3,2)` + `rating_count integer` per the snapshot register (Contract §1.29): recomputed from approved reviews **in the same transaction** as every approve/reject/edit, never incrementally patched. These feed `ProductCard.ratingAvg/ratingCount`, the `sort=rating` option, and JSON-LD. |
| `order_items` (Contract §1.15) — read-only | Eligibility anchor | `createReview` resolves `order_item_id → order_id` and requires the parent order `status='delivered'`. Snapshot columns (`product_name`, `image_url`) render the "review this item" prompt even after catalog edits. |
| `orders` (Contract §1.14) — read-only | Delivery gate | `status` + `delivered_at` checked server-side; RTO'd (`rto_delivered`) and undelivered orders are ineligible. |
| `customers` / `admin_users` — read-only | Author identity; moderator FK | Reviews require a `customer` session — guests must claim their order via OTP first (accounts module). |
| `admin_audit_log` (Contract §1.26) — writes | Moderation audit | Every moderate action appends `{admin_user_id, action:'review.moderate', entity_type:'review', before, after}`. |

**State machine:** `review_status` enum — `pending → approved`, `pending → rejected`, and (edit path) `approved|rejected → pending`. No other transitions; a second moderation attempt on an already-moderated row is a 409.

**Concurrency patterns:** moderation uses optimistic concurrency — the verdict `UPDATE` carries `WHERE id=$1 AND status='pending'`; zero rows ⇒ 409 `CONFLICT` ("already moderated") so two admins can't double-decide. The aggregate recompute (`UPDATE products SET rating_avg=…, rating_count=… FROM (SELECT avg(rating), count(*) FROM reviews WHERE product_id=$1 AND status='approved') …`) runs inside that same transaction, so the counter can never observe a half-applied verdict.

### 3. API Design

Split per the Server-Actions-vs-Route-Handlers rule (Contract §2.1): customer submission is a Server Action; public reads and all admin moderation are Route Handlers.

| # | Endpoint / Action | Auth tier | Rate class | Request → Response | Endpoint-specific errors |
|---|---|---|---|---|---|
| 1 | `createReview(...)` — Server Action (Contract §2.8) | `customer` | B (60/min/session) + **3 submissions/day/customer** (module cap) | `{ orderItemId; rating: 1–5; title?; body }` → `ApiResult<{ review: ReviewOwnView }>` with `status:'pending'` | `NOT_FOUND` (order item doesn't exist or isn't yours — identical error, no ownership oracle); 422 `INVALID_TRANSITION` (order not `delivered`); 409 `CONFLICT` (order item already reviewed) |
| 2 | `createReview` on an already-reviewed item **by the same author with changed content** = edit path | `customer` | B | Same shape; overwrites rating/title/body and resets `status='pending'` (re-moderation) | 409 `CONFLICT` only when content is byte-identical (pure double-submit → return existing review, idempotent) |
| 3 | `GET /api/catalog/products/[slug]/reviews?page=&pageSize=10` (Contract §2.2) | `public` | A (120/min/IP) | → `{ reviews: ReviewPublic[]; summary: { avg; count; histogram: Record<1|2|3|4|5, number> } }`; `Cache-Control: s-maxage=60, stale-while-revalidate=300`; approved rows only, newest first via the partial index | 404 `NOT_FOUND` (unknown/inactive product slug) |
| 4 | `GET /api/admin/reviews?status=pending&page=` (Contract §2.9) | `admin:staff` | E (600/min) | → `{ reviews: AdminReviewRow[] }` — row includes body, author (name + masked phone), product, order number, submitted-at, prior-version flag for re-moderation | — (common codes only) |
| 5 | `POST /api/admin/reviews/[id]/moderate` (Contract §2.9) | `admin:staff` | E | `{ action: 'approve'|'reject'; note? }` → `{ review }`; recomputes `products.rating_avg/rating_count` in-transaction; writes `admin_audit_log` | 409 `CONFLICT` (already moderated — the optimistic guard); 404 `NOT_FOUND` |

**Idempotency:** submission is naturally idempotent via `order_item_id UNIQUE` (replay → 409 or edit semantics per row 2); moderation is idempotent via the `status='pending'` guard (replayed approve → 409, aggregates recomputed at most once per verdict). No client idempotency keys needed anywhere in this module.

**Not in v1 (do not build):** review photos, helpful votes, merchant replies, rich text.

### 4. Frontend Requirements

**Pages/components (Dev A):**
- **PDP "Reviews" tab** — summary block (avg stars with partial-fill per the design system, count, 5→1 histogram bars) + paginated review list (stars, title, body, reviewer first name + "Verified buyer", IST date via `formatIST`).
- **PDP/Shop star badges** — `ratingAvg/ratingCount` from `ProductCard` (denormalized columns; zero extra queries on grids).
- **`AggregateRating` + `Review` JSON-LD** on the PDP — emitted **only when `rating_count > 0`**, values sourced exclusively from the DB aggregate and approved rows.
- **Review form** — modal/inline from the account order-detail page ("Rate this item" per delivered line) and from the post-delivery email deep link. Star picker, optional title, body textarea with live 10–2000 char counter.
- **Account "My Reviews" view** — the customer's own reviews in all statuses.

**Required UI states:**
- **Loading:** reviews tab renders skeleton rows (3 ghost cards + ghost histogram); star badges on grids never skeleton — they arrive with the product payload.
- **Empty:** `count === 0` → "No reviews yet." plus, if the viewer has an eligible delivered item, a "Be the first to review" CTA; JSON-LD omitted entirely.
- **Error:** reviews GET failure degrades softly — tab shows "Couldn't load reviews" with a Retry button; the PDP itself never errors because of reviews (fetch is isolated, not awaited in the page's critical path).
- **Success (submit):** confirmation panel: "Thanks! Your review is pending moderation and will appear once approved." The pending review shows in *their* account view with a `Pending` chip — never on the public PDP.
- **Partial failure:** form submit returning `ApiErr` keeps the user's text intact and maps codes to inline messages — 409 `CONFLICT` → "You've already reviewed this item — edit your existing review" (link); 422 `INVALID_TRANSITION` → "You can review this once it's delivered"; `RATE_LIMITED` → "Daily review limit reached, try tomorrow." Edit-resubmit shows "Your updated review is pending re-approval; your previous review stays visible meanwhile."

### 5. Admin Panel Requirements

(Dev D, under `/api/admin/*` + `apps/web/app/(admin)`.)

- **Moderation queue** (default view = `status=pending`, oldest first, driven by `reviews_moderation_queue_idx`): each row shows full body/title rendered **encoded** (the moderation UI is itself a stored-XSS target — Risk M8 §C), rating, product link, order number, author name + masked phone, submitted-at (IST), a **re-moderation badge** when this is an edit of a previously approved review (with previous-version diff), and profanity-flag markers from the blocklist (flag-only, never auto-reject).
- **Actions:** Approve / Reject with optional `moderation_note` (shown to the author on rejection). Both write `admin_audit_log` and recompute aggregates in-transaction. A concurrent verdict surfaces the 409 as "Already moderated by {name} — refreshed" with the row's current state.
- **Filters:** status (pending/approved/rejected), product, rating, date range (IST days).
- **Dashboard tie-in:** `pendingReviews` count on `/api/admin/metrics/dashboard` (Contract §2.9) with a queue-depth warning ≥ 20.
- **Permissions:** moderation is **staff-level** (both roles) — it's daily ops, not a money or role surface. Owner-only: nothing in this module. Staff cannot edit review content — verdict + note only; review text is customer-authored, immutably.

### 6. Edge Cases

(From risk-engineering.md Module 8, adapted to contract names.)

1. **Non-purchaser spam:** eligibility is validated server-side — `order_item_id` must belong to the caller's `customer_id` and its order must be `delivered`. No client-supplied "verified buyer" flag exists anywhere in the contract.
2. **Review before delivery / RTO'd order:** order `shipped`/`out_for_delivery`/`rto_delivered` → 422 `INVALID_TRANSITION`. **Refunded-after-delivery keeps eligibility** (they tasted it) — decided, tested in the eligibility matrix.
3. **XSS in body/title:** plain text only; stored raw; output-encoded on PDP, account view, admin moderation UI, and sanitized before review-digest email interpolation; control characters stripped at the zod boundary.
4. **Duplicate double-submit:** `order_item_id UNIQUE` gate. Identical resubmit → idempotent return of the existing review; changed content → edit that re-enters `pending` (approved content can't be silently swapped for spam post-approval).
5. **Edit after approval:** edit → `status='pending'`; the previously approved version **stays live** until the re-moderation verdict (policy: stays live, documented) — the recompute on the eventual verdict uses the new rating.
6. **Moderation race (two admins):** `UPDATE … WHERE status='pending'`; loser gets 409 `CONFLICT` with the current state — never a double aggregate application.
7. **Review on archived product / product deletion:** products are soft-deleted only (`is_active=false`, §0 conventions), so reviews and aggregates survive archival; approved reviews still render if the archived PDP is served.
8. **Rating aggregate drift:** approve/reject/edit recompute transactionally; a **nightly Inngest integrity job** recomputes `rating_avg/rating_count` for all products from the `reviews` source rows and alerts on any mismatch (a drifted aggregate corrupts merchandising sort and SEO stars silently).
9. **Emoji/multilingual reviews:** Hindi/Hinglish/emoji must round-trip storage → PDP → admin → email; length validated in grapheme clusters; profanity blocklist (English + Hindi transliterations) **flags for moderation, never auto-rejects** (false positives on food words are common).
10. **Review-bomb burst:** one-review-per-order-item constraint + 3 reviews/day/customer velocity cap + moderation-default-off publishing; alert on per-product review-rate spike.
11. **Structured-data poisoning:** `AggregateRating` values come only from the DB aggregate over approved rows — never client-influenced, never including pending/rejected — or Google penalties follow.
12. **Enumeration via error shape:** "order item not yours" and "order item doesn't exist" both return `NOT_FOUND` with identical bodies.

### 7. Testing Requirements

- **Unit (`packages/core` + module logic):** eligibility matrix (delivered / shipped / RTO'd / refunded-after-delivery / foreign order item / already reviewed) — table-driven; aggregate recompute function (fixtures incl. all-rejected → avg 0/count 0, rounding to `numeric(3,2)`); grapheme-cluster length validation; profanity flagger with false-positive food-term fixtures; zod schema for `createReview` (rating bounds, body 10–2000, no URLs in body — link-spam filter).
- **Integration (ephemeral Postgres):** non-purchaser POST → `NOT_FOUND`; undelivered order → 422 `INVALID_TRANSITION`; duplicate submit → edit-and-remoderate semantics; concurrent approve/reject race → exactly one wins, other 409; aggregate correctness asserted after every transition (approve, reject, edit-of-approved, re-approve); XSS fixture stored and returned raw via the API (encoding is render-side — assert the API doesn't double-encode); public reviews GET returns only approved rows and correct histogram; nightly integrity job detects a manually corrupted aggregate.
- **E2E (Playwright, the 3 named scenarios from Risk M8):**
  1. *Post-purchase review flow:* delivered order (mock fulfillment) → account prompts review → 4-star Hindi + emoji submission → admin moderation queue → approve → PDP shows the review, updated star aggregate, and JSON-LD.
  2. *Non-purchaser block:* fresh account, no orders → review UI absent AND direct action invocation rejected.
  3. *Moderation rejection:* spam-link review submitted → rejected → never appears on PDP → author sees "not published" status in their account view.

### 8. Production-Readiness & Definition of Done

- **Validation:** zod on `createReview` (rating int 1–5, title ≤120, body 10–2000 graphemes, control chars stripped, URL/link-spam rejection at launch); `.strict()` — unknown keys rejected; moderation payload restricted to `action ∈ {approve, reject}` + note ≤500.
- **Authz:** submit = authenticated customer + server-verified eligibility (ownership via `order_items → orders.customer_id` join); public GET exposes approved only, with author name truncated to first name + initial (no phone/email ever in `ReviewPublic`); moderation = `admin:staff`; authors can read **own** pending/rejected reviews only — forged-ID negative test required.
- **Rate limits:** Class B (60/min/session) on the action + 3 submissions/day/customer (DB-counted, like OTP limits); Class A on the public GET; Class E on admin routes.
- **Logging:** structured `review.submitted / approved / rejected / edited {review_id, product_id, customer_id (hashed), moderator_id, rating, requestId}`; every moderation verdict also lands in `admin_audit_log` with before/after.
- **Alerting:** moderation queue depth > 20 **or** oldest pending > 72h; per-product review-velocity spike; nightly aggregate-integrity job failure or any drift detected (page Dev D).
- **Definition of Done:**
  - [ ] Purchase-gating server-enforced, proven by the non-purchaser negative test (unit + integration + E2E #2)
  - [ ] Moderation-first publishing: no code path renders a non-approved review publicly (grep-able single read path via `reviews_product_approved_idx`)
  - [ ] Edit → re-moderation semantics implemented; previous approved version stays live until verdict
  - [ ] Aggregate recompute transactional on every verdict; nightly integrity job live and alert-wired
  - [ ] XSS fixtures tested on PDP **and** admin moderation surfaces; email templates sanitize review content
  - [ ] JSON-LD emitted from approved-only DB aggregates, omitted at zero reviews
  - [ ] Moderation race returns 409 (concurrency test green); `admin_audit_log` row on every verdict
  - [ ] Rate limits (B + daily cap) live with 429 + `Retry-After`
  - [ ] `reviews_visible` flag gates public rendering; removal ticket filed
  - [ ] All 3 E2E scenarios green in CI

---

## §3.12 — Returns & Refund Requests

> Phase 2 (W6–8) · Dev D (request flow, admin decisioning) + Dev C (refund execution) · Risk Module 9 · Contract §1.18, §1.25, §2.8, §2.9

### 1. Purpose & Ownership

Post-delivery remediation for a perishable product. Customers (logged-in or guest) file item-level return requests with photo evidence; admins approve/reject; approved requests resolve to a Razorpay refund, a manual bank/UPI payout (COD), or a replacement order. **Launch policy is perishable-first: refund/replace on photo evidence with NO physical return for quality issues** (`damaged_or_melted`, `quality_issue`) — reverse logistics on melted chocolate costs more than the product. Physical return + `mark-received` + restock exists only for `wrong_item`.

- **Dev D owns:** request creation flow (action + guest route), photo-upload signed URLs, admin returns queue, decision + mark-received endpoints, customer-facing status UI, notification emails.
- **Dev C owns:** refund execution (`POST /api/admin/orders/[id]/refunds`), Razorpay refund lifecycle (`refund.processed`/`refund.failed` webhooks + poll fallback), refundable-balance math, credit-note emission from order snapshots.
- **Dev B reviews** the `return_requests`/`refunds` migrations; the refund path falls under the **bus-factor rule** (two approvals: C + one of B/E).
- **Phase:** Phase 2 — sequenced after payment webhooks and the COD path, alongside "refunds (prepaid + COD-cancel)" in the Phase 2 build order. Blocked by: order state machine (`delivered` is the entry gate), payments ledger, Shiprocket delivery-scan events.

### 2. Database Schema

| Table | Ownership | Key columns / constraints |
|---|---|---|
| `return_requests` (Contract §1.25) | owns | `order_id` FK, `customer_id` nullable FK (**NULL = guest via OTP token**), `status return_status`, `reason return_reason`, `resolution return_resolution` (default `refund`), `comment` (≤1000 chars CHECK), `photo_urls text[]`, `decided_by`/`decided_at`/`decision_note`, `received_at`. **Partial unique** `return_requests_one_open_idx ON (order_id) WHERE status IN ('requested','approved','pickup_scheduled')` — one open request per order, enforced by the DB not the app. Queue index `return_requests_queue_idx ON (created_at) WHERE status = 'requested'`. |
| `return_request_items` (Contract §1.25) | owns | `return_request_id` FK CASCADE, `order_item_id` FK, `quantity > 0` CHECK, `UNIQUE (return_request_id, order_item_id)`. Item-level: refundable amounts come from `order_items` snapshot columns, never live prices. |
| `refunds` (Contract §1.18) | owns (execution: Dev C) | `order_id`, `payment_id`, `return_request_id` FK SET NULL (links request → money movement), `provider_refund_id` (`rfnd_xxx`, partial unique `refunds_provider_idx`), `destination refund_destination` (`original_method`\|`bank_transfer`\|`upi`), `amount_paise > 0`, `status refund_status` (`initiated → processed | failed`), `payout_reference` (UTR/UPI ref for manual COD payouts), `initiated_by` FK `admin_users`, `processed_at`. |
| `orders` / `order_items` (§1.14–1.15) | reads | Entry gate: order `delivered` (state machine §1.28 marks `delivered` returnable). **Snapshot columns are the money source:** per-line `{hsn, gst_rate_bps, tax_amount_paise, taxable_value_paise}` and tax-inclusive line totals — credit notes and refund math read these, never the live tax table. |
| `payments` (§1.17) | reads/updates (C) | `amount_refunded_paise <= amount_paise` CHECK is the ledger ceiling; refund drives payment state `captured → partially_refunded → refunded`. |
| `inventory_adjustments` (§1.21) | writes | `mark-received` with `restock: true` inserts reason `return_restock`, idempotent via `inv_adj_once_per_cause_idx` — double-click never restocks twice. |
| `shipment_events` (§1.20) | reads | Delivery-scan timestamp anchors the 7-day return window. |
| `webhook_events` (§1.22) | reads (C) | `refund.processed` / `refund.failed` dedup gate. |
| `admin_audit_log` (§1.26) | writes | Every decision, mark-received, and refund initiation logged with actor. |

**State machine (`return_status`):** `requested → approved | rejected | cancelled`; `approved → pickup_scheduled → received` (wrong_item only) or directly `→ refunded` (evidence-based); `refunded → closed`. Illegal transitions rejected with 422 `INVALID_TRANSITION`, same `SELECT ... FOR UPDATE → validate → UPDATE + side effects in one tx` pattern as orders (§1.28). **Concurrency:** the partial unique index is the double-request guard; refund creation revalidates against `payments.amount_refunded_paise` inside the tx (`REFUND_EXCEEDS_PAID` on breach); restock idempotency via the adjustments unique index.

### 3. API Design

Common failures (400 `VALIDATION_ERROR`, 401, 403, 429, 500) apply everywhere per §2.1; only endpoint-specific codes listed.

| # | Method / Action | Auth | Rate class | Request → Response | Specific errors / notes |
|---|---|---|---|---|---|
| 1 | `createReturnRequest` (Server Action, §2.8) | customer | B (60/min/session) + **3 open requests/user** | `{ orderNumber, items: {orderItemId, qty}[], reason, resolution: 'refund'\|'replacement', comment?, photoUrls[] }` → `{ returnRequest: ReturnRequestView }` | 422 `RETURN_WINDOW_CLOSED` (>7 days post-delivery-scan); 409 `CONFLICT` (open request exists — return existing request in `details`); 404 `NOT_FOUND` (not your order/item) |
| 2 | `POST /api/returns` | guest-token (Bearer trackingToken from OTP order lookup) | B | Guest variant of #1, same shape/errors | Same codes; `customer_id` stays NULL |
| 3 | `POST /api/uploads/return-photos` | customer \| guest-token | B + **10 uploads/hour/user** | `{ count }` → `{ uploads: { url, path }[] }` — signed Supabase Storage PUT URLs | Max 5 files, 5 MB, `image/*`; 400 `VALIDATION_ERROR` on count > 5. Server re-verifies magic bytes at request submission, not just at signing |
| 4 | `GET /api/account/returns` (§2.4) | customer | A | → `{ returns: ReturnRequestView[] }` | own requests only |
| 5 | `GET /api/admin/returns?status=&page=` | admin:staff | E (600/min) | → `{ returns: AdminReturnRow[] }` | queue sorted by `created_at` (queue index) |
| 6 | `POST /api/admin/returns/[id]/decision` | admin:staff (**owner** if amount > ₹2,000 or flagged identity) | E | `{ action: 'approve'\|'reject', note? }` → `{ returnRequest }` | 422 `INVALID_TRANSITION` (not in `requested`); 409 `CONFLICT` (concurrent decision — second writer loses). Approve validates refundable balance BEFORE transitioning |
| 7 | `POST /api/admin/returns/[id]/mark-received` | admin:staff | E | `{ restock: boolean }` → `{ returnRequest }` | 422 `INVALID_TRANSITION` (not `pickup_scheduled`); `restock ⇒` ledger `return_restock`, idempotent |
| 8 | `POST /api/admin/orders/[id]/refunds` (§2.9, Dev C) | **admin:owner** | E | `{ amountPaise, reason, destination, payoutReference?, returnRequestId? }` → 201 `{ refund }` | 422 `REFUND_EXCEEDS_PAID` (`details: { refundablePaise }`); 409 `CONFLICT` (refund already in flight); 502 `UPSTREAM_ERROR` (Razorpay). **Idempotent:** Razorpay refund keyed by our `refunds.id`; approve double-click ≠ double refund |

Refund status transitions (`initiated → processed/failed`) are driven by `refund.processed`/`refund.failed` webhooks through the §2.10 pipeline (persist-then-ack, `webhook_events` dedup) plus the reconciliation poll fallback — not by the admin response.

### 4. Frontend Requirements

**Pages/components (Dev D flow, Dev A ui-package primitives):** `/account/returns` (list + "Start a return" — carried from prototype), return-request form (order picker → item multi-select with qty steppers → reason select → resolution radio → photo dropzone → comment), guest entry point from the order-tracking page (post-OTP), request-detail status card.

| State | Behavior |
|---|---|
| Loading | Skeleton rows on `/account/returns`; form order-picker shows spinner while eligible orders load; photo tiles show per-file upload progress |
| Empty | "No returns yet" + link to orders; order picker with zero delivered-within-7-days orders explains WHY ("returns are available for 7 days after delivery") instead of an empty dropdown |
| Error | `RETURN_WINDOW_CLOSED` → clean policy explanation + support contact path, **not an error toast** (it's expected, not exceptional); `CONFLICT` → link to the existing open request; network failure → retry preserving all form state including uploaded photo paths |
| Success | Confirmation with request ID, expected review SLA, and status timeline (`requested → reviewed → refunded/replaced`); email fired |
| Partial failure | Photo upload: 2 of 3 files succeed → failed tile shows inline retry, form submits with successful uploads only after explicit user choice; oversize/wrong-type file rejected client-side pre-upload with the limit stated (≤5 files, ≤5 MB, images) |

Customer-facing status vocabulary hides internal states: `approved` + refund `initiated` renders **"Approved — refund processing"**; only `refund.processed` flips it to **"Refunded"** (never promise money that hasn't moved).

### 5. Admin Panel Requirements

- **Returns queue** (`/admin/returns`): filterable by status, oldest-first for `requested`; row = order number, customer, reason, resolution, item count, amount at stake, age, flagged-identity badge.
- **Detail view:** photo evidence (EXIF-stripped, served with `Content-Disposition: attachment` from the storage domain — never inline from app origin), item lines with per-line refundable balance (line total − already refunded, coupon-allocation-aware), order payment history, customer's prior return count.
- **Actions:** approve/reject with mandatory note on reject; approve branches by resolution — refund (opens amount pre-filled at refundable balance, capped) or replacement (live stock check inline; out-of-stock → refund fallback offered in the same dialog); mark-received + restock toggle for `wrong_item` physical returns; COD refunds capture destination (`bank_transfer`/`upi`) + validated payout details, payout executed manually by owner, `payout_reference` (UTR/UPI ref) recorded before the request can close.
- **Permissions:** staff may view everything, decide requests ≤ ₹2,000 for unflagged identities, and mark-received. **Owner-only:** refund execution (endpoint #8 is owner-tier per contract), decisions > ₹2,000, decisions on flagged serial-refunder identities (staff sees a locked "requires owner" state). Every action lands in `admin_audit_log` with `initiated_by`.

### 6. Edge Cases (Risk Module 9)

1. **Perishable return reality.** Melted/damaged chocolate is not restockable: refund/replace on photo evidence, no physical return for quality issues. No reverse-pickup flow is built for quality claims; replacement creates a **linked ₹0 order** through normal fulfillment (stock decrement, AWB, tracking included).
2. **Return window boundary.** 7-day window computed from the **delivery scan timestamp** (`shipment_events`), not order date; IST boundary tested. Delivered-timestamp missing (poll gap) → fall back to last event timestamp + flag for manual review — never block the customer on our data gap.
3. **Photo evidence abuse.** Server-side type/size validation by **magic bytes, not extension** (≤5 files, ≤5 MB, images); EXIF stripped before admin display (customer GPS = privacy leak); files served with `Content-Disposition` from a separate storage domain, never inline.
4. **Refund request on a COD order.** No captured payment to refund against — resolution is bank-transfer/UPI (owner-executed manual payout, recorded in `refunds` with `destination: bank_transfer|upi` + `payout_reference`) or replacement. UPI/IFSC fields format-validated, encrypted at rest, admin access audited.
5. **Duplicate/concurrent requests.** `return_requests_one_open_idx` partial unique blocks the second insert; the API returns 409 `CONFLICT` with the existing request so the UI can deep-link to it.
6. **Request on a partially refunded line.** Refundable = line total − already refunded, coupon-allocation-aware (largest-remainder allocation from Coupons #3); approval validates against `payments.amount_refunded_paise` ledger before creating the refund — 422 `REFUND_EXCEEDS_PAID` otherwise.
7. **GST credit-note correctness.** Refund approval emits a credit-note record mirroring the order's **snapshot** tax breakdown (`gst_rate_bps` at placement, per Payments #9 — a rate change between order and refund must not alter the note), with **gap-free sequential numbering per financial year via a DB sequence** (GST compliance).
8. **Razorpay refund fails after "approved".** `refund.failed` webhook/poll → request enters refund-failed-retry handling, admin alert fires, customer is NOT re-notified until resolved; customer-facing status stays "approved — processing" until `refund.processed`.
9. **Replacement out of stock.** Replacement path checks live stock at approval; if gone, refund fallback offered in the same flow — no dangling awaiting-replacement state without an escape transition.
10. **Serial refunders.** Refund-request rate tracked per identity (phone/email); ≥3 quality-claim refunds auto-flags for owner review — staff cannot approve flagged requests. Feeds the same risk store as COD RTO history.
11. **Guest request ownership.** Guest requests authenticate via OTP-issued tracking token only; `customer_id` NULL rows must still be enumerable-safe (request IDs are UUIDs, no sequential lookup, token scope checked per order).

### 7. Testing Requirements

- **Unit (`packages/core`):** window computation (delivery-scan anchor, 7-day IST boundary, missing-timestamp fallback); refundable-balance math (partial refunds + coupon allocation, property-tested against the `sum(line_refunds) ≤ captured − already_refunded` invariant); credit-note breakdown from snapshot columns incl. rate-change case; return state machine full transition matrix (`requested → approved/rejected/cancelled → pickup_scheduled → received → refunded → closed`, illegal transitions rejected). Coverage gate ≥ 90% on these modules; state machine transitions 100% branch.
- **Integration (real Postgres):** double-request blocked by the partial unique index (parallel tx test); refund-exceeds-balance rejected with `REFUND_EXCEEDS_PAID`; `refund.failed` webhook fixture drives retry state + alert; replacement order creation decrements stock and enters normal fulfillment; EXIF verified stripped on stored evidence; `mark-received` restock idempotent under double-submit (`inv_adj_once_per_cause_idx`); guest token scoping (token for order A cannot file against order B → 404).
- **E2E (Playwright, named in Risk Module 9):**
  1. *Quality refund with photo:* delivered order → "melted on arrival" + 2 photos → admin reviews evidence → approves → Razorpay test refund → customer status "Refunded" + email.
  2. *Replacement flow:* damage claim → replacement → linked ₹0 order visible in admin → mocked Shiprocket push → customer sees new tracking.
  3. *Out-of-window rejection:* request 5 days past the window → clean "window expired" UX (not an error) → support-contact path shown.

### 8. Production-Readiness & Definition of Done

- **Validation:** zod on every input — `reason`/`resolution` enums, comment ≤1000 chars, item quantities against ordered quantities, file constraints re-verified server-side (magic bytes); UPI/IFSC format validation for COD payout details.
- **Authz:** requests by order owner only (customer session or guest tracking token scoped to that order); decisions = admin; refund execution = **owner**; approvals > ₹2,000 or flagged identity = owner; photo evidence access = admin-only, audited.
- **Rate limits:** creation under Class B plus 3 open requests/user; photo-URL signing 10/hour/user; admin endpoints Class E. Standard `X-RateLimit-*` headers + `Retry-After` on 429.
- **SQLi/XSS:** comment and decision-note fields are stored-XSS targets on the **admin UI** — encode at render, test that surface with hostile fixtures; evidence never inline-served from app origin.
- **Idempotency:** refund execution keyed to `refunds.id` as the Razorpay idempotency reference (approve double-click ≠ double refund — proven by test); restock keyed via adjustments unique index; webhook dedup via `webhook_events`.
- **Logging:** `return.requested/approved/rejected/received {request_id, order_id, reason, resolution, amount_paise, actor}`; `refund.initiated/processed/failed {refund_id, order_id, destination, amount_paise, provider_refund_id, initiated_by}` — no card data, no payout account numbers in logs.
- **Alerting:** returns queue depth > 15 or oldest `requested` > 48h; any `refund.failed`; refund stuck `initiated` > 24h; flagged-identity request created; credit-note sequence gap detected (nightly integrity check).

**Definition of Done**

- [ ] `return_requests`/`return_request_items`/`refunds` migrated with partial unique + queue indexes; migration reviewed by Dev B
- [ ] Window enforcement from delivery scan with IST boundary + missing-timestamp fallback, unit-tested
- [ ] Photo pipeline: signed PUT URLs, magic-byte re-verification, EXIF stripping, off-origin serving — all tested
- [ ] Refundable-balance validation against the payments ledger; `REFUND_EXCEEDS_PAID` negative test green
- [ ] Refund idempotency proven by double-click test; `refund.failed` retry path + alert wired
- [ ] Credit notes emitted from order snapshots with gap-free FY sequence; rate-change test explicit
- [ ] COD manual payout flow with validated + encrypted payout details and mandatory `payout_reference`
- [ ] Replacement path creates linked ₹0 order with stock check + refund fallback
- [ ] Serial-refunder flagging live; staff lockout on flagged requests enforced server-side
- [ ] Admin actions in `admin_audit_log`; owner-tier gates verified by negative tests (staff attempting owner actions → 403 `FORBIDDEN`)
- [ ] 3 E2E scenarios green in CI; concurrent double-request integration test green

---

## §3.13 — Module: Transactional Emails & Notifications (Resend)

### 1. Purpose & Ownership

Every customer-visible promise the order lifecycle makes — "order placed", "we'll call to confirm", "shipped, track it here", "refund on its way" — is delivered by this module. It owns the `EmailProvider` implementation in `packages/integrations/src/resend/**`, every email template, the Inngest dispatch functions that turn `order_status_history` rows into sends, the email leg of OTP delivery (`otp_channel = 'email'`), and operational admin alert emails. It creates **no new tables**: the order state machine's append-only history is the trigger source, Inngest is the delivery engine, and idempotency rides on the history row identity.

Two invariants are non-negotiable and shape everything below:

1. **Email never blocks money.** Order placement, payment confirmation, and state transitions commit first; email dispatch is always an async Inngest side effect. Resend being down degrades communication, never commerce. (Sole exception: the synchronous OTP send inside `/api/auth/otp/request`, which returns 502 `UPSTREAM_ERROR` per Contract §2.4 because the user is actively waiting for a code.)
2. **Email is an XSS/injection sink.** Gift messages, customer names, and addresses are attacker-controlled input rendered into HTML sent to inboxes (risk doc, Cart #C and Checkout #4). Every interpolation is encoded; no template ever concatenates raw strings into HTML.

- **Owning lane:** **Dev D** (owns `packages/integrations/src/resend/**` and fulfillment/notification Inngest jobs per §2.1). Dev C reviews any email fired from payment/refund transitions (bus-factor adjacency); Dev E owns the Mailpit/capture harness in test environments.
- **Phase:** Phase 2 (Weeks 6–8), sequenced after payment webhooks and the COD queue exist — templates on fixtures can start Week 6; live wiring lands as each transition ships. OTP email templates are pulled earlier (Phase 1) because Dev B's auth needs them; D owns the template, B owns the calling endpoint.
- **Domain setup (SPF/DKIM/DMARC) is a Week 6 task, not a launch-week task** — DNS propagation and domain warm-up (per the §Phase-4 launch checklist) need lead time.

### 2. Database Schema

This module owns no tables. It reads and writes the following:

| Table | Role here | Key columns / constraints |
|---|---|---|
| `order_status_history` (Contract §1.16) | **The trigger source.** Every transition inserts exactly one append-only row; the transition code emits `order/status.changed { orderId, historyId, fromStatus, toStatus }` to Inngest in the same code path, and the email dispatcher maps `(to_status, payment_mode)` → template | `id` (the idempotency anchor for sends), `from_status`, `to_status`, `actor_type`, `created_at`. `osh_order_idx` supports per-order fan-out |
| `orders` (§1.14) | Read-only render source | `contact_email` (nullable — guests may be phone-only), `contact_phone`, `order_number`, `access_token` (tracking links), snapshot money columns (`total_paise`, fee columns), `shipping_address` jsonb snapshot, `payment_mode`, `coupon_code`. **Emails render exclusively from snapshot columns — never re-join catalog or settings** |
| `order_items` (§1.15) | Line rendering | Snapshotted `product_name`, `variant_name`, `unit_price_paise`, `quantity`, `gift_wrap`, **`gift_message` (encode on interpolation — the XSS sink)** |
| `shipments` (§1.19) | Shipped/OFD/delivered emails | `awb_code`, `courier_name`, `expected_delivery_at` — the tracking link is `/track` with `order_number` (guest path goes through OTP lookup, §2.7; the email never embeds a long-lived auth token beyond the 24h `access_token` window) |
| `refunds` (§1.18) | Refund emails | `status` (`initiated → processed|failed`), `amount_paise`, `destination`. "Refund processed" sends only on `processed` — driven by the `refund.processed` webhook processor, not by refund creation |
| `return_requests` (§1.25) | Return decision emails | `status` transitions `approved`/`rejected`/`received`/`refunded` each map to a template; `decision_note` rendered encoded |
| `otp_challenges` (§1.8) | OTP email channel | `channel='email'`, all four purposes (`customer_login`, `order_lookup`, `admin_login`; `cod_verification` is SMS-first). Rate limiting is authoritative in this table (Class C), not in this module |
| `store_settings` (§1.1) | Config | `support_email`, `support_phone` rendered in every footer; `seller_legal_name`/`seller_address`/`fssai_license_number` in the legal footer block; admin-alert recipient list stored as a `notification_recipients` key (owner-editable) |

**Idempotency pattern (the "sent-once" guarantee without a table):** each send is a single Inngest `step.run` whose step ID embeds the trigger identity — `email:{template}:{orderStatusHistoryId}` (or `email:{template}:{refundId}` / `{returnRequestId}` for non-order-status triggers). Inngest memoizes completed steps across retries, and the Resend API call additionally sends `Idempotency-Key: {template}:{historyId}` so a crash *after* Resend accepted but *before* the step output persisted cannot double-send (the Inngest-retries-external-calls rule, risk Module 11 #3). Because the order state machine is idempotent (webhook replays produce **no new** `order_status_history` row — duplicates are `skipped` per §1.28.4), a replayed webhook can never mint a second email trigger. `sent_at` and the Resend message ID live in the step output (visible in the Inngest dashboard) — deliberately no `notifications` table at launch; if send-audit queries become an ops need, adding one is an additive migration.

### 3. API Design

This module owns **no public HTTP endpoints**. Its surface is (a) the `EmailProvider` interface, (b) Inngest functions, (c) participation in one existing endpoint's error contract.

**`EmailProvider` (packages/integrations, interface fixed in Phase 0 per §2.2):**

```ts
send({ to, template, data, idempotencyKey }): Promise<{ providerMessageId: string }>
// throws typed EmailProviderError { retryable: boolean } — Inngest retries retryable, dead-letters the rest
```

Implementations: `resend` (prod/staging), `capture` (Mailpit locally, provider sandbox on previews — per the Environments Matrix; **preview/CI never sends real email**).

**Inngest functions (all triggered by events, all idempotent per §2 above):**

| Function | Trigger | Sends | Notes |
|---|---|---|---|
| `email/order-lifecycle` | `order/status.changed` | Maps `(toStatus, paymentMode)` → template: `confirmed` + prepaid → **order confirmation (paid)**; `cod_pending_confirmation` → **COD order placed** ("we'll call to confirm"); `cod_pending_confirmation → confirmed` → **COD confirmed**; `shipped` → **shipped + AWB/courier/tracking link**; `out_for_delivery` → **out for delivery**; `delivered` → **delivered + review ask** (review CTA links to account; only when `customer_id` is set — guests get delivery confirmation without the review CTA); `cancelled` → **cancellation** (copy varies by `from_status`: payment-expiry vs customer cancel vs COD-declined vs admin) | Skips silently (logged, not errored) when `contact_email IS NULL`; unmapped transitions (`packed`, RTO states, `payment_failed`, `pending_payment`) send nothing to the customer by design |
| `email/refund-lifecycle` | `refund/created`, `refund/processed` (from the Razorpay webhook processor) | **Refund initiated** ("approved, processing — 5–7 business days"); **refund processed** (amount, destination, UTR/`payout_reference` for manual COD payouts). `refund.failed` sends **no** customer email — it alerts admins; the customer keeps seeing "processing" until resolved (risk Module 9 #8) | Keyed by `refunds.id` + status |
| `email/return-decision` | `return/decided`, `return/received`, `return/refunded` | Approved (with next steps), rejected (with `decision_note`), received, refunded | Keyed by `return_request_id` + status |
| `email/admin-alerts` | Various ops events | New-order notification (config-toggleable), COD queue depth > 25 or oldest > 24h, low-stock **daily digest** (from `product_variants_low_stock_idx` — digest, never per-event), orphan payment found, `webhook_events` failed_permanent, refund failed | Recipients from `store_settings.notification_recipients`; **throttled**: identical alert key suppressed for 4h (alert storms otherwise bury the signal) |
| (called synchronously, not Inngest) `sendOtpEmail` | Inside `POST /api/auth/otp/request` and `/api/orders/lookup/request-otp` when `channel='email'`, and `POST /api/admin/auth/otp/request` (always email) | 6-digit code, 10-min TTL copy, purpose-specific subject | Class C rate limits enforced by the caller against `otp_challenges` (Contract §2.1); provider failure → caller returns 502 `UPSTREAM_ERROR`; the challenge row is still created, so the resend cooldown still applies (no free retry storm) |

**Endpoint error-contract participation:** `POST /api/auth/otp/request` — 502 `UPSTREAM_ERROR` when Resend is down (Contract §2.4). All async sends surface **no** API errors anywhere: failures live in Inngest retries → `onFailure` → admin alert.

**Explicitly not built at launch:** customer email preferences, marketing/newsletter sends (newsletter capture stores the address; campaigns are out of scope), a "resend email" admin endpoint — operational resend is an Inngest dashboard replay (documented in the runbook).

### 4. Frontend Requirements

The "frontend" here is twofold: the email templates themselves (React Email components in `packages/integrations/src/resend/templates/`, rendered server-side), and the storefront states that depend on email delivery.

**Templates (all of them):** order confirmation prepaid / COD-placed / COD-confirmed, shipped, out-for-delivery, delivered + review ask, cancellation (4 copy variants), refund initiated, refund processed, return approved/rejected/received/refunded, OTP (customer login, order lookup, admin login), admin alert (generic ops layout). Shared layout: KAKOA brand header, IST-formatted timestamps via `formatIST()` (a raw UTC timestamp in a customer email is a bug), paise rendered via `formatPaise()` (never float math), `support_email`/`support_phone` footer, seller legal identity + FSSAI license line (Legal Metrology consistency with invoices). Plain-text alternative part generated for every template (deliverability + accessibility).

**Required template states — concrete:**
- **Order confirmation:** full line-item table from `order_items` snapshots (name, variant, qty, unit price, gift-wrap fee), discount/shipping/COD-fee rows exactly matching the order's snapshot columns, gift message rendered in a quoted block **encoded**, delivery ETA, tracking CTA using `access_token` link (valid ≤24h) with fallback copy "or look up your order with your phone number".
- **Shipped:** AWB, courier name, expected delivery date, tracking CTA. If `expected_delivery_at IS NULL` (courier gave no ETD), omit the date line — never render "Expected: Invalid Date".
- **Delivered + review ask:** review CTA only for account holders; guest variant ends at delivery confirmation + return-window note ("7 days for damaged/quality issues").
- **Cancellation:** states *why* (expiry/customer/COD-declined/admin) and, for prepaid captured orders, "your refund of ₹X has been initiated automatically".

**Storefront UI states powered by this module:**
- **Loading:** OTP request in flight → button spinner + disabled resend; "Sending code to y•••@gmail.com".
- **Success:** "Code sent — check your inbox (and spam)" + 60s resend countdown (from `resendAfterSec`).
- **Error:** 502 `UPSTREAM_ERROR` on email OTP → "We couldn't send the email right now" + offer the SMS channel where a phone exists; 429 → countdown from `Retry-After`.
- **Empty:** email-less guest on the confirmation page → "Save this page — we couldn't email you a copy" banner with the order number prominent (their only artifact).
- **Partial-failure:** confirmation page renders from the order record regardless of email outcome — a Resend failure is invisible to the customer flow; the page, not the email, is the receipt of record.

### 5. Admin Panel Requirements

- **Send visibility:** the Inngest dashboard is the launch-scope send log (function runs show template, recipient hash, Resend message ID, outcome). The admin order detail (`/api/admin/orders/[id]`) shows the `order_status_history` timeline, which is a 1:1 proxy for which lifecycle emails were triggered. No bespoke email-log UI at launch — deliberate scope cut, revisit if support volume demands it.
- **Configuration (owner only):** `store_settings` keys — `notification_recipients` (admin alert list), `support_email`/`support_phone`, new-order-notification toggle. Staff can view, only `admin:owner` mutates (store_settings writes are owner-scoped; every change lands in `admin_audit_log`).
- **Admin alert emails received:** COD queue depth/age, low-stock daily digest, orphan payment (page-level), `failed_permanent` webhook, refund failed, remittance overdue — this module is the delivery channel for the alerting requirements other modules define.
- **Staff vs owner:** no staff-facing email controls exist; operational resend (Inngest replay) requires Inngest access, held by owner + Dev D per the runbook.

### 6. Edge Cases

1. **Gift-message XSS into the inbox** (risk Cart #C.4, Checkout #A4). `<img src=x onerror=...>` in a gift message must render inert in Gmail/Outlook. React Email components with no `dangerouslySetInnerHTML` anywhere in `templates/`; the XSS fixture corpus (gift messages, names, addresses, review bodies) runs against **rendered email HTML** in CI, not just web surfaces — this is the launch-gate checklist item "XSS fixtures passing on web, **email**, packing slip, and admin surfaces".
2. **Resend down / 5xx.** Lifecycle emails: Inngest retries with backoff, order flow untouched; retry budget exhausted → `onFailure` → admin alert, customer's page-based flow still works. OTP email: synchronous 502 `UPSTREAM_ERROR` to the caller, challenge row still created so Class C cooldowns hold. **No email path can ever roll back or delay an order transaction.**
3. **Inngest retry after Resend accepted** (risk Module 11 #3). Step crashed post-send, pre-persist → retry would re-send. Resend `Idempotency-Key` = `{template}:{historyId}` makes the second call a no-op; the send lives in one `step.run` whose output persists the message ID.
4. **Webhook replay / poll+webhook double transition.** Duplicate `payment.captured` or Shiprocket events are `skipped` by the state machine and write no history row ⇒ no event ⇒ no email. The email trigger's idempotency is inherited from transition idempotency — test the pair together, not separately.
5. **Courier skips the OFD scan** (`shipped → delivered` is legal, §1.27). The delivered email must not depend on the OFD email having been sent; each template renders self-contained from current order state. Conversely `rto_initiated → out_for_delivery` (NDR reattempt) may fire OFD **twice** legitimately — distinct history rows, distinct sends, correct behavior; copy is written to be safe on repeat ("your order is out for delivery today").
6. **Guest with no email.** `orders.contact_email` is nullable. Every lifecycle function checks and skips with a structured `email.skipped {reason:'no_email'}` log — never a crash, never a Resend call with an empty recipient. The confirmation page compensates (see §4 Empty state).
7. **"Refund processed" sent before money moved** (risk Module 9 #8). The processed email is driven only by the `refund.processed` webhook/poll outcome, never by refund-row creation; `refund.failed` re-notifies admins, not the customer. Customer copy stays "approved, processing" throughout a retry loop.
8. **Stale-payment capture after cancellation email** (risk Payments #13). Customer got the cancellation email, then completes the still-open Razorpay modal. The auto-refund path sends "refund initiated" — the system must never send a second order confirmation for a terminal order; the lifecycle map has no template for transitions *into* an already-terminal state because the state machine forbids them.
9. **OTP email enumeration.** `/api/auth/otp/request` returns generic 200 whether or not the customer exists (Contract §2.4); the email template and subject are identical for new vs existing identities, and the admin OTP endpoint sends only for active `admin_users` while still returning a generic 200 — the template can't leak what the API hides.
10. **Emoji / Hindi / RTL gift messages and names.** UTF-8 end to end, tested with the grapheme fixtures from Checkout #A4 (ZWJ emoji, Bengali + emoji mix) rendered into email HTML; subject lines with non-Latin names must MIME-encode correctly (library-handled, fixture-asserted).
11. **Deliverability cold start.** SPF, DKIM, DMARC (`p=none` with `rua` reporting at setup, tightened post-launch) configured on day one of Phase 2 — §1 stack decision. Staging sends from a separate subdomain identity so staging traffic never poisons the prod domain's reputation; launch checklist includes the domain warm-up line item and one end-to-end real-inbox verification per template.
12. **Alert-storm self-inflicted DoS.** A flash-sale burst or a poison webhook loop could generate hundreds of admin alert emails. Admin alerts are keyed and throttled (4h suppression per alert key), low-stock is a daily digest, and the per-function Inngest concurrency cap bounds the blast radius (risk Module 11 #11).
13. **Snapshot fidelity.** A price or fee change between placement and the shipped email must not alter any figure in any email — all money renders from `orders`/`order_items` snapshot columns (§1.29). A test asserts the confirmation email total equals `orders.total_paise` byte-for-byte after mutating the variant price post-placement.

### 7. Testing Requirements

- **Unit (templates + mapping, ≥ 90% on this module's pure code):**
  - `(toStatus, paymentMode) → template` map: table-driven over all 11 order statuses × both payment modes, asserting mapped/unmapped exactly as specified (unmapped statuses send nothing).
  - Template render snapshots for every template with the canonical fixture orders (one per order status, from `packages/core/src/fixtures`) — snapshot tests catch accidental copy/markup regressions.
  - **XSS fixture corpus rendered through every customer-facing template**: assert payloads appear entity-encoded in output HTML, zero active content. Grapheme/emoji/Hindi fixtures round-trip.
  - `formatPaise`/`formatIST` usage: a lint-level check (or test) that no template imports `Date.prototype.toLocaleString` directly or does arithmetic on money.
  - Missing-data branches: null `contact_email` (skip), null `expected_delivery_at` (line omitted), guest vs customer delivered-email variant.
- **Integration (ephemeral Postgres + capture provider + Inngest test harness):**
  - Transition an order `pending_payment → confirmed` → assert exactly one confirmation email captured; **replay the same `payment.captured` webhook fixture** → assert still exactly one (idempotency inherited from the state machine, tested end-to-end).
  - Crash injection: fail the step after the capture-provider accepted → Inngest retry → assert the idempotency key produced one logical send.
  - `refund.processed` fixture drives the processed email; `refund.failed` fixture drives an admin alert and **no** customer email.
  - OTP email path: provider-down mock → endpoint returns 502 `UPSTREAM_ERROR`, challenge row exists, cooldown enforced on the immediate retry.
  - Admin-alert throttle: emit the same alert key 5× in a minute → one email.
- **E2E (named scenarios):**
  1. **Golden-path email trail** (extends Checkout E2E #1 / staging-bake "prepaid happy path with full email trail"): guest prepaid order via Razorpay test mode → Mailpit shows order confirmation with correct paise totals and encoded gift message → admin advances through `packed → shipped` (mock Shiprocket) → shipped email with AWB → mock emits delivered → delivered email present, review-ask absent (guest).
  2. **Partial-refund email** (from Payments E2E #3): admin refunds 1 of 2 lines → customer receives "refund initiated" for the exact line amount including coupon share → simulated `refund.processed` → "refund processed" email; assert no "processed" email existed before the webhook fixture fired.
  3. **COD lifecycle emails**: COD order placed (COD-placed email) → staff confirms in the COD queue (COD-confirmed email) → staff declines a second seeded order (cancellation email with COD-declined copy) — asserts the queue actions drive the right templates.

### 8. Production-Readiness & Definition of Done

- **Validation:** template data parsed with zod schemas (one per template in `packages/core/src/contracts`) before render — a malformed event payload dead-letters with an alert instead of sending a half-rendered email; recipient addresses validated (citext-normalized) before the provider call.
- **Authz:** no public surface to protect; `store_settings` notification keys owner-only with audit rows; Inngest endpoint signing-key-verified (Module 11 baseline); capture provider hard-forced outside prod/staging via `packages/config` env validation (a preview build with a live Resend key **fails at boot**).
- **Rate limits:** OTP email sends governed by Class C (1/60s + 3/10min + 10/day per destination; 20/hr/IP) enforced against `otp_challenges` by the calling endpoints; admin alerts throttled 4h per key; Inngest concurrency cap on the send functions (≤ 10 concurrent) to respect Resend API limits.
- **Idempotency:** Inngest step memoization + Resend `Idempotency-Key` per send; trigger idempotency inherited from state-machine dedup — both layers tested (see §7).
- **Logging:** `email.sent {template, order_id?, resend_message_id, latency_ms}`, `email.skipped {template, reason}`, `email.failed {template, error, attempt}` — **recipient addresses hashed in logs, never raw** (PII rule); request ID propagated from the originating transition for cross-system tracing of one order's lifecycle.
- **Alerting:** Resend failure rate > 10% over 15 min; any send function `failed_permanent`; OTP-email delivery success < 90% over 1h (delivery problem = login/lookup problem = revenue problem); DMARC report anomalies reviewed weekly (runbook item); daily send volume anomaly (10× baseline = template loop bug or abuse).
- **Definition of Done:**
  - [ ] SPF + DKIM + DMARC verified on the sending domain; staging isolated on a subdomain identity; one real-inbox render check per template (Gmail + Outlook)
  - [ ] All templates render from snapshot columns only — post-placement price-change test green
  - [ ] XSS fixture corpus green against every customer-facing template's rendered HTML (launch-gate checklist item)
  - [ ] Status→template map table-tested over all 11 statuses × 2 payment modes
  - [ ] Webhook-replay-produces-one-email integration test green; crash-injection idempotency test green
  - [ ] Provider-down behavior proven: lifecycle async (order flow unaffected, retry + alert), OTP synchronous 502 with cooldown intact
  - [ ] Null-email guest skip path and guest/customer delivered-variant logic tested
  - [ ] Refund emails gated on `refund.processed`; `refund.failed` alerts admins only
  - [ ] Admin alert throttle + low-stock digest live; recipients owner-configurable via `store_settings` with audit
  - [ ] PII-hashed structured logging + Resend failure/OTP-delivery alerts wired
  - [ ] The 3 E2E scenarios green in CI against the capture provider

---

## §3.14 — Module: Admin Panel (dashboard, orders ops, COD queue, customers, staff roles)

### 1. Purpose & Ownership

The admin panel is how a 5-person team runs the business: catalog CRUD, the order-ops surface (transitions, COD confirmation, cancellations), the inventory ledger, customer management (incl. blocking serial-RTO abusers), staff accounts, and the metrics dashboard. It is the human side of every state machine — the server is always the arbiter; the UI only reflects and requests.

- **Owning lane:** **Dev D** (all of `apps/web/app/(admin)/**` and the `/api/admin/*` Route Handlers). **Dev B** co-owns admin auth (email OTP via the shared `otp_challenges` infra, `admin_sessions` lifecycle).
- **Phase assignment:** **Phase 1 (W3–5):** admin auth + staff roles → products/variants/inventory admin (unblocks real content entry). **Phase 2 (W6–8):** full ops — dashboard metrics, orders view, **COD confirmation queue** (launch gate #3), customers admin, coupons admin (CRUD only; redemption math is Dev C's), reviews moderation, RTO/NDR views.
- **Boundary rules:** storefront may not import admin (import-boundary lint); the entire admin API is Route Handlers (uniform, testable, curl-able — Contract §2.1); admin cookie `kakoa_admin` is path-scoped and separate from the storefront session.

### 2. Database Schema

Tables this module **owns** (Contract §1.26, §1.1):

| Table | Key columns / constraints | Notes |
|---|---|---|
| `admin_users` | `email citext UNIQUE`, `role admin_role ('owner'\|'staff')`, `is_active`, `last_login_at` | Passwordless. Deactivation, not deletion — audit rows keep the actor FK (`ON DELETE SET NULL`, never CASCADE). API enforces: cannot deactivate/demote the last active owner (422). |
| `admin_sessions` | `admin_user_id FK CASCADE`, `token_hash UNIQUE` (SHA-256, raw token only in the cookie), `expires_at`, `revoked_at`, `ip`, `user_agent` | **12h lifetime** (vs 30d customer sessions). Session store checked per request — revocation on role change/removal takes effect within one request, never JWT-only. |
| `admin_audit_log` | `admin_user_id FK SET NULL`, `action text` (`'order.transition'`, `'refund.initiate'`, `'product.update'`, …), `entity_type`, `entity_id`, `before jsonb`, `after jsonb`; index `(entity_type, entity_id, created_at DESC)` | **Append-only**: the app DB role gets no UPDATE/DELETE grants on this table. Every mutating admin action writes a row in the same transaction. |
| `store_settings` | `key text PK`, `value jsonb`, `updated_by FK admin_users` | Singleton config: fees, free-ship threshold, FSSAI/GSTIN/seller details, payment expiry. Owner-editable; orders snapshot fees so edits are never retroactive (Contract §1.29). |

Tables this module **uses** (read/write via their owning modules' invariants):

- `products`, `product_variants`, `product_images`, `categories` (Contract §1.2–1.5) — full CRUD. Soft deletes only (`is_active=false`); optimistic versioning via `updated_at` in the UPDATE's WHERE clause on all admin-editable entities — never last-write-wins on money-bearing fields.
- `product_variants.stock_quantity` + `inventory_adjustments` (Contract §1.4, §1.22) — manual adjustments are **relative deltas only** with reason codes; each writes a ledger row with `stock_after` in the same tx. The atomic guarded UPDATE (Contract §1.28.1 pattern) rejects negative results with 409.
- `orders`, `order_items`, `order_status_history` (Contract §1.14–1.16) — ops queue reads use the partial index `orders_open_ops_idx` (`cod_pending_confirmation`,`confirmed`,`packed`). All transitions go through `ORDER_TRANSITIONS` in `packages/core` under `SELECT ... FOR UPDATE` (Contract §1.27–1.28.3) — the same arbiter as webhooks, so admin/webhook races serialize.
- `payments`, `refunds` (Contract §1.17–1.18) — refund initiation (owner) validated against refundable balance.
- `customers` (Contract §1.6) — `is_blocked` toggle; PII reads audited.
- `coupons` (Contract §1.12) — CRUD only; DELETE = `is_active=false`.
- `reviews` (Contract §1.23) — moderation recomputes `products.rating_avg/rating_count` transactionally.
- `otp_challenges` (Contract §1.8) — purpose `admin_login`; DB rows are the rate-limit authority.
- **Snapshot rule:** admin edits to prices, GST rates, fees, and coupons apply to **future orders only** — placed orders hold snapshots (Contract §1.29). The UI states this explicitly on price/fee edit forms.

### 3. API Design

All Route Handlers under `/api/admin/*`, envelope per Contract §2.1, **rate class E (600/min per admin session)** except OTP (class C). Auth tier `admin:staff` unless marked **owner** (owner ⊇ staff). Common codes (400/401/403/429/500) omitted per contract convention.

**Auth (Dev B):**

| Endpoint | Auth | Notes / specific errors |
|---|---|---|
| `POST /api/admin/auth/otp/request` `{email}` | public, class C | Generic 200 even for unknown/inactive emails (no enumeration); 502 `UPSTREAM_ERROR` |
| `POST /api/admin/auth/otp/verify` `{challengeId, code}` | public | Sets `kakoa_admin` (12h); 401 `OTP_INCORRECT` (attemptsLeft), 410 `OTP_EXPIRED` |
| `POST /api/admin/auth/logout` | admin | Revokes session |

**Catalog:** `GET/POST /api/admin/products`, `GET/PATCH/DELETE /api/admin/products/[id]` (POST 409 `CONFLICT` slug taken; DELETE = soft archive); `POST .../[id]/variants` (409 sku taken), `PATCH/DELETE /api/admin/variants/[id]`; `POST /api/admin/products/[id]/images` (signed-URL flow), `PATCH` (reorder), `DELETE /api/admin/images/[id]`. All PATCHes carry the loaded `updatedAt`; stale → 409 `CONFLICT` with current entity in `details`.

**Inventory:** `GET /api/admin/inventory?lowStock=` · `POST /api/admin/inventory/adjust` `{variantId, delta, reason, note?}` — relative delta, 409 `CONFLICT` if it would go negative · `GET /api/admin/inventory/ledger?variantId=`. Idempotency: order-caused restocks are guarded by `inv_adj_once_per_cause_idx`, not this endpoint; manual adjusts are deliberate repeats.

**Orders & ops:**

| Endpoint | Notes / specific errors |
|---|---|
| `GET /api/admin/orders?status=&paymentMode=&q=&from=&to=&page=` | `q` matches order_number/phone/email; `from/to` are **IST calendar dates** converted via `istDayToUtcRange()` |
| `GET /api/admin/orders/[id]` | Full detail: items, payments, refunds, shipments+events, status history, return requests |
| `POST /api/admin/orders/[id]/transition` `{to, note?}` | Allowed-list from `ORDER_TRANSITIONS`; 422 `INVALID_TRANSITION` with `details.allowed: OrderStatus[]` |
| `POST /api/admin/orders/[id]/claim-cod` | **Additive, v1.1 minor bump per §3.4:** soft-claims a `cod_pending_confirmation` row (visible assignee, 15-min auto-release); 409 `CONFLICT` if actively claimed by another admin |
| `POST /api/admin/orders/[id]/confirm-cod` `{outcome: 'confirmed'\|'cancelled', note?}` | 422 `INVALID_TRANSITION` if not in `cod_pending_confirmation`; idempotent replay of same outcome returns current state |
| `POST /api/admin/orders/[id]/cancel` `{reason}` | Restock + auto-refund if captured; 422 `INVALID_TRANSITION` |

**Refunds (owner):** `POST /api/admin/orders/[id]/refunds` — 422 `REFUND_EXCEEDS_PAID` (`details.refundablePaise`), 409 `CONFLICT` (refund in flight), 502 `UPSTREAM_ERROR`. Idempotent via our refund id as the Razorpay reference.

**Returns:** `GET /api/admin/returns?status=` · `POST /api/admin/returns/[id]/decision` `{action, note?}` (422 not in `requested`) · `POST /api/admin/returns/[id]/mark-received` `{restock}` (restock ⇒ ledger `return_restock`, idempotent via `inv_adj_once_per_cause_idx`).

**Reviews:** `GET /api/admin/reviews?status=pending` · `POST /api/admin/reviews/[id]/moderate` `{action, note?}` — recomputes aggregates in-tx; 409 `CONFLICT` already moderated.

**Coupons (owner):** `GET/POST /api/admin/coupons`, `PATCH/DELETE /api/admin/coupons/[id]` — POST 409 code taken; DELETE = `is_active=false`.

**Customers:** `GET /api/admin/customers?q=` (orderCount, ltvPaise, rtoCount, isBlocked) · `GET /api/admin/customers/[id]` · `POST /api/admin/customers/[id]/block` `{blocked}`.

**Metrics:** `GET /api/admin/metrics/dashboard?from=&to=` — **IST calendar dates**, converted to UTC bounds server-side. Returns `revenuePaise {captured, codCollected, refunded}`, `orderCounts` per status, `aovPaise`, `codShare`, `rtoRate`, `pendingCodConfirmations`, `pendingReviews`, `openReturns`, `topProducts`, `lowStockCount`.

**Admin users (owner):** `GET/POST /api/admin/users`, `PATCH /api/admin/users/[id]` `{role?, isActive?, name?}` — **cannot deactivate or demote the last active owner → 422**; deactivation revokes sessions and auto-releases COD claims.

**Exports (owner, additive v1.1):** `GET /api/admin/orders/export?from=&to=` — CSV via short-lived signed URL, **rate limit 5/hour**, formula-injection guard (§8), every export audited with row count.

### 4. Frontend Requirements

Pages under `apps/web/app/(admin)/**`: login (OTP), dashboard, orders list + detail, **COD queue**, returns queue, reviews moderation queue, products list/edit, inventory + ledger, customers list/detail, coupons, staff settings, store settings.

**Component stack (decision 2026-07-02): shadcn/ui (new-york) + TanStack Table** — see §4.4. Every list view is a TanStack-powered shadcn `Table` (server-driven pagination/filter/sort); row actions via `DropdownMenu`; edit forms in `Sheet` side panels; destructive confirmations via `AlertDialog` exclusively; `Command` palette (⌘K) for admin quick-nav; status chips via shadcn `Badge` with enum-exhaustive variants. Themed to KAKOA tokens via CSS variables — no raw zinc/slate hexes in admin code.

Required UI states, concretely:

- **Loading:** table skeletons for all list views; dashboard metric cards show shimmer, never `₹0` placeholders (a shimmering zero and a real zero must be distinguishable).
- **Empty:** COD queue empty = "No pending confirmations 🎉" with last-cleared timestamp; orders list with filters = "No orders match" + one-click filter reset; ledger empty = "No adjustments yet" with the adjust CTA.
- **Error:** every 409 optimistic-version conflict renders "changed since you loaded it" with a **diff of before/after** and a reload action — never a silent overwrite. 422 `INVALID_TRANSITION` renders the `details.allowed` list ("this order is now `shipped`; allowed: …"). 502 on refunds/shipments shows the upstream message from `details` with a retry button.
- **Success:** mutations show a toast with the audit-relevant fact ("Stock +50 → 62", "Order KK-48210 → packed"); order detail re-fetches live state after any transition (webhooks may have moved it meanwhile).
- **Partial-failure:** bulk CSV import is all-or-nothing (one transaction) — on failure the UI shows the **per-row error report** (row number, field, message) with nothing applied; COD queue claim expiry shows "claim expired, re-claim to continue" rather than silently letting two staff dial the same customer.
- **Live-state discipline:** transition buttons are enabled from `ORDER_TRANSITIONS` (imported from `packages/core`, same map as the server) — UI enablement is UX, the server rejection is the guarantee.
- **Money display:** every paise value renders through `formatPaise()`; every timestamp through `formatIST()`.

### 5. Admin Panel Requirements

This module *is* the admin panel; the permission split (enforced per-route server-side, UI hiding is cosmetic):

| Capability | staff | owner |
|---|---|---|
| Catalog CRUD, inventory adjust, orders view/transition, COD queue, returns decisions, reviews moderation, customers view/block | ✅ | ✅ |
| Refund initiation (all refunds are owner per Contract §2.9) | ❌ | ✅ |
| Coupons CRUD | ❌ | ✅ |
| Staff management (invite/role/deactivate) | ❌ | ✅ (last-owner guard) |
| Store settings edit | ❌ | ✅ |
| CSV exports (PII) | ❌ | ✅, audited, 5/hour |
| "Log out all sessions" panic button | own only | all admins |

Owner receives email notification on: role changes, any new admin login, exports > 1,000 rows.

### 6. Edge Cases

(from risk-engineering Module 10)

1. **Staff/owner concurrent edit conflict.** Optimistic versioning on ALL admin-editable entities; 409 + reload-with-diff path; never last-write-wins on money-bearing fields (price, stock, coupon terms).
2. **Privilege escalation via direct API calls.** Staff crafts requests to owner-only endpoints (role change, refunds, coupons, exports). Authz enforced per-route server-side; negative tests for every owner-only route enumerated in a single exhaustive checklist test file.
3. **Admin session policy.** 12h session (`admin_sessions`), rotation on privilege change, revocation on role change/removal effective within one request (session store checked, not JWT-only); admin login is OTP (purpose `admin_login`) with class-C limits.
4. **Manual inventory adjustment races the checkout decrement.** Admin "sets" stock to 50 while orders decrement concurrently. Adjustments are **relative deltas** (`+20 received`, `-2 damage_writeoff`) with reason codes into `inventory_adjustments` — never absolute SET, which silently swallows concurrent sales. Guarded UPDATE rejects negative outcomes (409).
5. **COD queue: two staff call the same customer.** Row claiming — "handling" soft-lock with visible assignee and 15-min auto-release; confirmation attempts logged so a customer is never called twice in ten minutes by different staff.
6. **Admin action on an order in a transitional state.** Cancel clicked while `payment.captured` webhook is mid-processing. Both funnel through the state machine under `SELECT ... FOR UPDATE` (Contract §1.28.3) — single arbiter; UI disables illegal actions but the server rejection (422 `INVALID_TRANSITION` + allowed-list) is the guarantee.
7. **Bulk operation partial failure.** CSV price import fails at row 40 of 100: all-or-nothing transaction + per-row error report; no partially applied silent bulk writes on price data. Imports carry an import ID — re-upload of the same file does not double-apply.
8. **Audit trail completeness.** Every admin mutation writes `{actor, action, entity_type, entity_id, before, after}` to `admin_audit_log` in-tx; table is append-only (no UPDATE/DELETE grants). Refund disputes and staff mistakes are settled here.
9. **Owner removes a staff member with in-flight claims.** Claimed COD rows auto-release; sessions revoked immediately; audit rows keep the actor id (SET NULL FK, soft-deactivated user, never CASCADE).
10. **Data export leaks.** Order CSVs contain PII: owner-only, generated on demand, logged, delivered via short-lived signed URLs — never a public bucket path.
11. **Stored XSS targeting the admin's browser.** Admin renders customer-authored content (names, gift messages, review bodies, addresses) — every such render encoded; the moderation UI is itself the attack surface, tested explicitly with XSS fixtures.
12. **Shared/lost device.** Owner has "log out all sessions"; new-admin-login notification goes to owner email.
13. **Last-owner lockout.** `PATCH /api/admin/users/[id]` deactivating or demoting the only active owner returns 422 — the system can never end up staff-only.

### 7. Testing Requirements

- **Unit (`packages/core` + admin lib):** role→permission matrix, table-driven and exhaustive over every defined admin action; stock-ledger sum invariant (current stock = ledger sum); COD claim/auto-release timing (claim, expiry at 15 min, re-claim); IST date-range → UTC bounds conversion for metrics (`istDayToUtcRange`, incl. the 11:30 PM IST boundary case); last-owner guard predicate.
- **Integration (ephemeral Postgres):**
  - **The authz checklist test** — every `/api/admin/*` route × {unauthenticated, staff, owner} → expected status (401/403/2xx), exhaustive; adding a route without extending this test fails CI (route-manifest diff).
  - Optimistic-version 409 on concurrent product/variant edits.
  - Relative stock adjustment concurrent with checkout's atomic decrement — property: ledger never negative, no lost updates, `stock_after` chain consistent.
  - Bulk import rollback at an injected mid-file failure; same-import-ID re-upload no-ops.
  - **Audit meta-test:** any admin route that mutates without producing an `admin_audit_log` row fails.
  - Session revocation on role change effective on the next request; last-owner deactivation → 422.
  - Order transition endpoint racing a simulated webhook on the same order — exactly one transition wins, history is linear.
- **E2E (Playwright, per risk-engineering Module 10):**
  1. *COD queue workflow:* COD order lands in queue → staff claims → records "confirmed" → order proceeds to fulfillment → a second staff session sees the claimed state throughout.
  2. *Role enforcement:* staff attempts an owner-only refund via UI and direct API → both blocked → owner completes it.
  3. *Inventory receive flow:* owner records `+50 received` with note → PDP sellable stock reflects it → ledger shows the entry with actor and reason.

### 8. Production-Readiness & Definition of Done

- **Validation:** zod (from `packages/core/src/contracts/admin/*.ts`) on every admin mutation, `.strict()` (reject unknown keys); CSV imports schema-validated per row **before** the transaction starts; price/stock as positive integer paise/ints.
- **Authz:** per-route role middleware + per-action assertion; `kakoa_admin` cookie path-scoped to `/admin` + `/api/admin`, `HttpOnly, Secure, SameSite=Lax`; the exhaustive checklist test is the enforcement proof.
- **Rate limits:** class E (600/min/admin session) on `/api/admin/*`; admin OTP on class C (1/60s + 3/10min + 10/day per destination, 20/hr/IP, 5 verify attempts); exports 5/hour/owner. Standard `X-RateLimit-*` + `Retry-After` headers.
- **Injection guards:** Drizzle parameterized everywhere; customer-authored content encoded in every admin render; **CSV formula-injection guard** — prefix `'` on any cell starting with `=`, `+`, `-`, or `@` in every export.
- **Idempotency:** transitions idempotent through the state machine (replays → 422 with allowed-list or same-state no-op); bulk imports keyed by import ID; refund creation keyed by our refund id.
- **Logging:** `admin_audit_log` IS the mutation log; plus structured `admin.login {actor, ip}`, `admin.export {actor, entity, row_count}`, `admin.claim {order_id, actor}`; customer PII reads by admins audited.
- **Alerting:** failed admin-login spike; export > 1,000 rows (owner notification); role-change events (owner notification); **COD queue depth > 25 or oldest unconfirmed > 24h** (this is the launch-gate metric); audit-write failure (any mutation path that can't write audit must fail the mutation).

**Definition of Done:**

- [ ] Exhaustive authz checklist test green (every route × role × unauthenticated)
- [ ] Append-only audit on all mutations, proven by the meta-test; no UPDATE/DELETE grants on `admin_audit_log`
- [ ] Ledger-based inventory (relative deltas only) proven under concurrency with the checkout decrement
- [ ] COD claiming live: claim, visible assignee, 15-min auto-release, attempt logging
- [ ] Admin session: 12h lifetime, revocation immediate on role change/deactivation, "log out all sessions" for owner
- [ ] Last-owner guard (422) tested; staff removal auto-releases claims and revokes sessions
- [ ] Optimistic-versioning 409 + diff UI on all admin-editable entities
- [ ] CSV formula-injection guard on every export; exports owner-only, signed-URL, audited, 5/hour
- [ ] Metrics dashboard uses IST calendar-day ranges with the boundary test green
- [ ] All alerts wired (COD queue depth, login spike, export volume, role changes)
- [ ] The 3 E2E scenarios green in CI

---

## §4 — Cross-Cutting Concerns

> Owner: **Dev E** (QA, DevOps & CI), with named delegates called out per subsection. Everything here is phase-spanning: it starts in Phase 0, hardens in Phase 3, and gates launch in Phase 4. Nothing in this section is optional scope.

### 4.1 CI/CD Pipeline

Three distinct stages with escalating rigor. All pipeline config lives in `.github/workflows/**` (Dev E sole owner; changes need E + one other approval). GitHub **merge queue is ON** — it serializes final CI runs and guarantees linear migration application order.

**Stage 1 — every PR (target < 15 min wall clock):**

1. Install + Turborepo cache restore.
2. `tsc --noEmit` strict across the workspace.
3. ESLint + **import-boundary check** (storefront ∉ admin; only designated data layers import `packages/db`; `core` imports nothing app-side; floats in money code and raw `Date.now()` in expiry logic fail lint).
4. Vitest unit suite — **coverage gates on `packages/core`: ≥ 95 % on money/GST/state-machine/coupon-allocation files (state-machine transition table at 100 % branch), ≥ 85 % package-wide. CI fails below.**
5. Integration tests against **ephemeral Postgres** (Docker service container): all Drizzle migrations applied from zero, then the suite — **the concurrency tests (oversell, coupon last-redemption race, OTP atomic consume, double-submit idempotency replay) run on every PR, not nightly.**
6. **Drizzle migration drift check** — generated schema must match committed migrations; append-only enforced (CI diffs migration files against main; an edited historical migration fails); destructive ops require an explicit `#[allow-destructive]` marker + owner review.
7. Fixture validation — every fixture in `packages/core/src/testing/fixtures/` parses against the current zod contracts (Contract v1.0.0 semver rules per §2.3; `contract-change` label + `CONTRACT_VERSION` bump enforced).
8. `next build`.
9. Vercel preview deploy → **Playwright smoke subset** against the preview URL + Supabase preview branch: browse → cart → prepaid checkout (Razorpay test mode) → confirmation, plus COD order placement. ~4–10 min budget.
10. **Lighthouse CI on PDP + Home** (emulated mid-tier Android, slow 4G): LCP ≤ 2.5 s, CLS ≤ 0.1, JS budget. Advisory Weeks 3–4, **blocking from Week 5**.

**Stage 2 — merge to main:**

- Full Stage-1 pipeline re-run in the merge queue, plus: **complete E2E suite** (all ~36 module scenarios from §3) against a fresh preview; full webhook replay-fixture suite (Razorpay recorded payloads + Shiprocket fixture library); `pnpm audit` + license check (fail on critical); `--frozen-lockfile` everywhere.
- Migrations auto-apply to the staging Supabase project on merge. No `drizzle-kit push` from laptops against staging/prod — the drift check catches attempts.

**Stage 3 — production deploy (manual, human decision):**

- Vercel **manual promotion**; main is always deployable. B or E presses the button.
- Migrations run **before** promotion via a gated CI job. Expand-and-contract discipline: new code must run against old schema and vice versa for one deploy cycle (reviewed on every migration PR).
- Post-deploy automated smoke: `/api/health`, PDP render, cart add, Razorpay order-create against a test key routed by a smoke flag — never a real charge in prod smoke.
- Rollback: Vercel instant rollback for code; **migrations are forward-fix only** (which is why expand-and-contract is mandatory). Runbook written and dry-run before launch (see 4.7).

### 4.2 Environments Matrix

Four environments, one truth table. Env-var validation is a single `packages/config` zod schema parsed at boot in every runtime (Next.js and Inngest functions) — **missing var = crash at startup, never at request time**; CI asserts `.env.example` keys match the schema.

| | Local | Preview (per-PR) | Staging | Production |
|---|---|---|---|---|
| **DB** | Local Postgres (Docker) or Supabase branch | Supabase branch DB, CI-migrated | Dedicated Supabase project, ap-south-1 | Supabase ap-south-1, **PITR on** |
| **Razorpay** | Test keys | Test keys; webhooks via replay fixtures or per-preview tunnel | Test keys + real webhook subscription to staging URL | **Live keys**; distinct webhook secret; optional source-IP allowlist |
| **Shiprocket** | In-repo mock | In-repo mock (no sandbox exists) | Mock by default; `SHIPROCKET_LIVE=1` opt-in smoke against the real account with test pincodes (creates real orders — cancel immediately; documented drill) | Real API, DB-cached token (240 h expiry, refresh ≤ 9 days) |
| **Inngest** | Dev server | Branch envs | Staging env | Prod env, alerts on |
| **SMS/OTP (MSG91)** | Console-logged code | Fixed test code `000000` for seeded test numbers | Real SMS to team numbers + test-number bypass | Real SMS, **daily spend alert** |
| **Email (Resend)** | Local capture (Mailpit) | Provider sandbox/capture | Real provider, team inboxes | Real provider, SPF/DKIM/DMARC verified |
| **Sentry** | Off / dev DSN | Preview DSN, `environment` tag | Staging tag | Prod, release-tagged, alert rules live |
| **Indexing** | n/a | `X-Robots-Tag: noindex`, no sitemap | noindex | Indexable, sitemap live (noindex absence verified at launch) |
| **Secrets** | `.env.local` from `.env.example` (zod-validated at boot) | Vercel env, preview scope | Vercel env, staging scope | Vercel env, prod scope; **live keys visible to owner only** |

The noindex header on non-prod is asserted by an integration test that hits a preview URL — a leaked staging domain in Google is an SEO incident, not a shrug.

### 4.3 Monitoring & Error Tracking

Owner: Dev E configures; Dev B co-owns structured logging conventions in `packages/core`.

- **Sentry** — browser + server + Inngest functions; release tagging tied to the Vercel deploy; **PII scrubbing rules (phone/email/address fields) configured before launch**. Alert rules: any new issue in payments/checkout code paths = immediate notification; error-rate spike ≥ 5× baseline.
- **Structured logs** — JSON to stdout; every line carries `{request_id, order_id?, user_id_hash?, module, event}`; the request ID is propagated into Inngest events so one order's lifecycle is traceable across web → webhook → job. **Identifiers are hashed in logs — never raw phone/email; never card data or full contact PII in payment logs.**
- **Inngest** — per-function failure alerts wired to the team channel; per-function concurrency caps set explicitly (e.g., Shiprocket push ≤ 5 concurrent); backlog reviewed in the weekly ops check; any `failed_permanent` webhook_events row alerts immediately.
- **healthchecks.io dead-man switches** — every scheduled job pings on **completion**; a missed ping (absence of success, not presence of failure) pages. Registered switches:
  1. Stuck-payment sweep (15–30 min cadence)
  2. Shiprocket tracking poller (30–60 min)
  3. Nightly Razorpay + Shiprocket reconciliation
  4. Shiprocket token refresh (plus a token-age > 9 days page-level alert — everything downstream dies without it)
  5. COD remittance matcher
  6. Sitemap regeneration
  7. Review-aggregate integrity check
- **Uptime** — external checker on `/api/health` (summarizes DB reachability, Shiprocket token freshness, Inngest reachability; cheap, unauthenticated, leaks nothing beyond status).
- **Business-metric alerts (they catch bugs monitors miss):** zero orders in a business-hours 3 h window; payment success rate < 70 %; COD share > 60 % (prepaid flow broken?); ₹0-revenue day rollup; OTP verify-success rate < 70 % (SMS delivery = revenue); refund rate > 5 % of orders (melt-season smoke detector); `fulfillment_blocked`/exceptions queue depth thresholds per module §3 specs.
- **Reconciliation noise control:** nightly reconciliation only flags anomalies older than 2× the sweep interval; findings deduped by `(order_id, anomaly_type)` with open/resolved state; alert on **new** findings only.

### 4.4 Shared Component Library & Design-System Rules

Owner: Dev A (`packages/ui`); every PR touching it takes A's review.

- The design system extracted in §0 (Ink/Cocoa/Espresso/Cream palette, DM Serif Display / Hanken Grotesque / DM Mono via `next/font`, pill buttons, 999 px chips, partial-fill stars, toasts, fade-up-with-reduced-motion) is codified once in `packages/ui` as tokens + primitives during Phase 0 — see the §3 design-system module for the component inventory.
- **The "no local button styles" rule:** no route or feature module defines its own button, input, chip, card, badge, toast, or star-rating styles. All interactive primitives are imported from `packages/ui`. A one-off style is a PR to `packages/ui` (new variant prop), not a local class. Enforced by review convention plus the import-boundary lint where practical (e.g., admin and storefront both consume `ui`; neither redefines primitives).
- **Two surfaces, two component sources (decision 2026-07-02):**
  - **Storefront** = bespoke `@kakoa/ui` primitives (brand-heavy, conversion-focused) — unchanged.
  - **Admin (`/admin`)** = **shadcn/ui** (new-york style, CLI v4) + **TanStack Table** for all data grids. Components are installed as owned source into `apps/web/src/components/ui/` via `npx shadcn@latest init -d` + `components.json`; themed by mapping shadcn's CSS variables (`--color-background`, `--color-primary`, `--radius`…) to KAKOA tokens in a `.admin`-scoped `@theme` layer so both surfaces share one palette. Uses the unified `radix-ui` package (Feb 2026), not individual `@radix-ui/react-*` packages.
  - Admin composition recipes are standard shadcn patterns: summary `Card`s + filter bar + `Table` (dashboard); `Table` + `DropdownMenu` + `Sheet` + `AlertDialog` (CRUD); **`AlertDialog` — never `Dialog` — for destructive confirmations** (refunds, cancellations, stock write-offs); `Command` palette for admin quick-nav.
  - The "no local styles" rule applies **per surface**: storefront features import only `@kakoa/ui`; admin features import only `apps/web/src/components/ui/` (shadcn). Neither surface imports the other's primitives; tokens are the only shared layer.
- Accessibility baseline lives in the primitives (focus rings, hit targets ≥ 44 px, `prefers-reduced-motion` fallbacks that never hide content) so feature teams inherit it instead of re-implementing it.
- Storybook (or a lightweight equivalent page under a dev-only route) documents every primitive state; a UI change that breaks a documented state fails A's review.

### 4.5 Security Baseline

Owner: Dev E audits; Dev B implements session/middleware pieces; the owner (founder) holds the rotation calendar.

- **Headers:** CSP with `script-src 'self'` + Razorpay checkout domains + analytics allowlist; `frame-src` Razorpay; HSTS; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`. **The CSP must be tested against the real Razorpay checkout modal early (Phase 1)** — the modal dictates the allowlist, and discovering a CSP break at launch is unacceptable. Scanned with Mozilla Observatory (or equivalent) before launch.
- **Secrets:** all in Vercel env vars scoped per environment; never in the repo (gitleaks in CI); Razorpay webhook secret ≠ API key secret and rotated on any suspicion; Shiprocket credentials server-env only; quarterly rotation calendar owned by the owner; Vercel env vars exported to an encrypted vault copy (env loss = outage).
- **Sessions & admin surface:** admin sessions 8 h idle / 24 h absolute, rotation on privilege change, revocation effective within one request (session store checked, not JWT-only); admin middleware **404s (not 403s)** unauthenticated probes; customer session rotation on every auth event; all cookies `HttpOnly, Secure, SameSite=Lax`.
- **Rate limiting:** the Contract §2.1 classes A–E are middleware token buckets, with OTP (Class C) additionally enforced authoritatively by counting `otp_challenges` rows — the DB is the authority, no Redis at launch. Standard `X-RateLimit-*` headers + `Retry-After` on 429 `RATE_LIMITED` everywhere.
- **PII / DPDP Act readiness:** phone/email hashed in logs; EXIF stripped from customer photo evidence before admin display; data exports owner-only via short-lived signed URLs with audit logging; a maintained **one-page data map** (what PII lives in which table/log/vendor) — this is the DPDP artifact.
- **Payment scope:** no card data ever touches our servers (Razorpay hosted checkout); assert no request-logging middleware can capture checkout-adjacent payloads; webhook routes are signature-only (`SIGNATURE_INVALID` on bad HMAC over the **raw body**), exempt from session middleware, `Cache-Control: no-store`.
- **Dependency hygiene:** Renovate/Dependabot weekly; `pnpm audit` CI gate on critical vulns; `--frozen-lockfile` installs in CI; license check in the merge-to-main stage.
- **Abuse economics:** OTP brute-force/resend limits + daily SMS spend alert (an OTP spray burns real money on day one); card-testing limits (5 payment attempts/hour per IP and per identifier) + Razorpay fraud settings ON + payment-failure-rate alert (> 30 % over 15 min); coupon-apply enumeration limits with a single generic error (no validity oracle).

### 4.6 Backup / Recovery

Owner: Dev B (Supabase), Dev E (drill scripting).

- **Supabase PITR enabled on prod** (7-day window minimum) + daily logical `pg_dump` retained 30 days in separate storage. Targets: **RPO ≤ 5 min (PITR), RTO ≤ 2 h** — documented, not aspirational.
- **Restore drill before launch and quarterly:** restore PITR to a scratch project, run the app against it, verify: latest orders present, `webhook_events` intact, stock-ledger sums correct. Scripted and time-boxed; the first drill is a launch-gate item.
- **Reconciliation as recovery:** after any restore, the Razorpay reconciliation replays the gap window (the payments API is the external source of truth for money) and the Shiprocket poller re-syncs shipment states. This **post-restore reconciliation checklist** is a written runbook step, not tribal knowledge — a restore that loses a captured payment is found by reconciliation, not by a customer email.
- **Config/infra recovery:** Vercel env vars vault-copied (see 4.5); Inngest function config lives in code and is recoverable by redeploy; DNS and Razorpay/Shiprocket dashboard settings screenshotted/documented in the runbook.

### 4.7 Launch-Gate Checklist

Condensed from the per-module Production-Readiness checklists in §3; the full set lives there. **Every box below must be checked before the Phase 4 → launch flag flip; the COD gate additionally blocks paid marketing spend post-launch.**

**Money & orders**
- [ ] Concurrency tests (oversell, double-submit, coupon race, OTP consume) green in CI **on every PR**
- [ ] Raw-body HMAC verification with negative tests; persist-then-ack measured < 5 s (p99 < 1 s in test)
- [ ] Stuck-payment sweep + nightly Razorpay reconciliation live, alert-wired, dead-man-monitored
- [ ] Orphan-payment handling exercised end-to-end in staging (manually orphan a test payment, watch it get found)
- [ ] Line-level refunds with coupon allocation + snapshot GST verified against hand-computed fixtures
- [ ] `packages/core` coverage gates enforced in CI (state machine 100 % branch)

**Fulfillment & COD**
- [ ] Shiprocket token refresh + age-alert live; 401-retry wrapper tested
- [ ] Poller-as-primary proven by the webhook-silence test; monotonic shipment states enforced
- [ ] COD queue, confirmation policy, RTO disposition, and remittance matcher all exercised in staging by real staff
- [ ] One real Shiprocket order created and cancelled from staging (`SHIPROCKET_LIVE=1` drill) to validate mock fidelity

**Security & abuse**
- [ ] OTP brute-force/resend limits + SMS spend alert live
- [ ] Card-testing rate limits + Razorpay fraud settings enabled and verified in the dashboard
- [ ] Exhaustive admin authz test green (every admin route × staff/owner/unauthenticated); audit table append-only verified
- [ ] XSS fixture corpus (gift messages, reviews, names, markdown) passing on web, email, packing slip, **and admin** surfaces
- [ ] CSP tested against live Razorpay checkout; headers scanned; secrets scan clean; env zod validation crashes on missing config

**Ops**
- [ ] All seven dead-man switches registered and **one deliberately tripped as a drill**
- [ ] Sentry alerts firing to the right channel (test event sent); PII scrubbing verified
- [ ] PITR restore drill completed and documented; rollback runbook + post-restore reconciliation checklist written and dry-run
- [ ] Business-metric alerts (zero-orders window, payment success rate, COD share, SMS spend) live

**Storefront**
- [ ] Full E2E suite (all ~36 scenarios) green against a production-config preview
- [ ] Golden path executed on real production with a live-key ₹10-class order, refunded, before public traffic
- [ ] noindex verified **absent on prod, present on previews**; sitemap + JSON-LD validated
- [ ] IST/UTC boundary behavior verified in admin "today" views and reports (11:30 PM IST order lands in today, not tomorrow)
- [ ] Lighthouse budgets passing on all storefront pages; legal/FSSAI/Legal Metrology content final

**Post-launch hold:** paid marketing unlocks only after **7 clean days of daily reconciliation (Razorpay = DB, every day) + the COD confirmation queue demonstrably working on real orders** — the COD gate from §2.5, verified in production.

---

# (§5–§6 + Changelog)

## §5 — Page Coverage Matrix

Every routable page in the build, cross-checked against the §0 prototype inventory: **every one of the 19 prototype screens is either mapped below or explicitly deferred/dropped** (Gift cards → §6; Subscription → §6; "System" screen + card variants A/B/C → dropped as design-playground artifacts, per §0). Rewards appears only as a deferred tab note on the Account dashboard.

Conventions: **Module** references the §3 module sections (numbered as in the module plan: 1 Catalog · 2 Cart · 3 Checkout & Orders · 4 Payments · 5 Coupons · 6 Fulfillment/Shipping · 7 Customer Accounts · 8 Reviews · 9 Returns · 10 Admin Panel · 11 Webhooks/Jobs · 12 Content/SEO). **Rendering:** `static` = built at deploy (SSG/MDX) · `ISR 60s` = revalidate 60 + on-demand tag revalidation from admin writes · `dynamic` = per-request server render, no cache. **Auth** uses the Contract §2.1 tiers (`public` / `customer` / `guest-token` / `admin:staff` / `admin:owner`).

### Storefront

| Page | Route | Module (§3) | Owner | Phase | Rendering | Auth |
|---|---|---|---|---|---|---|
| Home | `/` | §3.1 Catalog + §3.12 SEO | A | 1 | ISR 60s | public |
| Shop / Collection (filter chips, sort ×4) | `/shop` (`?category=&sort=&page=`) | §3.1 Catalog | A | 1 | dynamic (API `s-maxage=60`) | public |
| Product detail (gallery, variants, gift options, tabs, related, FBT) | `/product/[slug]` | §3.1 Catalog (+§3.8 reviews slot) | A | 1 (reviews slot filled P2) | ISR 60s, tag-revalidated on admin product edit | public |
| Search results (trending/popular/results states) | `/search?q=` + header overlay | §3.1 Catalog | A | 1 | dynamic | public |
| Cart page | `/cart` | §3.2 Cart | A | 1 | dynamic | public (cart cookie) |
| Cart drawer | overlay (all storefront routes) | §3.2 Cart | A | 1 | client, hydrated from `GET /api/cart` | public (cart cookie) |
| Checkout — 4 steps (contact/address → delivery+serviceability → payment mode incl. COD OTP → review+pay) | `/checkout` | §3.3 Checkout + §3.4 Payments + §3.5 Coupons | C | 1 (UI on MSW) → 2 (webhooks/refund truth) | dynamic | public (cart cookie) \| customer |
| Order confirmation / success | `/order/confirmation/[orderNumber]` | §3.3 Checkout | C | 1 | dynamic | `accessToken` (≤24h) \| customer |
| Order tracking (guest OTP lookup + timeline) | `/track` and `/account/orders/[orderNumber]` | §3.6 Fulfillment + §3.7 Accounts | A (UI) / D (data) | 2 | dynamic | public → guest-token \| customer |
| Login / OTP (request → verify, replaces prototype login/register/forgot/reset) | `/login` | §3.7 Accounts | B | 1 | dynamic | public (Class C limits) |
| Account — overview/profile | `/account` | §3.7 Accounts | B | 1 shell → 2 complete | dynamic | customer |
| Account — order history | `/account/orders` | §3.7 Accounts | B | 2 | dynamic | customer |
| Account — addresses | `/account/addresses` | §3.7 Accounts | B | 2 | dynamic | customer |
| Account — wishlist | `/account/wishlist` | §3.7 Accounts | B (data) / A (UI) | 2 (cuttable per §2.5) | dynamic | customer |
| Account — returns (list + new request w/ photo upload) | `/account/returns` | §3.9 Returns | B (page) / D (admin side) | 2 | dynamic | customer (guest via `/track` + trackingToken) |
| Journal list | `/journal` | §3.12 Content/SEO | A | 1 | static (MDX) | public |
| Journal post (6 articles) | `/journal/[slug]` | §3.12 Content/SEO | A | 1 | static (MDX) | public |
| Our Story | `/about` | §3.12 Content/SEO | A | 1 | static | public |
| Contact | `/contact` | §3.12 Content/SEO | A | 1 | static | public |
| Help center (6 categories, 8 FAQs) | `/help` | §3.12 Content/SEO | A | 1 | static | public |
| Store locator (India addresses — §0 rewrite) | `/stores` | §3.12 Content/SEO | A | 1 | static | public |
| Legal — Privacy / Terms / Refund / Shipping (incl. FSSAI license + Legal Metrology display) | `/legal/privacy` `/legal/terms` `/legal/refund-policy` `/legal/shipping-policy` | §3.12 Content/SEO | A | 0 shells → 1 final copy | static | public |
| 404 / error / global-error | `not-found.tsx`, `error.tsx` | §3.12 Content/SEO | A | 0 | static | public |

### Admin (`apps/web/app/(admin)/**`, all backed by Contract §2.9)

| Page | Route | Module (§3) | Owner | Phase | Rendering | Auth |
|---|---|---|---|---|---|---|
| Admin login (email OTP) | `/admin/login` | §3.10 Admin | D | 1 | dynamic | public (Class C; active `admin_users` only) |
| Dashboard (revenue/AOV/COD share/RTO rate, queues, top products, low stock) | `/admin` | §3.10 Admin | D | 2 | dynamic | admin:staff |
| Orders list (status/paymentMode/date/q filters) | `/admin/orders` | §3.10 Admin + §3.3 | D | 2 | dynamic | admin:staff |
| Order detail (items, payments, refunds, shipments+events, history, returns; transition/cancel/ship actions) | `/admin/orders/[id]` | §3.10 Admin + §3.3/§3.4/§3.6 | D | 2 | dynamic | admin:staff (refund action owner-only) |
| **COD confirmation queue** (launch-gating) | `/admin/cod-queue` | §3.10 Admin + §3.4 | D | 2 | dynamic | admin:staff |
| RTO / NDR views | `/admin/rto` | §3.10 Admin + §3.6 | D | 2 | dynamic | admin:staff |
| Products & variants CRUD (images via signed-URL flow) | `/admin/products`, `/admin/products/[id]` | §3.10 Admin + §3.1 | D | 1 | dynamic | admin:staff |
| Inventory (stock, low-stock filter, adjust + ledger) | `/admin/inventory` | §3.10 Admin + §3.1 | D | 1 | dynamic | admin:staff |
| Customers list + detail (LTV, RTO count, block toggle) | `/admin/customers`, `/admin/customers/[id]` | §3.10 Admin + §3.7 | D | 2 | dynamic | admin:staff |
| Coupons CRUD | `/admin/coupons` | §3.10 Admin + §3.5 | D | 2 | dynamic | **admin:owner** |
| Reviews moderation (pending queue, approve/reject) | `/admin/reviews` | §3.10 Admin + §3.8 | D | 2 | dynamic | admin:staff |
| Returns queue (decision, mark-received + restock) | `/admin/returns` | §3.10 Admin + §3.9 | D | 2 | dynamic | admin:staff |
| Staff / roles (invite, role, deactivate; last-owner guard) | `/admin/staff` | §3.10 Admin | D | 1 | dynamic | **admin:owner** |
| Settings (`store_settings`: FSSAI no., free-ship threshold, COD fee/limits, support contacts; behavior flags) | `/admin/settings` | §3.10 Admin | D | 2 | dynamic | **admin:owner** |

### Non-page surfaces (for completeness; no UI)

| Surface | Route | Module (§3) | Owner | Phase |
|---|---|---|---|---|
| Razorpay webhook | `POST /api/webhooks/razorpay` | §3.11 Webhooks | C | 2 |
| Shiprocket webhook | `POST /api/webhooks/shiprocket` | §3.11 Webhooks | D | 2 |
| Inngest serve | `POST /api/webhooks/inngest` | §3.11 Webhooks | B | 1 |
| Sitemap / robots / OG images | `/sitemap.xml`, `/robots.txt`, `/og/*` | §3.12 SEO | A | 2 |

**Coverage check vs §0:** 17 prototype screens mapped (Home, Shop, PDP, Cart+drawer, Checkout, Order success, Account, Tracking, Returns, Our Story, Journal ×2, Help, Store locator, Auth, Legal, 404, Search overlay) · 2 deferred (Gift cards, Subscription → §6) · 1 dropped (System/card-variants screen). No orphans.

---

## §6 — Deferred (Phase 4+)

Per §1, first roadmap review is **Week 13, not before**. Nothing below gets a schema table, a flag, or a "quick stub" before its trigger fires; each has a pre-scouted path so deferral costs an RFC, not a rewrite.

| Feature | Why deferred | Pre-scouted path | Revisit trigger |
|---|---|---|---|
| **Subscriptions** (recurring chocolate box) | Recurring billing + RBI e-mandate rules (recurring card/UPI autopay mandates, notification-before-debit) are a compliance project of their own | Razorpay Subscriptions API behind the existing `PaymentProvider` interface | ≥ 15% of surveyed repeat customers (3+ orders) ask for it, or repeat-purchase interval stabilizes enough to price a box |
| **Gift cards** (stored value) | Stored value is a **PPI (Prepaid Payment Instrument)** under RBI rules — KYC, escrow, and reporting obligations; closed-system PPI exemption needs legal sign-off before any wallet-like balance exists | Model as single-use fixed-value coupon codes first (no stored balance ⇒ no PPI question); `coupons` table already supports it | Legal opinion on closed-loop PPI exemption in hand **and** gifting exceeds ~10% of Q3 orders |
| **Rewards / points** (prototype's Account "rewards" tab) | Loyalty liability accounting + breakage rules; worthless before a repeat-purchase base exists | Points ledger as append-only table mirroring `inventory_adjustments` pattern; redeem as auto-generated coupon | ≥ 20% of customers on a 2nd order within 60 days — before that there is nothing to reward |
| **Multi-currency / international shipping** | INR-integer-paise invariant is load-bearing (§1); export = customs, FSSAI export cert, melt-risk logistics | `Paise` stays; add `display_currency` at the edge only, never in money math | Sustained organic international traffic > 5% of sessions or a wholesale/export inquiry worth the ops cost |
| **WhatsApp Business API** (order updates, COD confirmation nudges) | BSP onboarding, template pre-approval, and per-conversation pricing not worth it before message volume exists | Slots in as a second `SmsProvider` implementation (MSG91 already offers WhatsApp channel) | COD confirmation contact rate via SMS+call < 80%, or transactional SMS volume > 5k/month |
| **CMS for the blog** | §1: MDX in-repo until a non-developer writes content — a CMS for 5 devs is pure overhead | MDX content dir is already isolated (`apps/web/content/**`); any headless CMS maps 1:1 to frontmatter | The first week a non-developer owns the content calendar |

Also explicitly out of scope until further notice (no trigger, owner-initiated only): marketplace channels (Amazon/Flipkart sync), POS for physical stores, native mobile app.

---

## Contract Changelog

| Version | Date | Change | Migration |
|---|---|---|---|
| v1.0.0 | 2026-07-02 | Initial contract: full schema (Contract §1.1–1.26), order state machine (§1.27), concurrency patterns (§1.28), snapshot register (§1.29), complete API surface (§2.2–2.9), error registry + rate-limit classes A–E (§2.1) | — |

---
