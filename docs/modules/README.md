# KAKOA — Module Spec Index

> How these docs relate to the plan: **`PROJECT_PLAN.md` is the master plan** — §1 decision record, §2 lanes, §3.0 the binding Contract v1.0.0 (full DDL + API), §3.1–§3.14 one planning section per module, §4 cross-cutting concerns. The docs in this folder are the **field-level implementation specs** referenced from PROJECT_PLAN §3: exact regexes, error messages, transition tables, index DDL, and mermaid diagrams. Where a module doc and the Contract disagree, **the Contract wins** and the module doc gets a PR.
>
> **The 10-section template.** Every module spec follows the same skeleton: 1. Field-Level Specification · 2. Workflow / User Flow · 3. System Design · 4. Database Schema · 5. API Design · 6. Security Standards · 7. Edge Cases · 8. State Machine · 9. Testing Requirements · 10. Definition of Done. Light docs (e.g. order-tracking, admin-customers) keep the numbering and mark sections N/A rather than dropping them.
>
> **The depth bar.** A module doc is done when a dev in the owning lane can implement without opening a vendor dashboard or asking clarifying questions: every field has a validation rule and an exact user-facing error message; every endpoint has its envelope, auth tier, and rate class; every state machine has a complete transition table; vendor facts are either verified-with-date or explicitly marked "verify at integration." Cross-module behavior is **cross-linked, never duplicated** — each behavior has exactly one owning doc.

Owning lanes are per PROJECT_PLAN §2.1: **A** Storefront & SEO · **B** Platform, DB & Core Domain · **C** Payments & Checkout · **D** Fulfillment & Admin · **E** QA, DevOps & CI (floating, second reviewer on webhooks/migrations).

---

## Phase 0 — Foundations & Contract (Weeks 1–2)

| Doc | Scope | Lane | Key tables | State machine? |
|---|---|---|---|---|
| [design-system.md](design-system.md) | `packages/ui` tokens + primitives (Ink/Cocoa/Espresso/Cream, pill buttons, chips, stars, toasts); presentational-only, lint-enforced | A | — | No |
| [webhooks-jobs-infrastructure.md](webhooks-jobs-infrastructure.md) | Webhook intake (persist-then-ack, raw-body HMAC), Inngest durable jobs, reconciliation crons, dead-man switches | B (infra) + C/D (processors), E reviews | `webhook_events` | Yes — event processing lifecycle |

## Phase 1 — Catalog, Browse & Mocked Checkout (Weeks 3–5)

| Doc | Scope | Lane | Key tables | State machine? |
|---|---|---|---|---|
| [product-catalog.md](product-catalog.md) | Storefront catalog + `pg_trgm` search, ISR/`revalidateTag`, slugs, FSSAI display | A (UI) + B (data) | `categories`, `products`, `product_variants`, `product_images` | No |
| [cart.md](cart.md) | Guest cookie carts, merge on login, optimistic UI; lines reprice on every read | A (UI) + B (data) | `carts`, `cart_items` | No |
| [auth-otp.md](auth-otp.md) | OTP request/verify, sessions, cart merge + guest-order attach; shared `otp_challenges` code paths for COD/lookup/admin purposes | B | `customers`, `customer_sessions`, `otp_challenges` | No |
| [customer-accounts.md](customer-accounts.md) | Post-login profile, address book, account reads (orders, returns, wishlist); Phase 1–2 | B (backend) + A (UI) | `customers`, `customer_addresses` | No |
| [checkout.md](checkout.md) | 4-step checkout, serviceability, quote, placement transaction, verify, retry-payment; Phase 1–2 | C (B co-owns state-machine PRs) | `orders`, `order_items`, `coupon_redemptions` | Feeds it — machine owned by [order-management.md](order-management.md) |
| [content-blog-seo.md](content-blog-seo.md) | MDX journal, static/legal pages, JSON-LD, sitemap, OG (SEO pass lands Phase 2) | A | — (MDX in-repo) | No |

## Phase 2 — Order Lifecycle, COD & Money Truth (Weeks 6–8)

