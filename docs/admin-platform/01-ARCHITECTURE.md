# 01 — Admin Platform Architecture

Covers **Phase 1 (architecture review & integration)**, **Phase 2 (think beyond Kakao)**, **Phase 4 (multi-business readiness)**.

---

## §1 — The reuse model (Decision A1)

### 1.1 What "reusable across businesses" means here

**Model: a config-driven reusable platform, deployed once per business, each with its own database — architected so shared multi-tenancy can be layered on later.**

```
                    ┌─────────────────────────────────────────┐
                    │          @platform/*  (one codebase)      │
                    │  kernel + commerce domain + admin modules │
                    └───────────────┬──────────────────────────┘
                                    │  deploy + configure
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
  ┌─────────────┐           ┌─────────────┐            ┌─────────────┐
  │  Kakao      │           │  Bakery Co. │            │  Coffee Co. │
  │  (chocolate)│           │  (bakery)   │            │  (coffee)   │
  │  own DB     │           │  own DB     │            │  own DB     │
  │  BusinessProfile+preset │  ...        │            │  ...        │
  └─────────────┘           └─────────────┘            └─────────────┘
```

**Why this over shared multi-tenancy (now):**

| Factor | Deploy-per-business (chosen) | Shared multi-tenant (deferred) |
|---|---|---|
| Retrofit cost on current build | Low — de-hardcode + config layer | **Very high** — add `business_id` to 29 tables, every query, RLS policies, rewrite the verified storefront |
| Data isolation (PII across unrelated brands) | **Perfect** — separate DBs | Row-level; one policy bug = cross-tenant leak |
| Per-business customization | Easy — independent config/deploy | Harder — shared schema constrains |
| Onboarding a new business | Provision instance + config (automatable) | Insert a tenant row |
| Blast radius of a bug/migration | One business | All businesses |
| "Minimal customization" goal | ✅ met | ✅ met (but at higher risk) |

We have **one** business today. Paying the full multi-tenant tax now is premature and risky. Instead we get genericity immediately and keep the door open.

### 1.2 The `BusinessContext` seam (forward-compatibility for A1(b))

Every request resolves a **`BusinessContext`** — today it is a singleton loaded from config+DB; tomorrow it can be resolved from a subdomain/tenant header. **All config reads, data-access, and settings flow through it.** Because nothing reads `store_settings` or brand constants directly (they go through `BusinessContext`), converting to shared multi-tenancy later is: (1) add `business_id` columns, (2) make `BusinessContext` resolve per-request and inject a tenant scope into the data-access layer — **without touching module code**. This is the single most important architectural decision for future scalability.

```ts
interface BusinessContext {
  businessId: string;              // 'default' today; real id under multi-tenancy
  profile: BusinessProfile;        // brand, market, legal, contacts
  capabilities: Set<Capability>;   // enabled feature capabilities
  modules: Set<ModuleKey>;         // enabled admin modules
  settings: SettingsReader;        // typed, cached read over business_settings
  can(perm: Permission): boolean;  // RBAC check for the acting admin
}
```

---

## §2 — Think beyond Kakao: the genericity model (Phase 2)

Three composable concepts remove all business-specific hardcoding. **None of them is a `switch (businessType)`.**

### 2.1 Business Profile

The data that makes an instance "this business." Generalizes today's `store_settings` into a typed, namespaced config surface (`business_settings`), plus a boot config for values that must exist before a DB read.

| Group | Examples (from current hardcoding → now config) |
|---|---|
| **Brand** | name, legal name, logo, colors/theme tokens, wordmark, favicon, tagline (was: `BRAND` const, `@kakoa` strings, footer copy) |
| **Market** | country, currency, tax regime, locale, phone format (was: INR/paise, `+91`, GST hardcoded) |
| **Legal/identity** | tax id (GSTIN), food licence (FSSAI), registered address, support phone/email (was: `store_settings` legal keys) |
| **Commerce policy** | shipping fees, free-ship threshold, COD toggle, gift-wrap fee, payment-expiry, refund thresholds (was: `store_settings` fee keys — already config ✅) |
| **Identifiers** | order-number prefix, SKU prefix, cookie prefix (was: `KK-`, `KK-…` SKUs, `kakoa_*` cookies) |
| **Enablement** | enabled modules, enabled capabilities, vertical preset id |

