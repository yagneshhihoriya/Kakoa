# 04 — Implementation Roadmap

Covers **Phase 6**. Sequenced so **Kakao becomes operable early** while the platform stays generic. Nothing here is built until the [README](README.md) decisions are approved. Every phase: typecheck + tests + build green + a live check, no storefront regression.

**Sequencing principle:** build the *kernel generically first*, then light up modules in order of operational value to Kakao. The multi-business proof (a second vertical) comes after the modules exist — you can't prove reusability before there's something to reuse.

---

## Phase 0 — Platform kernel foundation
**Scope:** the reusable spine, no business features yet.
- `@platform/kernel`: `BusinessContext` + config resolver (3-tier §5), module **registry**, error envelope, rate-limit class E, admin auth/session (build the specced `admin_users`/`admin_sessions` OTP flow), audit-in-tx helper.
- **RBAC upgrade (A4):** `permissions`/`roles`/`role_permissions` schema + system presets; migrate `owner`/`staff` → presets (additive); `ctx.can()`.
- **`business_settings`** (generalize `store_settings`, namespaced) + migration/compat shim so the storefront keeps reading its keys.
- `@platform/admin-ui`: shadcn/ui + TanStack shells (`DataTable`, `EntitySheet`, `ConfirmDialog`, `StatusBadge`, `CommandPalette`).
- `apps/admin` shell: login, layout, registry-driven nav, authz middleware, empty module slots.

**Dependencies:** none (foundational). Reuses existing admin schema, rate-limit, OTP infra.
**Deliverables:** admin login works; an empty but composable admin shell; RBAC + audit + settings generalized with back-compat; authz test harness (route × permission).
**Risks:** RBAC migration must not break existing owner/staff assumptions → additive + presets + tests. `business_settings` migration must not break storefront reads → compat view/shim, verify storefront green.
**Extensibility unlocked:** every later module just `registerModule()`s; new permissions auto-surface; new settings sections auto-render.

---