| Doc | Scope | Lane | Key tables | State machine? |
|---|---|---|---|---|
| [order-management.md](order-management.md) | **The normative 11-state order machine**, transition table, status history, admin transitions | B + C (D review; Order Council governance) | `orders`, `order_status_history` | **Yes — the canonical one** |
| [payments-razorpay.md](payments-razorpay.md) | Razorpay prepaid: order/capture, payment webhooks, refund execution, reconciliation crons | C (E second reviewer) | `payments`, `refunds`, `webhook_events` | Yes — payment + refund lifecycles |
| [cod.md](cod.md) | COD lifecycle: OTP-verified placement, confirmation queue, remittance matching, RTO loss | C (lifecycle/crons) + D (queue UI) | `orders`, `payments` | Yes — 4-state COD payment lifecycle |
| [coupons.md](coupons.md) | Redemption path, atomic exhaustion, discount allocation engine in `packages/core` | C (redemption) + D (admin CRUD) | `coupons`, `coupon_redemptions` | No |
| [shipping-fulfillment.md](shipping-fulfillment.md) | Shiprocket pipeline: push/AWB/label/pickup, tracking webhook + poller, NDR/RTO, serviceability; mock → real flag flip in Phase 3 | D | `shipments`, `shipment_events` | Yes — monotonic shipment states |
| [order-tracking.md](order-tracking.md) | Customer-facing lookup (guest via OTP), tracking page reads, pre-dispatch cancel; light doc | C + D + A | `orders`, `shipments`, `shipment_events`, `otp_challenges` | No — consumes order/shipment machines |
| [returns-refunds.md](returns-refunds.md) | Item-level return requests with photo evidence, admin decisioning, refund/replace resolution; perishable-first policy | D (flow) + C (refund execution) | `return_requests`, `return_request_items`, `refunds` | Yes — return-request lifecycle |
| [reviews.md](reviews.md) | Post-purchase trigger, moderation queue, PDP display + JSON-LD; ships dark behind `reviews_visible` | D (moderation) + A (display) + B (schema) | `reviews` | Yes — moderation states |
| [emails-notifications.md](emails-notifications.md) | Resend integration, lifecycle email jobs, idempotent sends, no-email guests skipped | D (C reviews payment emails) | — (reads `orders` etc.) | No |
| [wishlist.md](wishlist.md) | Product-level hearts, `toggleWishlist`, account wishlist read; no anonymous persistence | B (backend) + A (UI) | `wishlist_items` | No |

## Admin (Phase 1–2 per doc)

| Doc | Scope | Lane | Key tables | State machine? |
|---|---|---|---|---|
| [admin-staff-roles.md](admin-staff-roles.md) | Admin email-OTP auth, sessions, owner⊇staff matrix, append-only audit log, exhaustive authz test; Phase 1 auth → Phase 2 staff UI | B (auth) + D (panel routes) | `admin_users`, `admin_sessions`, `admin_audit_log` | No |
| [admin-catalog-inventory.md](admin-catalog-inventory.md) | Products/variants/images CRUD, publish validation, delta-only inventory ledger, CSV import; Phase 1 | D (UI/routes) + B (schema) | `products`, `product_variants`, `product_images`, `inventory_adjustments` | No |
| [admin-dashboard.md](admin-dashboard.md) | Read-only metrics endpoint, IST-calendar ranges, 60 s cache, zero-orders alert; Phase 2 | D | — (reads `orders`, `payments`) | No |
| [admin-orders.md](admin-orders.md) | Orders ops, COD confirmation queue UI, RTO/NDR/exceptions views, audited mutations; Phase 2 | D | `orders`, `order_status_history`, `payments`, `shipments` | No — drives the order machine |
| [admin-coupons.md](admin-coupons.md) | Coupon CRUD, redemption stats, owner guard on high-value coupons, leak-velocity alert; Phase 2 | D (owner-gated) | `coupons`, `coupon_redemptions` | No |
| [admin-customers.md](admin-customers.md) | Customer search/detail, block/unblock, PII-access audit, DPDP export/delete hooks; light doc; Phase 2 | D | `customers` | No |

All 24 files in this directory are listed above — if you add a module doc, add its row here in the same PR.

---

## Cross-cutting pointers

- [../DATABASE_ERD.md](../DATABASE_ERD.md) — canonical ERD + per-table specs (§3.x anchors used by every module doc)
- [../SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) — master topology, golden path, money-critical data flows, failure modes
- `PROJECT_PLAN.md` **§3.0** — the Contract v1.0.0 (full DDL + API envelope + error-code registry): the binding source every doc anchors to
- `PROJECT_PLAN.md` **§4** — cross-cutting concerns that apply to every module: CI/CD gates (§4.1), environments matrix (§4.2), monitoring & dead-man switches (§4.3), design-system rules (§4.4), security baseline (§4.5), backup/recovery (§4.6), launch-gate checklist (§4.7)
