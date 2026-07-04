# Admin Platform — Architecture & Planning Suite

**Status: PROPOSAL — awaiting review & sign-off. No admin code will be written until the §Decisions below are approved.**

> **Goal.** Build a **generic, reusable, enterprise-grade Admin Platform** that powers Kakao Chocolate today but can run any e-commerce business — chocolate, bakery, coffee, tea, snacks, grocery, restaurant, food delivery, organic, gifts, general retail — with **configuration, not code changes**. Business specifics are data; the platform is the engine.

This folder is the **plan**. It is written *before* implementation, exactly as requested, and is the artifact to review. It sits above the existing `PROJECT_PLAN.md` (which planned the Kakao-specific admin) and re-frames the admin as a **platform**.

---

## The documents

| # | Doc | Covers | Your brief's phases |
|---|---|---|---|
| — | **README** (this file) | Index + **decisions needing sign-off** | — |
| 01 | [ARCHITECTURE.md](01-ARCHITECTURE.md) | Layered architecture, tenancy/reuse model, Business Profile + Vertical Presets + Capabilities, module registry, RBAC upgrade, config model, naming strategy, de-hardcoding plan | Phase 1, 2, 4 |
| 02 | [CORE-MODULES.md](02-CORE-MODULES.md) | The 20 core admin modules — generic specs, required capabilities, universal vs. optional, extension points | Phase 3 |
| 03 | [STRUCTURE-AND-CONVENTIONS.md](03-STRUCTURE-AND-CONVENTIONS.md) | Folder/package structure, module-manifest schema, naming conventions, coding standards, dev guidelines | Phase 5 |
| 04 | [ROADMAP.md](04-ROADMAP.md) | Phased implementation plan — scope, dependencies, deliverables, risks, extensibility per phase | Phase 6 |

---

## What already exists (so we build on it, not over it)

The current codebase is **~80% of a reusable platform already** — it was built with clean seams. Verified during this review:

- **Generic foundation (keep as-is):** the 11-state order state machine, provider interfaces (`PaymentProvider`/`SmsProvider`/`EmailProvider`/`ShippingProvider`), money-as-integer-paise core, all enums, the append-only audit log, DB-backed sessions, rate-limit classes, the error envelope, optimistic-concurrency pattern.
- **Config-driven already:** `store_settings` (key→jsonb) holds 15 business-config values (fees, COD toggle, GST id, FSSAI, support contact) — this is the seed of the Business Profile.
- **Admin foundation already specced/schema'd:** passwordless email-OTP `admin_users`, separate 12h `admin_sessions`, `admin_audit_log` (action/entity/before/after), 6 admin module specs, and the shadcn/ui + TanStack Table decision.
- **Business-specific (must be generalized):** `@kakoa/*` package names (92 app files import them), chocolate product fields (`tone`, `isVeg`, HSN `1806`, GST 5%), category/product/coupon seed data, brand copy, `kakoa_*` cookie names.
- **India-market (keep — not chocolate-specific):** GST/IGST + state codes, pincode serviceability, INR/paise, `+91` phone. A multi-business platform that is still India-only keeps these; generalizing *country* is a separate, later concern (documented, not in scope now).

The upshot: this is a **de-hardcoding + module-system + RBAC-upgrade effort**, not a rewrite.

---

## Decisions needing your sign-off

These shape every downstream doc and the schema. My recommendation is in **bold**; rationale is in [01-ARCHITECTURE.md](01-ARCHITECTURE.md).

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **A1** | **Reuse / tenancy model** | (a) Reusable platform, **one deployment + one DB per business**, config-driven, *designed* so shared multi-tenancy can be added later · (b) Full multi-tenant SaaS now (shared DB + `business_id` on every table + row-level security) | **(a).** True multi-tenancy is a large, risky retrofit on a verified single-tenant build with **one** business today; separate DBs give clean PII/compliance isolation across unrelated brands; we build a `BusinessContext` seam so (b) can be layered later without rearchitecting. §1 |
| **A2** | **Package naming** | (a) Rename `@kakoa/*` → a neutral platform scope **now** (touches ~114 files) · (b) Build the new platform/admin layer under a neutral scope now; **rename the storefront packages later** in a dedicated mechanical pass | **(b).** Don't destabilize the verified storefront for zero functional gain; introduce generic naming for the new code; schedule the rename as its own verified phase. §6 |
| **A3** | **Platform name / scope** | Need a neutral name for the platform packages & product (e.g. `@platform/*`, `@commerce/*`, or a product brand you choose) | **Placeholder `@platform/*`** used throughout these docs; tell me the real name and I'll swap it. §6 |
| **A4** | **RBAC model** | (a) Keep coarse `owner`/`staff` enum · (b) Upgrade to **permission-based RBAC** — roles = sets of granular `resource:action` permissions, configurable per business, with system presets (Owner/Admin/Manager/Staff/Viewer) | **(b).** A generic platform needs granular, business-configurable roles; keep owner/staff as seeded presets for back-compat. §4 |
| **A5** | **Product model genericity** | (a) Keep chocolate columns (`tone`, `isVeg`, cocoa notes) · (b) **Universal core columns + a configurable per-business attribute schema** (JSONB `attributes` + attribute definitions), with food fields behind capabilities | **(b).** Bakery/coffee/grocery need different attributes; core stays universal, verticals define their own. §2 |
| **A6** | **Scope of THIS effort** | (a) Plan + build the **new generic Admin Platform** (leave the storefront as-is, wire it to the same config) · (b) Also refactor the storefront to fully generic now | **(a) now, (b) later.** Ship the admin platform generically; the storefront de-hardcoding (copy/CMS, tone→attributes, rename) is a separate tracked phase so we don't regress a launched storefront. §5 (ROADMAP) |

If you approve these as-is, I'll proceed to the detailed per-module specs and then implementation per the roadmap. If you want to change any (especially **A1**, **A3**, **A4**), tell me which and I'll revise the affected docs before writing code.

---

## Guiding principles (binding once approved)

1. **Config over code.** Anything that differs between businesses is data (Business Profile, settings, attribute schema, feature flags) — never a hardcoded `if (chocolate)`.
2. **Capability-gated, not vertical-branched.** Modules ask for *capabilities* (`perishable`, `veg-mark`, `cold-chain`), never for a business type. A restaurant and a bakery enable different capabilities, not different code paths.
3. **Thin modules, thick kernel.** The platform kernel (auth, RBAC, audit, config, data-access, jobs, notifications) is rich and shared; feature modules are small and composable.
4. **Server-authoritative security.** Every permission is enforced server-side per action; UI gating is cosmetic. Every mutation is audited in the same transaction.
5. **Nothing business-named in platform packages.** No "kakao"/"chocolate" in `@platform/*`. Brand/vertical live only in the business instance config.
6. **Additive, reversible, verified.** Each phase ships independently, is typecheck/test/build-green + live-verified, and never regresses the launched storefront.
