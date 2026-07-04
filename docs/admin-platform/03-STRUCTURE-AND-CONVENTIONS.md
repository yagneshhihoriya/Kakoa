# 03 — Folder Structure, Module Manifests & Conventions

Covers **Phase 5**. Proposed structure uses the placeholder scope `@platform/*` (Decision A3 — rename to your product name).

---

## §1 — Monorepo structure (proposed)

Additive to the current Turborepo. New packages/apps are marked ✦; existing evolve in place.

```
kakoa/  (repo root — rename later, Phase P)
├── apps/
│   ├── web/                      # storefront (exists) — reads BusinessContext/settings
│   └── admin/               ✦    # admin portal (Next.js) — composed from the module registry
│       ├── src/app/(admin)/      # route groups; per-module route folders mounted by registry
│       ├── src/modules/          # thin per-module UI (imports platform services)
│       └── business/<id>/        # L3 instance config (profile, preset selection, branding)
│
├── packages/
│   ├── kernel/              ✦    # L0: auth, RBAC, audit, config/BusinessContext, jobs,
│   │                             #      notifications, rate-limit, error-envelope, module registry
│   ├── data/               ✦    # L0: Drizzle schema + data-access layer (tenant-scope seam)
│   ├── admin-ui/           ✦    # L0: shadcn/ui + TanStack Table shells, reusable admin components
│   ├── verticals/          ✦    # L2: presets + capability implementations
│   ├── core/                     # L1: enums, money, state machines, contracts  (today @kakoa/core)
│   ├── integrations/             # L1: Payment/Sms/Email/Shipping/Media providers  (today @kakoa/integrations)
│   ├── ui/                       # storefront design system (today @kakoa/ui) — storefront-only
│   └── config/                   # env schema (today @kakoa/config) — folds into kernel/config over time
│
├── docs/
│   ├── admin-platform/           # THIS suite
│   ├── modules/                  # existing field-level module specs (source of truth to build on)
│   └── ...
└── PROJECT_PLAN.md               # existing master plan (Kakao storefront)
```

> **Admin app vs. route group** (minor, decided at Phase A1): a separate `apps/admin` is cleaner (own deploy, own auth cookie scope, no storefront bundle bloat) and is the recommendation. The alternative — an `/admin` route group inside `apps/web` — is simpler to start but couples deploys. Either way the module registry + kernel are identical.

---

## §2 — The module manifest (plugin contract)

Every admin module is a self-describing package/folder that exports a manifest. The registry composes enabled manifests into nav, routes, permissions, and dashboard widgets. **This is the plugin system.**

```ts
// packages/kernel/src/registry/types.ts
export interface AdminModule {
  key: ModuleKey;                       // 'orders', 'products', 'reviews', ...
  title: string;                        // display name (i18n key)
  group: 'kernel' | 'commerce' | 'content' | 'insight';
  order: number;                        // nav ordering

  enabledByDefault: boolean;            // registry default; overridable by business_settings
  requiresCapabilities?: Capability[];  // module hidden unless ALL are enabled
  requiresPermissions: Permission[];    // minimum to see the module at all

  nav: NavItem[];                       // sidebar entries (each with its own permission)
  routes: RouteDef[];                   // /admin/... pages this module mounts
  api?: ApiRouteDef[];                  // /api/admin/... handlers this module owns
  permissions: PermissionDef[];         // permissions this module CONTRIBUTES to the catalog
  widgets?: DashboardWidget[];          // cards contributed to the Dashboard
  settingsSchema?: SettingsSection[];   // sections contributed to Settings
}
```

Registration:
```ts
// packages/kernel/src/registry/index.ts
registerModule(ordersModule);
registerModule(productsModule);
// ...
// composeAdmin(businessContext) → { nav, routes, api, permissionCatalog, widgets }
//   filters each module by: enabledByDefault ⊕ settings override, capabilities, and the
//   acting admin's permissions. Adding a module = one registerModule() call; nothing else.
```

**Enablement resolution (per business, per request):**
```
module visible  ⟺  (business_settings['module.<key>.enabled'] ?? enabledByDefault)
                    AND requiresCapabilities ⊆ ctx.capabilities
                    AND ctx.can(some nav item's permission)
```

---

## §3 — Naming conventions (binding)

