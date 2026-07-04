# 02 — Core Admin Modules

Covers **Phase 3**. Every module is **generic** (no business type in its code), **capability-gated** where it touches vertical specifics, and **registry-registered** so it can be enabled/disabled per business via config.

**Legend** · **Universal** = every business gets it. **Capability-gated** = renders/behaves per enabled capabilities. **Optional** = off by default, enabled per business. · **Reuses** = existing spec/schema to build on (from `PROJECT_PLAN.md` / `docs/modules/`).

Each module ships as a manifest (see [03](03-STRUCTURE-AND-CONVENTIONS.md)):
```ts
{ key, title, group, requiresCapabilities?, requiresPermissions, nav, routes, enabledByDefault }
```

---

## Group A — Platform kernel modules (L0)

### 1. Dashboard  · Universal
- **Purpose:** at-a-glance operational health — revenue trio (captured / COD-collected / refunded), order-status breakdown, AOV, queue depths (pending confirmations, reviews, returns), top products, low-stock count, business alerts.
- **Generic:** metric labels are neutral (`monetaryValue`, not `revenuePaise`); currency/format from Business Profile; widgets render per enabled modules (no Reviews module → no reviews-queue widget).
- **Reuses:** `admin-dashboard.md` (60s cache, IST ranges, zero-orders alert) — generalize the metric compute + widget registry.
- **Permissions:** `dashboard:read`.
- **Extension point:** widget registry — modules contribute dashboard cards.

### 2. Users & Roles  · Universal
- **Purpose:** manage admin users (invite via email-OTP, activate/deactivate), assign roles, manage sessions ("log out everywhere").
- **Generic:** already business-agnostic. Adds role assignment on top of the existing `admin_users`.
- **Reuses:** `admin-staff-roles.md`, `admin_users`, `admin_sessions`. Last-owner guard, session rotation, deactivation side-effects preserved.
- **Permissions:** `staff:manage` (Owner/Admin).

### 3. Permissions & Roles  · Universal
- **Purpose:** define roles as sets of granular permissions; system presets (Owner/Admin/Manager/Staff/Viewer) + custom roles per business (Decision A4).
- **Generic:** the permission catalog is `resource:action`; modules register their permissions into it, so new modules automatically appear here.
- **New schema:** `permissions`, `roles`, `role_permissions` (or roles.permissions jsonb[]); `admin_users.role_id`.
- **Permissions:** `roles:manage` (Owner).
- **Extension point:** every module declares the permissions it needs → auto-listed here.

### 4. Settings  · Universal (sections capability-gated)
- **Purpose:** edit the Business Profile & policies — brand (name/logo/theme/contacts), commerce (fees, COD toggle, thresholds), legal/identity (tax id, licences, address), identifiers, locale/market, module & capability enablement, vertical preset selection.
- **Generic:** dynamic form driven by a settings schema; sections render per capability (e.g. FSSAI section only if `veg-mark`/`perishable`; GST section only if `tax-inclusive`).
- **Reuses:** `store_settings` → `business_settings` (namespaced). Owner-only for legal/identity keys; audited.
- **Permissions:** `settings:read`, `settings:write`.

### 5. Media Library  · Universal
- **Purpose:** upload, browse, and reuse images/files (product photos, banners, brand assets) with alt text; served via signed URLs; EXIF-stripped.
- **Generic:** storage behind a `MediaProvider` interface (Supabase Storage today; S3/others later), mirroring the existing provider-interface pattern.
- **New:** `media_assets` table + `MediaProvider`. Reuses the return-photos signed-upload + magic-byte validation pattern from `returns-refunds.md`.
- **Permissions:** `media:read`, `media:write`.
- **Extension point:** any module (Products, Content) picks assets from here.

### 6. Notifications  · Universal
- **Purpose:** configure & observe outbound messages — email/SMS templates, events→channels mapping, delivery log; in-admin notification center for staff.
- **Generic:** built on the existing `EmailProvider`/`SmsProvider` interfaces; templates are data (per business), variables validated; channels toggle per business.
- **Reuses:** `emails-notifications.md`, the best-effort send pattern, idempotency keys.
- **Permissions:** `notifications:read`, `notifications:manage`.