## Phase 1 — Operational core (make Kakao runnable)
**Scope:** the modules an operator needs day one.
- **Dashboard** (metrics + widget registry), **Orders** (list/detail/transitions/refunds/COD queue — reuses this-session's refund path), **Products** (CRUD + dynamic attribute form + publish gates + Media picker), **Categories** (admin-managed taxonomy), **Inventory** (ledger adjustments + low-stock).
- **Media Library** (needed by Products) + **Settings** (Business Profile editor, capability/module toggles).

**Dependencies:** Phase 0. Reuses `admin-orders/-catalog-inventory/-dashboard.md`, existing schema, order state machine.
**Deliverables:** Kakao can be run entirely from the admin — add products, manage stock, process orders, issue refunds, confirm COD, edit settings. First real end-to-end operability.
**Risks:** Products attribute-schema abstraction risks over-design → ship chocolate preset's fixed attributes first, generalize the renderer, validate with a 2nd preset in Phase 4. Publish gates must stay capability-aware.
**Extensibility unlocked:** attribute schema proven; widget/settings registries populated.

---

## Phase 2 — Customer, money & engagement
**Scope:** **Customers** (detail/block/PII-audit/DPDP), **Promotions & Coupons** (CRUD + high-value guard + stats), **Payments** (records/refund reconciliation surface — reuses the payment-ledger work), **Reviews** (moderation, optional), **Notifications** (templates + delivery log), **Users & Roles / Permissions** admin UI.

**Dependencies:** Phase 0–1.
**Deliverables:** full customer ops, discounting, payment/refund visibility, review moderation, staff & role administration in-UI.
**Risks:** PII exposure → PII-view auditing + owner gates (already specced). Promotion engine kept minimal (coupons) with a `PromotionType` registry seam for later types.
**Extensibility unlocked:** `PromotionType` registry; permission catalog fully exercised by real roles.

---

## Phase 3 — Fulfilment, tax, insight & content
**Scope:** **Shipping & Fulfilment** (carrier config/serviceability/AWB/NDR/RTO — capability-gated), **Taxes** (regime config; India GST as first regime), **Analytics & Reports** (trends + exports), **Content Management** (editable pages/banners/copy → removes hardcoded storefront copy), **Audit Logs** + **Activity History** surfaces.

**Dependencies:** Phase 0–2; Shipping needs the Shiprocket integration (mock → real flag).
**Deliverables:** end-to-end fulfilment ops, configurable tax regime, business intelligence + exports, CMS for storefront content, full compliance/audit surfaces.
**Risks:** Tax generalization scope-creep (VAT/US) → implement India GST regime only; document the `TaxRegime` interface for future regimes. Shipping depends on carrier availability.
**Extensibility unlocked:** `TaxRegime` + `ShippingProvider`/zones abstractions; content model for any storefront.

---

## Phase 4 — Multi-business enablement (prove reusability)
**Scope:** make "another business with minimal effort" real.
- `@platform/verticals`: the **preset** system + **capability** implementations wired end-to-end (fields/UI/validation gate on capabilities across all modules).
- `seed(businessId, preset)` — preset-driven demo data; Kakao's data becomes the chocolate-preset fixture.
- **Proof:** stand up a **second vertical** (e.g. a bakery or coffee demo instance) from config alone — new Business Profile + preset + branding, **zero module code changes** — and run it through the admin.
- Provisioning script/runbook for onboarding a new business (own DB + config).

**Dependencies:** Phase 0–3 (modules must exist to be reused).
**Deliverables:** a documented, repeatable "new business in minimal steps" path + a working non-chocolate demo that validates no hardcoding leaked.
**Risks:** hidden chocolate/India assumptions surface here → the CI grep-gate + the second-vertical smoke test are the safety net; fix leaks as found.
**Extensibility unlocked:** the actual multi-business value; onboarding runbook.

---

## Phase P — Storefront de-hardcoding & rename (parallelizable / later)
**Scope (Decision A6 — separate track so a launched storefront isn't regressed):**
- Move brand/copy from components → Content/config (agent inventory §3G); `tone`/food fields → chocolate-preset attributes + `veg-mark` capability; cookie/prefix/brand literals → Business Profile.
- **Package rename** `@kakoa/*` → `@platform/*` (A2) as a mechanical, fully-verified pass (~114 files; find-replace + `package.json` + `transpilePackages` + imports; guarded by typecheck/test/build).

**Dependencies:** can run alongside Phases 1–4; the rename is best done in one atomic verified PR.
**Deliverables:** the storefront is as generic as the admin; naming is uniformly neutral.
**Risks:** rename churn on a live app → its own PR, no logic changes, green gate before merge.
**Extensibility unlocked:** a fully white-label storefront to match the platform admin.

---

## Sequence & dependency view

```
Phase 0 (kernel: RBAC, registry, settings, admin shell, audit)
   │
   ├──▶ Phase 1 (Dashboard, Orders, Products, Categories, Inventory, Media, Settings)  ← Kakao operable
   │        │
   │        ├──▶ Phase 2 (Customers, Coupons, Payments, Reviews, Notifications, Users/Roles UI)
   │        │        │
   │        │        └──▶ Phase 3 (Shipping, Taxes, Analytics/Reports, Content, Audit/Activity)
   │        │                 │
   │        │                 └──▶ Phase 4 (verticals + presets + 2nd-vertical proof + onboarding)
   │
   └───────────────────────────────  Phase P (de-hardcode + rename)  ── parallel, merge when green
```

---

## Cross-phase risk register

| Risk | Phase | Mitigation |
|---|---|---|
| Multi-tenant retrofit demanded later | any | `BusinessContext` + data-access seam designed for it now (§1.2) — additive, not a rewrite |
| Over-abstraction (YAGNI) | 1, 4 | Ship chocolate concretely first, generalize with the 2nd-vertical test as the forcing function |
| Storefront regression from generalization | 0, P | Compat shims + green gate + live check every phase; storefront changes isolated to Phase P |
| Hidden chocolate/India assumptions | 4 | CI grep-gate (no business literals in `@platform/*`) + second-vertical smoke test |
| RBAC/settings migration breakage | 0 | Additive migrations + presets + back-compat reads + tests |
| Scope creep (tax regimes, currencies, restaurant vertical) | 3, 4 | Interfaces documented now, only India-GST + food/retail verticals implemented; rest are future capabilities |

---

## What "done" looks like

An operator can run **Kakao** entirely from the admin (Phases 1–3), and a new food/retail business can be stood up from **config + a preset** with no module code changes (Phase 4) — on a codebase where the platform packages contain **zero** business-specific literals, roles/permissions are business-configurable, modules enable/disable via settings, and the whole thing is architected to become shared-multi-tenant later without a rewrite.

**Next step after your review:** on sign-off of the [README](README.md) decisions, I'll expand each Phase-0/1 module into a field-level spec (the 10-section template used in `docs/modules/`) and begin Phase 0.