| Thing | Convention | Example |
|---|---|---|
| Platform packages | `@platform/<kebab>` — **never** a business word | `@platform/kernel` |
| Module keys | singular-ish kebab, stable | `orders`, `product`, `coupon` |
| Permissions | `resource:action` (colon), lowercase | `orders:refund`, `settings:write` |
| Capabilities | kebab, feature-named | `veg-mark`, `cold-chain` |
| Settings keys | `namespace.key` (dot) | `commerce.cod_enabled`, `brand.name` |
| Audit actions | `{domain}.{action}` | `order.transition`, `coupon.create` |
| DB tables | snake_case plural | `admin_users`, `business_settings` |
| Cookies | `<prefix>_<name>` — prefix from Business Profile | `<prefix>_admin` |
| React components | PascalCase; admin-generic in `@platform/admin-ui` | `DataTable`, `EntitySheet` |
| Business/brand strings | **only** in `business/<id>/` config or DB — never in `@platform/*` | — |

**The one hard rule:** grep for `kakao`/`chocolate`/`cocoa`/`fssai`/`hsn` in `@platform/*` and `apps/admin/src/modules/*` must return **zero** (CI grep-gate). Those live only in config/DB/preset.

---

## §4 — Coding standards (inherited + extended)

Carried over from the existing codebase (already enforced) — these are non-negotiable and apply to admin:

1. **TypeScript strict**, no `any` in domain code; `.strict()` zod on every API body.
2. **Error envelope** everywhere: `ApiOk<T>{ok,data,meta}` / `ApiErr{ok,error{code,message,fieldErrors?}}`. Registry error codes only.
3. **Money = integer (paise/minor units)**, never floats; format via the money core using the business's currency.
4. **Drizzle parameterized queries only** — no string-built SQL.
5. **Server-authoritative authz** — `ctx.can(permission)` in every mutation; UI gating is cosmetic; the exhaustive route×role/permission authz test is CI-gated.
6. **Audit-in-transaction** — every mutating admin action writes exactly one `admin_audit_log` row in the same tx; audit table is append-only (no UPDATE/DELETE grant).
7. **Optimistic concurrency** — money/state-bearing PATCHes carry `updatedAt`; `WHERE updated_at = $version`; zero rows → `409 CONFLICT` with current entity.
8. **DB-backed sessions**, hashed tokens at rest, 12h admin lifetime, revocation within one request; admin cookie scoped to `/admin`,`/api/admin`.
9. **Admin reads uncached** (`Cache-Control: no-store`); dashboard metrics 60s in-process cache; storefront invalidation via `revalidateTag` on catalog mutations.
10. **Rate-limit class E** on `/api/admin/*`; CSV/exports owner-gated + capped.
11. **Never log** session tokens, OTP codes, pepper, full PII, signed URLs, payout details.
12. **No business literals in platform code** (§3 hard rule).

New for the platform:

13. **Config over branch** — read `ctx.settings`/`ctx.capabilities`; never `if (businessType === 'chocolate')`.
14. **Capability-guard fields/UI** — a field tied to a capability is rendered and validated only when that capability is enabled.
15. **Modules are thin** — business logic lives in L1 domain services, not in `apps/admin/src/modules/*` (which is UI + orchestration).
16. **Provider interfaces for all externals** — payments, sms, email, shipping, media, storage. No vendor import outside its provider package.

---

## §5 — Development guidelines

- **Contract-first:** a module's contracts (zod schemas, types) land in `@platform/core`/module contracts before its UI/handlers — mirrors the existing lane discipline.
- **One owning doc per behavior:** cross-link, don't duplicate (existing rule). Admin-platform docs reference the field-level `docs/modules/*` specs rather than restating them.
- **Additive migrations:** new tables/columns are additive; RBAC/settings generalizations keep back-compat (owner/staff → presets; `store_settings` → `business_settings` view/migration).
- **Verify every phase:** typecheck + tests + build green, plus a live check, before the next phase — and never regress the launched storefront.
- **Feature flags have owners + removal tickets;** flags older than 3 weeks are reviewed.
- **Seed = preset-driven:** `seed(businessId, preset)` — no hardcoded product/category/coupon lists in platform seed; Kakao's demo data becomes a chocolate-preset fixture.
- **Definition of Done (per module):** manifest registered; permissions contributed; authz test rows added; audit rows verified; capability gating tested (on & off); docs updated; live-verified.