### 2.2 Vertical Presets

A **preset** is a *starting template* for a kind of business. It seeds sensible defaults and is **fully overridable** — it is not a lock-in branch.

```ts
interface VerticalPreset {
  key: 'chocolate' | 'bakery' | 'coffee' | 'tea' | 'snacks' | 'grocery'
     | 'restaurant' | 'food-delivery' | 'organic' | 'gifts' | 'general';
  label: string;
  capabilities: Capability[];          // turned on by default for this vertical
  attributeSchema: AttributeDef[];     // default product attributes (§2.4)
  taxDefaults: { category: string; rateBp: number; codeSystem?: 'HSN' };
  categoryTaxonomy?: CategorySeed[];    // suggested starter categories (editable)
  units: 'weight' | 'volume' | 'count'; // default net-quantity unit
}
```

Example presets (starter defaults, all editable in admin):

| Vertical | Default capabilities | Example attributes | Net qty |
|---|---|---|---|
| **chocolate** | `variants`, `perishable`, `veg-mark`, `weight-shipping`, `cold-chain(seasonal)` | cocoa %, origin, tasting notes, tone | weight (g) |
| **bakery** | `perishable`, `veg-mark`, `allergens`, `weight-shipping` | allergens, baked-on, contains-egg | count/weight |
| **coffee** | `variants`, `weight-shipping` | roast level, origin, grind, process | weight (g) |
| **tea** | `variants`, `weight-shipping` | type, caffeine, steep temp | weight (g) |
| **grocery** | `perishable`, `veg-mark`, `batch-expiry`, `weight-shipping` | brand, expiry, unit size | count/weight |
| **restaurant** | `table-orders`, `menu`, `modifiers`, `prep-time` | spice level, add-ons, dietary | count |
| **gifts** | `variants`, `personalization`, `weight-shipping` | material, engraving, occasion | count |
| **general** | `variants`, `weight-shipping` | (none) | count |

Kakao = `general commerce kernel` + `chocolate preset` + Business Profile. **Zero chocolate code.**

### 2.3 Capabilities (the anti-hardcoding mechanism)

A **capability** is an opt-in feature flag that unlocks fields, UI, validation, and module behavior. Modules *require* capabilities; they never ask for a business type. This is how "food and beverage" specifics coexist with "general e-commerce" cleanly.

| Capability | What it turns on | Replaces today's hardcoding |
|---|---|---|
| `variants` | multi-variant products (size/weight) | (already generic) |
| `perishable` | shelf-life, storage instructions, use-by | `products.shelf_life_days`, `storage_instructions` |
| `batch-expiry` | batch/lot + per-batch expiry, FEFO | (new; grocery) |
| `cold-chain` | temperature handling, seasonal shipping rules, melt policy | chocolate summer-shipping logic |
| `veg-mark` | veg/non-veg mark (FSSAI) | `products.is_veg` + Legal Metrology block |
| `allergens` | allergen declarations | (bakery) |
| `weight-shipping` | weight/dimensions → shipping rate | `weight_grams`, dims (already generic) |
| `serviceability` | pincode/zone serviceability | pincode module (India) |
| `tax-inclusive` | GST-inclusive pricing + extraction/split | `gst_rate_bp`, CGST/SGST/IGST (India) |
| `hsn-codes` | tax classification codes | `hsn_code` default `1806` |
| `menu` / `modifiers` | menu items, add-on groups | (restaurant) |
| `table-orders` | dine-in tables, KOT | (restaurant) |
| `personalization` | engraving/gift messages | gift-wrap message (already partial) |
| `subscriptions` | recurring orders | (deferred everywhere) |

A business enables a set of capabilities (seeded by its preset, tunable in admin). Modules/screens/fields render **iff** their required capabilities are enabled.

### 2.4 Configurable product attribute schema (Decision A5)

Product **core columns stay universal**: `name, slug, description, images, status, category, variants(sku, price, compare_at, stock, weight, dims)`. Everything vertical-specific moves to a **per-business attribute schema** + a JSONB `attributes` bag on the product (validated against the schema).