### 7. Audit Logs  · Universal
- **Purpose:** immutable record of every mutating admin action (who/what/before/after/when); filter by actor/entity/action; the compliance surface.
- **Generic:** already generic (`{domain}.{action}` namespace). Append-only (no UPDATE/DELETE grant); audit write in the same tx as the mutation.
- **Reuses:** `admin_audit_log`, `admin-staff-roles.md` §audit.
- **Permissions:** `audit:read` (Owner).

### 8. Activity History  · Universal
- **Purpose:** per-entity timeline (this order / this product / this customer) assembled from audit log + domain history tables — the human-readable "what happened to X".
- **Generic:** a read-side projection over `admin_audit_log` + `order_status_history` + inventory ledger + shipment events. No new writes.
- **Distinction from Audit Logs:** Audit = global compliance list; Activity = entity-scoped narrative embedded in detail screens.
- **Permissions:** inherits the entity's read permission.

---

## Group B — Commerce domain modules (L1)

### 9. Orders  · Universal (fulfilment bits capability-gated)
- **Purpose:** list/filter/search orders; order detail; drive state transitions (via the order state machine); refunds; COD confirmation queue; NDR/RTO views & disposition; fulfilment-exception queue.
- **Generic:** the 11-state machine is already business-agnostic; COD queue renders iff `cod_enabled`; RTO/NDR iff `serviceability`/shipping present; refund flow uses `PaymentProvider.refund` (already built this session).
- **Reuses:** `admin-orders.md`, `order-management.md`, `cod.md`, `order-state-machine.ts`, the cancel/refund path.
- **Permissions:** `orders:read`, `orders:transition`, `orders:refund` (gated), `orders:cod-manage`.

### 10. Products  · Universal (attributes capability-gated)
- **Purpose:** product & variant CRUD, publish gates, dynamic attribute form (from the active attribute schema §2.4), images (via Media), pricing, SEO fields, soft-archive, bulk CSV import.
- **Generic:** core fields universal; vertical attributes rendered from `attributeSchema`; food fields (veg-mark, shelf-life) appear per capability; HSN/tax fields iff `hsn-codes`/`tax-inclusive`.
- **Reuses:** `admin-catalog-inventory.md`, `product-catalog.md`, optimistic-version conflict, publish validation, CSV import guardrails.
- **Permissions:** `products:read`, `products:write`, `products:publish` (gated).
- **Extension point:** attribute schema per business; the publish-gate rules read required attributes/capabilities.

### 11. Categories  · Universal
- **Purpose:** manage the category taxonomy (create/rename/reorder/nest/archive) — replaces the hardcoded 4 chocolate category seeds with an admin-managed tree.
- **Generic:** already generic table; add admin CRUD + ordering + optional nesting; starter taxonomy comes from the vertical preset (editable).
- **Reuses:** `categories` table, `product-catalog.md`.
- **Permissions:** `categories:manage`.

### 12. Inventory  · Universal (`variants`/stock)
- **Purpose:** stock levels, delta-only adjustments (never absolute SET) with reason ledger, low-stock alerts, per-batch/expiry tracking (iff `batch-expiry`), damage write-offs.
- **Generic:** the ledger + reason enum are universal; batch/FEFO fields render iff `batch-expiry`; cold-chain notes iff `cold-chain`.
- **Reuses:** `inventory_adjustments` ledger, idempotent `clientOpId`, `admin-catalog-inventory.md`.
- **Permissions:** `inventory:read`, `inventory:adjust`.

### 13. Customers  · Universal
- **Purpose:** search/list, customer detail (orders, addresses, LTV, RTO count), block/unblock, PII-view auditing, data-export/delete (DPDP/GDPR).
- **Generic:** already generic. PII view writes an audit row; block enforced at checkout.
- **Reuses:** `admin-customers.md`, `customers` schema.
- **Permissions:** `customers:read`, `customers:pii-view`, `customers:block`, `customers:data-request` (Owner).

### 14. Promotions & Coupons  · Universal
- **Purpose:** coupon CRUD (percent/flat, min-subtotal, per-customer limit, window, hard-cap), high-value guard, redemption stats, velocity alerts. Extensible to other promo types (BOGO, tiered) later.
- **Generic:** already decoupled from product; code alphabet + high-value thresholds move to settings (were chocolate-tuned).
- **Reuses:** `admin-coupons.md`, `coupons.md`, `coupons`/`coupon_redemptions`.
- **Permissions:** `coupons:read`, `coupons:manage` (Owner-gated for high-value).
- **Extension point:** a `PromotionType` registry (coupon today; BOGO/tiered/auto-discount later).