```ts
interface AttributeDef {
  key: string;                 // 'cocoa_pct', 'roast_level', 'allergens'
  label: string;
  type: 'text' | 'number' | 'enum' | 'multi-enum' | 'boolean' | 'rich';
  options?: string[];          // for enum/multi-enum
  required?: boolean;
  capability?: Capability;      // only shown if capability enabled
  group?: string;              // UI grouping ('Nutrition', 'Origin')
  showOnPdp?: boolean;
}
```

- Kakao's chocolate preset ships `cocoa_pct`, `origin`, `tasting_notes`, `tone`. A coffee business ships `roast_level`, `grind`, `process`.
- The admin **Products** module renders a dynamic form from the active `attributeSchema`. No code change per vertical.
- Migration note: today's `tone`, tasting notes, etc. become the chocolate preset's attribute defs; `is_veg` becomes the `veg-mark` capability's field. Documented in [ROADMAP.md](04-ROADMAP.md) Phase P (storefront de-hardcoding).

---

## §3 — Layered architecture (Phase 1 & 4)

Four layers, strict dependency direction (downward only). Business specifics exist **only** in L3 (config).

```
┌──────────────────────────────────────────────────────────────────┐
│  L3  BUSINESS INSTANCE  (pure config, no code)                     │
│      Business Profile · chosen vertical preset · branding · enabled│
│      modules & capabilities · settings.  "Kakao" lives ONLY here.  │
├──────────────────────────────────────────────────────────────────┤
│  L2  VERTICAL LAYER  (pluggable capability implementations)        │
│      perishable · cold-chain · veg-mark · allergens · menu ·       │
│      table-orders · presets.  Opt-in per business.                 │
├──────────────────────────────────────────────────────────────────┤
│  L1  COMMERCE DOMAIN  (business-agnostic e-commerce)               │
│      orders · catalog · inventory · customers · coupons · payments │
│      · shipping · returns · reviews · pricing/tax engine           │
├──────────────────────────────────────────────────────────────────┤
│  L0  PLATFORM KERNEL  (business-agnostic infrastructure)           │
│      auth & sessions · RBAC · audit · config/BusinessContext ·     │
│      data-access · jobs/queues · notifications · media · i18n ·    │
│      rate-limit · error envelope · module registry                 │
└──────────────────────────────────────────────────────────────────┘
```

**Package mapping (proposed — Decision A2/A3, placeholder `@platform`):**

| Layer | Package(s) | Notes |
|---|---|---|
| L0 kernel | `@platform/kernel` (auth, RBAC, audit, config, jobs, registry), `@platform/data` (db + data-access), `@platform/admin-ui` (shadcn + TanStack shells) | new |
| L1 domain | `@platform/core` (enums, money, state machines, contracts — today's `@kakoa/core`), `@platform/integrations` (providers — today's `@kakoa/integrations`) | evolve existing |
| L2 vertical | `@platform/verticals` (presets + capability impls) | new |
| L3 instance | `apps/admin` config + `business/<id>/` profile; `apps/web` (storefront) | config only |

The admin portal is a **new app** (`apps/admin`) — or an `/admin` route group in the existing app — composed from the module registry. The storefront (`apps/web`) keeps running and reads the **same** `BusinessContext`/settings, so config changes (e.g. `cod_enabled`) reflect in both. (Admin app vs. route-group is a minor Phase-1 call in [ROADMAP.md](04-ROADMAP.md).)

---

## §4 — RBAC upgrade (Decision A4)

Today: a coarse `owner`/`staff` enum with owner-only gates hardcoded per route. For a generic platform we move to **permission-based RBAC**, configurable per business.

### 4.1 Model

```
permissions (catalog)      roles (per business)        role_permissions
  resource:action            system presets + custom      (role ↔ permission)
  e.g. orders:refund         Owner/Admin/Manager/           admin_users.role_id → roles
       products:publish      Staff/Viewer
       settings:write
```

- **Permission** = `resource:action` string (`orders:read`, `orders:refund`, `products:write`, `products:publish`, `coupons:manage`, `customers:pii-view`, `settings:write`, `staff:manage`, `audit:read`, …). A flat, extensible catalog.
- **Role** = a named set of permissions. **System presets** (seeded, editable): `Owner` (all), `Admin`, `Manager`, `Staff`, `Viewer` (read-only). Businesses can create custom roles.
- **Back-compat:** the existing `owner`/`staff` map to the `Owner`/`Staff` presets; the migration is additive.
- **Enforcement (unchanged discipline):** middleware authenticates every `/api/admin/*` request; each mutation calls `ctx.can('orders:refund')` server-side; UI hides what the role can't do (cosmetic only). The **exhaustive authz checklist test** (every route × role) is extended to iterate permissions.
- **Owner-only invariants preserved:** last-owner guard, session rotation on privilege change, deactivation revokes sessions + releases claims.

### 4.2 Why not keep owner/staff

A coffee roaster needs a "warehouse" role that can adjust stock but not touch pricing; a restaurant needs a "kitchen" role. Two hardcoded tiers can't express that. Permission-based RBAC is table-stakes for "reusable across businesses."

---

## §5 — Configuration & feature-flag model (Phase 4)

Three tiers, in precedence order (highest wins):

1. **Boot config (env / `business/<id>/profile.ts`)** — values needed before a DB read or that ops controls: which DB, which vertical preset, infra flags (`real Shiprocket vs mock`, crons on/off). Immutable at runtime.
2. **`business_settings` (DB, admin-editable)** — the generalization of today's `store_settings`: namespaced key→jsonb, owner-editable, audited, cached, read through `BusinessContext.settings`. Holds brand, policy, capability toggles, module enablement.
3. **Vertical preset defaults** — the fallback when a setting is unset (so a fresh business is sensible out of the box).

**Feature flags** are just settings: `module.<key>.enabled`, `capability.<key>.enabled`, plus `flag.<name>` for rollout toggles. The **module registry** reads these to compose the admin nav/routes. Every flag has an owner and a removal ticket (existing hygiene rule).

```
business_settings
  namespace   text     -- 'brand' | 'commerce' | 'legal' | 'module' | 'capability' | 'flag'
  key         text
  value       jsonb
  updated_by  uuid → admin_users
  (namespace, key) unique   -- generalizes store_settings(key) PK
```

---

## §6 — Naming strategy (Decisions A2, A3)

- **New platform/admin code** uses the neutral scope **`@platform/*`** (placeholder — swap for your chosen product name) and **no** business words. Cookie/prefix/brand values come from `BusinessProfile`, never literals.
- **Existing storefront packages** (`@kakoa/core`, `db`, `ui`, `config`, `integrations`; 92 importing files) are **left named as-is for now** and renamed in a dedicated, mechanical, fully-verified phase ([ROADMAP.md](04-ROADMAP.md) Phase P) — to avoid destabilizing a launched storefront for no functional gain.
- **Rename mechanics (when we do it):** it's a pure find-replace of the scope + `package.json` names + `next.config.ts` `transpilePackages` + import specifiers, guarded by typecheck/test/build. Low logical risk, high file count — hence its own phase.

---

## §7 — How this satisfies the brief

| Brief requirement | Where it's addressed |
|---|---|
| Modular architecture | §3 layers; §5 module registry; [03](03-STRUCTURE-AND-CONVENTIONS.md) module manifests |
| Reusable components | `@platform/admin-ui` (shadcn/TanStack shells); shared kernel services |
| Generic business logic | L1 commerce domain; capability-gated, not vertical-branched (§2.3) |
| Feature-based modules | §5; [02](02-CORE-MODULES.md) module catalog |
| Configurable settings | §5 three-tier config; Business Profile (§2.1) |
| Multi-product support | Vertical presets (§2.2) + attribute schema (§2.4) |
| Future scalability | `BusinessContext` seam → shared multi-tenancy later (§1.2) |
| No hardcoded business rules | §2 (profile/preset/capability), §2.4 attributes, §6 naming; de-hardcoding tracked in ROADMAP Phase P |
| Enable/disable modules without code changes | §5 feature flags + module registry |
| Plugin-style architecture | module manifests + registry ([03](03-STRUCTURE-AND-CONVENTIONS.md)) |
| Shared business services | L0 kernel + L1 domain services |