### 15. Reviews  · Optional (per business)
- **Purpose:** moderate post-purchase reviews (approve/reject), reply, feature; ratings roll-up gates on approval.
- **Generic:** already generic + already dark-launchable behind a flag. Module simply off for businesses that don't want reviews.
- **Reuses:** `reviews.md`, `reviews` schema.
- **Permissions:** `reviews:moderate`.

### 16. Payments  · Universal
- **Purpose:** payment records, capture/refund status, reconciliation surface, provider config (which gateway, keys via env), refund execution & tracking.
- **Generic:** behind `PaymentProvider`; Razorpay today, others pluggable; refund ledger reconciliation (built this session) surfaced here.
- **Reuses:** `payments-razorpay.md`, `payments`/`refunds`, the refund worker.
- **Permissions:** `payments:read`, `payments:refund` (Owner).

### 17. Shipping & Fulfilment  · Capability-gated (`weight-shipping`/`serviceability`)
- **Purpose:** carrier config, zones/serviceability, rate rules, AWB/label/pickup, tracking, NDR/RTO ops.
- **Generic:** behind `ShippingProvider` (Shiprocket today, others pluggable); serviceability/zones render iff `serviceability`; a business with only local delivery or digital goods disables it.
- **Reuses:** `shipping-fulfillment.md`, `shipments`/`shipment_events`.
- **Permissions:** `shipping:read`, `shipping:manage`.

### 18. Taxes  · Capability-gated (`tax-inclusive`/`hsn-codes`)
- **Purpose:** tax regime config — tax categories & rates, inclusive/exclusive pricing, classification codes (HSN), place-of-supply rules, tax reports.
- **Generic:** the GST math is already generic (rate as data, extraction/split); this module makes the **regime** configurable so non-India or non-GST businesses configure their own (VAT/sales-tax) — India GST is the first implemented regime.
- **Reuses:** `gst.ts`, `gst-states.ts`, `productVariants.gst_rate_bp`/`hsn_code`.
- **Permissions:** `taxes:manage` (Owner).
- **Note:** generalizing *beyond India* (VAT, US sales tax) is a documented future capability, not in the first build.

---

## Group C — Content, insight & config modules

### 19. Content Management  · Optional
- **Purpose:** manage storefront content that shouldn't be hardcoded — pages (About/Help/legal), banners, homepage blocks, journal/blog, navigation, and the brand copy currently hardcoded in components.
- **Generic:** a lightweight block/page model + the Media Library; removes hardcoded hero/footer/error copy (agent inventory §3G) from source into editable content.
- **Reuses:** `content-blog-seo.md` (MDX journal) — extend to DB-backed editable content.
- **Permissions:** `content:manage`.

### 20. Analytics & Reports  · Universal
- **Purpose:** trends over time (sales, orders, AOV, conversion, RTO, coupon usage, low-stock), cohort/LTV views, and exportable reports (CSV/scheduled).
- **Generic:** aggregation config-driven (what to group, IST/UTC, currency from profile); reports are queries over domain tables; export honours the CSV rate-cap + owner gate.
- **Reuses:** dashboard metric compute (generalized), CSV export pattern.
- **Permissions:** `analytics:read`, `reports:export` (Owner).
- **Split note:** "Analytics" = interactive charts; "Reports" = exportable/scheduled documents. Same data engine, two surfaces (kept as one module with two views to avoid duplication).

---

## Module ↔ capability matrix (summary)

| Module | Default | Gated by |
|---|---|---|
| Dashboard, Users & Roles, Permissions, Settings, Media, Notifications, Audit, Activity, Orders, Products, Categories, Inventory, Customers, Coupons, Payments, Analytics/Reports | **on** | — (Orders/Products/Inventory sub-features gate on capabilities) |
| Reviews | off | per business |
| Shipping & Fulfilment | on iff physical goods | `weight-shipping` / `serviceability` |
| Taxes | on iff taxed | `tax-inclusive` / `hsn-codes` |
| Content Management | off | per business |
| (Restaurant: Menu, Tables, KOT) | off | `menu` / `table-orders` (future vertical) |

**Kakao's enabled set:** all Group A + Orders, Products, Categories, Inventory, Customers, Coupons, Payments, Shipping, Taxes, Reviews(dark), Analytics — with capabilities `variants, perishable, veg-mark, cold-chain, weight-shipping, serviceability, tax-inclusive, hsn-codes`.
