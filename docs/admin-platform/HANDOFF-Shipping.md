# Build Handoff — Admin **Shipping / Fulfilment** module

> **You are a fresh Claude with no prior context. Read this whole file first.**
> This module is a **shipment console** over the existing `shipments` + `shipment_events`
> schema, with **manual, audited, monotonic‑guarded** lifecycle actions behind the
> provider abstraction (mock‑first). The full automated Shiprocket pipeline (webhook +
> 30‑min poller + Inngest + live token auth + NDR/RTO automation) is **Phase 2‑3 and
> OUT OF SCOPE for this handoff** — it is fully specced in
> `docs/modules/shipping-fulfillment.md`. Build the console now; the automation lands later.
> Match the existing admin modules exactly (Inventory/Coupons are the closest templates).
>
> Shared conventions: `docs/admin-platform/HANDOFF-Customers-and-Reviews.md` §1. This
> file restates the critical ones and adds everything Shipping‑specific.

---

## 0. Project & commands
**KAKOA** — premium D2C chocolate e‑commerce for India. Turborepo + pnpm monorepo.
- Repo root `/Users/yagneshpatel/Downloads/Projects/Kakoa`; app `apps/web` (pkg `web`),
  Next.js 16 App Router, React 19, TS strict (`noUncheckedIndexedAccess`), Tailwind v4.
- DB `packages/db` (`@kakoa/db`), Drizzle + postgres‑js. Providers in
  `packages/integrations` (`@kakoa/integrations`). Money = integer paise.
```bash
pnpm --filter web typecheck   # tsc --noEmit
pnpm --filter web test        # vitest run
pnpm --filter web build       # next build — STRICTER than typecheck; ALWAYS run it
```
Templates to copy: `lib/admin/inventory.ts` (+ `InventoryTable.tsx`), `lib/admin/order-actions.ts`
(state‑machine transitions + audit), `lib/admin/coupon-validation.ts` (+ `.test.ts`).

---

## 1. Conventions you MUST copy (condensed)
1. **Guard every route** — `requireAdmin('shipping:read' | 'shipping:manage')` from
   `lib/admin/guard.ts`; `if (!auth.ok) return auth.response;`. `auth.value.admin.id`
   for audit; `auth.value.ctx.can(...)` for conditional UI.
2. **HTTP envelope** — `jsonOk(data,{cacheControl:NO_STORE})` / `jsonErr(code,msg)` (`lib/api/http.ts`).
3. **`isUuid(x)`** (`@/lib/admin/product-validation`) before ANY uuid compare (`22P02` → 500 otherwise).
4. **Wrap mutations** in `withConstraintMapping(() => db.transaction(...))` (`@/lib/admin/db-errors`) —
   maps `23505`/`23514`/`23503`/`22003`/`22P02` to clean `VALIDATION_ERROR`; it unwraps
   drizzle's `error.cause` (keep that).
5. **Audit in‑tx** — `admin_audit_log { adminUserId, action:'shipment.*', entityType:'shipment', entityId, before, after }`.
6. 🔴 **`FOR UPDATE` + `LEFT JOIN` pitfall** — Postgres rejects `FOR UPDATE` on the
   nullable side of an outer join (`0A000`). When a lock‑select JOINs another table,
   scope the lock: `.for('update', { of: shipments })`. (This exact bug shipped in
   `staff.ts` and had to be fixed — do not repeat it.)
7. **Client tables resync**: `useEffect(() => setRows(initial), [initial])` after `router.refresh()`.
8. **Page shell**: `export const dynamic="force-dynamic"`, `<div className="mx-auto max-w-6xl">`.
   Palette: ink `#2a1d12`, border `#eadbc6`, muted `#8a7a68`, active pill
   `bg-[#2a1d12] text-[#f3e7d5]`, success `#3f8a54`, danger `#b25b5b`, warn `#a9791f`,
   info `#4a6b8a`.
9. **Nav is automatic** — the `shipping` module is registered in
   `apps/web/src/lib/admin/modules.ts` (order 18, nav "Shipping" → `/admin/shipping`,
   icon `truck`, perms `shipping:read`, `shipping:manage`). It's capability‑gated on
   `weight-shipping` (the chocolate vertical has it). Don't touch the sidebar.
10. **Pure logic → own file + vitest** (no `@kakoa/db` import) — the status‑rank guard goes here.

---

## 2. Data model (already in the schema — NO migration). `packages/db/src/schema/shipments.ts`

### `shipments` — one ACTIVE shipment per order
`id (uuid PK), orderId (uuid FK→orders CASCADE), shiprocketOrderId (text?),
shiprocketShipmentId (text?), awbCode (text UNIQUE?), courierCompanyId (int?),
courierName (text?), labelUrl (text?), manifestUrl (text?),
status (shipment_status NOT NULL DEFAULT 'pending'), cod (bool NOT NULL DEFAULT false),
pickupScheduledAt, expectedDeliveryAt, lastSyncedAt, supersededAt, createdAt, updatedAt`
(all timestamptz).
- **`shipments_one_active_idx`**: UNIQUE on `order_id` WHERE `superseded_at IS NULL` →
  **at most one active shipment per order**. To re‑ship, `supersededAt = now()` on the
  old one first, then create a new one.
- `shipments_stale_poll_idx` on `last_synced_at` WHERE active + non‑terminal (for the
  deferred poller — you don't need it now).

### `shipment_events` — append‑only courier/manual scan log
`id (uuid PK), shipmentId (uuid FK CASCADE), status (shipment_status NOT NULL),
srStatusCode (text?), activity (text?), location (text?), occurredAt (timestamptz NOT NULL),
source (CHECK IN 'webhook','poll','manual'), raw (jsonb?), createdAt`.
- **`UNIQUE(shipment_id, status, occurred_at)`** — dedup. A manual event you insert must
  not collide (use `now()` for `occurredAt`; if two land in the same instant with the
  same status, `withConstraintMapping` turns the `23505` into a clean error — or use
  `onConflictDoNothing`).

### `SHIPMENT_STATUSES` (`@kakoa/core`, exact order = rank)
`pending, awb_assigned, pickup_scheduled, picked_up, in_transit, out_for_delivery,
delivered, rto_initiated, rto_in_transit, rto_delivered, cancelled, lost`.
- **Forward track** (rank 0→6): pending→awb_assigned→pickup_scheduled→picked_up→in_transit→out_for_delivery→delivered.
- **RTO track** (separate, ascending): rto_initiated→rto_in_transit→rto_delivered — enterable
  from any in‑flight forward state (picked_up..out_for_delivery).
- **Terminals** (no further transitions): `delivered, rto_delivered, cancelled, lost`.
- `cancelled` / `lost` are enterable from any non‑terminal state (admin/exception).

### Variant dims (for weight validation) `catalog.ts`
`productVariants.shipWeightGrams (int NOT NULL, packed weight), lengthCm/breadthCm/heightCm
(numeric 6,2)`. A shipment's parcel must have `shipWeightGrams > 0` on every line.

### Order linkage `orders.ts`
`orders.shippingAddress` is a JSONB `AddressSnapshot` — **import `AddressSnapshot` from
`@kakoa/db`, NOT `@kakoa/core`** (`{ fullName, phone, line1, line2?, landmark?, city,
state, stateCode, pincode }`). `orders.paymentMode ∈ {prepaid, cod}` → the shipment's
`cod` flag. `orders.deliveryOpt ∈ {standard, express}`.

---

## 3. Order state machine ↔ shipment (READ `packages/core/src/order-state-machine.ts`)
`ORDER_STATUSES`: `pending_payment, payment_failed, cod_pending_confirmation, confirmed,
packed, shipped, out_for_delivery, delivered, cancelled, rto_initiated, rto_delivered`.
- Admin owns `confirmed→packed→shipped` (`ADMIN_ADVANCE_TARGETS = ['packed','shipped']`
  in `order-actions.ts`). Courier/system own `shipped→out_for_delivery→delivered` and RTO.
- **Reuse** `applyStatusTransition(...)` (order-actions.ts) + `assertTransition(from,to)`
  (order-state-machine.ts) — they lock the order `FOR UPDATE`, validate the transition,
  stamp the timestamp column (`packedAt`/`shippedAt`/`deliveredAt`), append
  `order_status_history` (`actorType`), and audit. **Do NOT hand‑roll order status writes.**
- **Mirror rule** (this module's job): when a shipment advances, mirror the order:
  `picked_up` → order `packed→shipped`; `delivered` → order `→delivered` (and COD payment
  → `cod_collected` via the existing payment path); `rto_initiated`/`rto_delivered` →
  order RTO states. Use `actorType:'admin'` for manual actions. If a mirror transition
  isn't legal per `assertTransition`, surface a clear error rather than forcing it.
- `getOrderTracking()` (`lib/orders/tracking.ts`) currently returns `shipment: null`
  ALWAYS — once a shipment has an AWB, populate `{ awb, courierName, expectedDeliveryAt }`
  so the storefront tracking page shows courier info (see §6.3).

---

## 4. SCOPE — build the console (mock‑first); DEFER the automation

### ✅ IN SCOPE (build now)
Admin can, manually and audited: **view** all shipments + their event timeline;
**create** a shipment for a fulfilment‑ready order; **assign AWB + courier**; **advance
status** through the monotonic machine; **schedule pickup**; **initiate RTO**;
**cancel / supersede** a shipment. All behind the `ShippingProvider` abstraction with a
**mock** that fabricates AWB/courier/label so the flow works end‑to‑end without Shiprocket.

### ⛔ DEFERRED (Phase 2‑3 — do NOT build here; it's specced in `docs/modules/shipping-fulfillment.md`)
Live Shiprocket API (240h token stored+refreshed in `store_settings`, login/serviceability/
create‑order/AWB/label), `POST /api/webhooks/shiprocket` (signature verify + `webhook_events`
dedup + status mapping), the 30‑min poller cron over `shipments_stale_poll_idx`, NDR
counter + auto‑RTO on 3rd attempt, ship/deliver emails, RTO disposition form, returns‑module
RTO linkage. Leave `// TODO(shipping Phase 2-3): …` markers where these hook in.
> Extend the `ShippingProvider` interface with the new methods and implement them in the
> **Mock** provider now; leave `ShiprocketShippingProvider` throwing `not implemented`
> (it already does). `getShippingProvider()` (`packages/integrations/src/shipping/index.ts`)
> picks Mock unless `SHIPROCKET_EMAIL` is set — so local dev uses the mock automatically.

---

## 5. Provider extension — `packages/integrations/src/shipping/`
Today `ShippingProvider` (`provider.ts:35`) has only `serviceability({pincode,cod})`. Add
fulfilment methods to the interface, implement in `mock.ts`, stub in `shiprocket.ts`:
```ts
interface ShippingProvider {
  serviceability(a: { pincode: string; cod: boolean }): Promise<ServiceabilityResult>; // existing
  // NEW (mock-first):
  createShipment(input: CreateShipmentInput): Promise<{ shiprocketOrderId: string; shiprocketShipmentId: string }>;
  assignAwb(input: { shiprocketShipmentId: string; courierCompanyId?: number }): Promise<{ awbCode: string; courierName: string; courierCompanyId: number; labelUrl: string | null }>;
  // (track() is Phase 2-3 — the poller; do not add now)
}
```
Mock: deterministic fake ids/AWB (e.g. `KKMOCK-<8hex>` — vary by input, not `Math.random`
in workflow contexts; in app code `crypto.randomUUID()` is fine), courier "Mock Express",
`labelUrl:null`. Keep all Shiprocket specifics inside `packages/integrations` (nothing
outside may import Shiprocket types).

---

## 6. What to build

### 6.1 Pure guard — `apps/web/src/lib/admin/shipping-status.ts` (no db, unit‑tested)
- `SHIPMENT_RANK: Record<ShipmentStatus, number>` for the forward track; treat RTO as a
  separate ascending sub‑track and `cancelled`/`lost` as always‑enterable exceptions.
- `canAdvanceShipment(from, to): boolean` — allow: forward rank strictly increasing by the
  legal next step(s); entering the RTO track from an in‑flight forward state; RTO
  ascending; `cancelled`/`lost` from any non‑terminal; **never** from a terminal; **never**
  regress. Return false otherwise.
- `isTerminalShipment(s)`, `SHIPMENT_STATUS_LABEL`, `nextShipmentStatuses(from)` (for the UI).
- `validateAwbInput(raw)` — AWB non‑empty, `^[A-Za-z0-9-]{4,40}$`; courierName ≤ 80; optional
  courierCompanyId int ≥ 1.

### 6.2 Data layer — `apps/web/src/lib/admin/shipping.ts`
- `listShipments({ search?, status?, filter?: 'all'|'active'|'in_transit'|'delivered'|'rto'|'exception', page? })`
  → join `orders` for orderNumber + shippingAddress city/state; return `id, orderNumber,
  awbCode, courierName, status, cod, expectedDeliveryAt, createdAt`. Search order number /
  AWB (ilike, escape `%_\`). Only active (superseded_at IS NULL) by default; a filter can
  show superseded. Newest first. Paginate ~30.
- `getShipmentDetail(id)` → shipment + linked order summary + `shipment_events` (newest
  first). `isUuid` guard; `null` if not found.
- `createShipment(orderId, adminUserId)` → tx + `withConstraintMapping`:
  - `isUuid(orderId)`; load order `FOR UPDATE` (order row only). Guard: order status ∈
    `{confirmed, packed}` (else "Confirm/pack the order first."); validate address snapshot
    shape + each line's variant `shipWeightGrams > 0`.
  - The `shipments_one_active_idx` enforces one active — a duplicate insert → `23505` →
    clean "This order already has an active shipment."
  - Call `provider.createShipment(...)` (mock), insert `shipments {orderId,
    shiprocketOrderId, shiprocketShipmentId, status:'pending', cod: order.paymentMode==='cod'}`,
    insert an initial `shipment_events {status:'pending', source:'manual', occurredAt: now()}`,
    audit `shipment.create`. Return the shipment id.
- `assignAwb(shipmentId, input, adminUserId)` → validate via `validateAwbInput`; tx +
  `FOR UPDATE OF shipments`; require current status `pending`; call `provider.assignAwb`
  (or accept manual AWB entry); set `awbCode` (UNIQUE — dup → clean error), courier,
  `labelUrl`, status→`awb_assigned`; append event; audit `shipment.assign_awb`.
- `advanceShipment(shipmentId, toStatus, adminUserId)` → tx + `FOR UPDATE OF shipments`;
  read current; `canAdvanceShipment(current, toStatus)` else `INVALID_TRANSITION`; update
  `status` (+ stamp `pickupScheduledAt`/`expectedDeliveryAt` where relevant); append
  `shipment_events {status:toStatus, source:'manual', occurredAt: now()}` (dedup‑safe);
  **mirror to the order** via `applyStatusTransition` per §3; audit `shipment.advance`.
- `cancelShipment(shipmentId, adminUserId)` / `supersedeShipment(...)` → set status
  `cancelled` and/or `supersededAt = now()` (frees the one‑active index so a re‑ship is
  possible); append event; audit. Guard: not already terminal unless superseding.

### 6.3 Storefront tracking integration (small but important)
`lib/orders/tracking.ts` `getOrderTracking()` returns `shipment: null`. Update it to load
the order's **active** shipment (superseded_at IS NULL) and return
`{ awb: awbCode, courierName, expectedDeliveryAt }` when `awbCode` is set (else null).
Do NOT expose Shiprocket ids or label URLs to the storefront. This makes the existing
`/account/track` page show courier + AWB once fulfilled.

### 6.4 Routes
- `GET  /api/admin/shipping` — list (`shipping:read`).
- `GET  /api/admin/shipping/[id]` — detail + events (`shipping:read`).
- `POST /api/admin/shipping` — body `{ orderId }`, create (`shipping:manage`).
- `PATCH /api/admin/shipping/[id]` — body `{ action:'assign_awb', ... } | { action:'advance', toStatus } | { action:'cancel' }`
  OR split into sub‑routes `/[id]/awb`, `/[id]/advance`, `/[id]/cancel` (cleaner — prefer
  sub‑routes, mirror the Orders module's `/action` pattern). All `shipping:manage`.
- (Optional) `GET /api/admin/orders/[orderNumber]/shipment` if you surface a shipment
  panel on the order detail page.

### 6.5 UI
- `app/admin/(shell)/shipping/page.tsx` (server, gate `shipping:read`): status filter pills
  (All / Active / In transit / Delivered / RTO / Exception), search (order # / AWB), table
  (Order · AWB · Courier · Status badge · COD · ETA · Created), row → detail.
- `app/admin/(shell)/shipping/[id]/page.tsx` (server, gate `shipping:read`): shipment
  summary + linked order link + a **status timeline** from `shipment_events` (status ·
  activity · location · when · source badge) + an **action panel** (only if
  `shipping:manage`): Assign AWB (form), Advance to <next statuses> (from
  `nextShipmentStatuses`), Schedule pickup, Initiate RTO, Cancel — each posts + `router.refresh()`.
- `components/admin/ShipmentActions.tsx` (client) + a status‑badge helper. Model the action
  panel on `components/admin/OrderActions.tsx` (it already does guarded transition buttons).
- On the **order detail page** (`app/admin/(shell)/orders/[orderNumber]/page.tsx`), add a
  "Shipment" section: if none, a "Create shipment" button (when order is confirmed/packed +
  `shipping:manage`); if one exists, show status + AWB + a link to `/admin/shipping/[id]`.

---

## 7. 🔴 Edge cases — test every one
1. **One active shipment**: creating a 2nd active shipment for an order → clean 400 (the
   `shipments_one_active_idx` `23505`, mapped). Supersede/cancel first, then re‑create → OK.
2. **AWB uniqueness**: assigning an AWB already used by another shipment → clean 400.
3. **Monotonic status**: advancing backward (e.g. `in_transit`→`picked_up`) or from a
   terminal → `INVALID_TRANSITION`, never a DB write.
4. **RTO branch**: `rto_initiated` enterable only from in‑flight forward states; RTO ascends
   `rto_initiated→rto_in_transit→rto_delivered`; can't jump forward‑track after RTO.
5. **Order mirror legality**: advancing shipment to `delivered` when the order isn't in a
   state that legally transitions to `delivered` → surface the state‑machine error, don't
   force it. COD order → payment moves to `cod_collected` (reuse the existing path).
6. **Create guard**: creating a shipment for an order not in `{confirmed, packed}` →
   rejected with a clear message.
7. **Weight/address validation**: a variant with `shipWeightGrams = 0` or a malformed
   address snapshot → rejected before any provider call.
8. **`shipment_events` dedup**: two manual events of the same status at the same instant →
   `onConflictDoNothing` or clean error (no 500).
9. **`FOR UPDATE` + JOIN**: any lock‑select that joins `orders` must use
   `.for('update', { of: shipments })` — or Postgres throws `0A000` → 500.
10. Malformed `[id]` / `orderId` → `NOT_FOUND` / `VALIDATION_ERROR` (isUuid), never 500.
11. **Superseded shipments** are read‑only history — no actions on them; excluded from the
    default active list.
12. **Storefront leak**: tracking must NOT expose Shiprocket ids / label URLs — only
    `awb, courierName, expectedDeliveryAt`.
13. `shipping:read` without `shipping:manage` → read‑only console; every mutating route
    enforces `shipping:manage` server‑side.
14. Every mutation writes an `admin_audit_log` row + a `shipment_events` row where a status
    changes.
15. int4 columns (`courierCompanyId`) — validate bounds; jsonb `raw` optional.

---

## 8. Build + TEST loop (same discipline as every shipped module)
data layer → provider mock → routes → UI → **pure unit tests** → gate → live‑verify → self‑review → commit.

### 8.1 Tests (REQUIRED)
- Unit‑test `shipping-status.ts` in `shipping-status.test.ts` (no db): `canAdvanceShipment`
  across the forward track, RTO branch, terminals, and every illegal/backward case;
  `validateAwbInput` valid+invalid; `nextShipmentStatuses`.
- `typecheck` clean · `test` green · **`build` clean** (Next's build type‑check is stricter
  than `tsc`; a bad import can pass typecheck and fail build — always run build). New routes
  in the route list.

### 8.2 Live verify (dev server :3000; sign in `owner@kakoa.in`, OTP `000000`)
Drive the real API via `fetch` and assert DB + order‑mirror effects. Pick an order in
`confirmed`/`packed` (create one via the storefront/COD flow if needed):
- Create a shipment → row appears, status `pending`, event logged. Create a 2nd for the same
  order → 400 (one‑active). Assign AWB → status `awb_assigned`, AWB set; assign the same AWB
  to another shipment → 400. Advance `pickup_scheduled → picked_up` → **order mirrors to
  `shipped`** (check `orders.status` + `order_status_history`). Advance backward → 400.
  Advance to `delivered` → order `delivered` (COD → `cod_collected`). Initiate RTO from an
  in‑flight shipment → RTO track. Cancel → superseded, re‑create allowed.
- Confirm each mutation wrote an `admin_audit_log` + `shipment_events` row.
- Confirm `/account/track` for that order now shows the AWB + courier (tracking integration).
- Confirm a `shipping:read`‑only context is refused the mutating routes.
Screenshot the shipping list + a shipment detail timeline.

### 8.3 Adversarial self‑review
Hunt for: backward/terminal status writes, order‑mirror forcing an illegal transition,
`FOR UPDATE`+JOIN `0A000`, one‑active/AWB race → 500 instead of 400, Shiprocket‑id leak to
storefront, missing audit/event, a `shipping:read` user reaching a mutating route. Fix, re‑verify.

### 8.4 Commit (do NOT push unless asked)
```
Admin Shipping: shipment console (create/AWB/advance/RTO) over shipments, mock provider

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## 9. Definition of Done
- [ ] typecheck clean · tests green (`shipping-status` fully unit‑tested) · **build clean**
- [ ] Shipment list + detail (with `shipment_events` timeline) render; filters + search work
- [ ] create / assign‑AWB / advance / pickup / RTO / cancel — all guarded, audited, event‑logged
- [ ] **Monotonic status** enforced (no regress, no post‑terminal); RTO branch correct
- [ ] **One active shipment per order** + **AWB unique** → clean 400s (not 500)
- [ ] Order **mirror** reuses `applyStatusTransition` (picked_up→shipped, delivered→delivered, COD→cod_collected) and respects the order state machine
- [ ] `getOrderTracking` populates the storefront `shipment` field (AWB/courier/ETA only — no Shiprocket ids/labels)
- [ ] Provider methods added to the interface + Mock impl; Shiprocket stays stubbed
- [ ] `shipping:manage` enforced server‑side on every mutation; `shipping:read` = read‑only console
- [ ] `FOR UPDATE OF shipments` used on every lock‑select that JOINs
- [ ] Deferred Phase 2‑3 items left as clear `// TODO(shipping Phase 2-3)` markers
- [ ] Live‑verified end‑to‑end incl. order‑mirror + storefront tracking

---

## 10. Gotchas (do NOT repeat this project's history)
1. **`FOR UPDATE` on the nullable side of a `LEFT JOIN` → `0A000` 500** — use
   `.for('update', { of: shipments })`. (Just fixed in `staff.ts`.)
2. **`pgConstraintMessage` unwraps `error.cause`** — drizzle wraps the PostgresError. (Handled.)
3. **`AddressSnapshot` is exported from `@kakoa/db`, not `@kakoa/core`** (a parallel build
   broke on this exact import).
4. **`next build` is stricter than `tsc --noEmit`** — a file can pass typecheck and fail
   build (bad import). ALWAYS run build before "done".
5. **`useState(initialProp)` never resyncs** — add the `[initial]` effect after refresh.
6. **Never compare a raw string to a uuid column** — `isUuid` first (`22P02`).
7. **Reuse `applyStatusTransition` for order status** — never hand‑roll order writes; the
   state machine + `order_status_history` + audit are all in there.
8. **Do not fork provider logic outside `packages/integrations`** — Shiprocket specifics stay behind the interface.

---

### Appendix — files to read/imitate
| Need | File |
|---|---|
| shipments + events schema + indexes | `packages/db/src/schema/shipments.ts` |
| shipment / order status enums | `packages/core/src/enums.ts`, `packages/core/src/order-state-machine.ts` |
| order transition + history + audit to REUSE | `apps/web/src/lib/admin/order-actions.ts` (`applyStatusTransition`, `ADMIN_ADVANCE_TARGETS`) |
| guarded action panel UI | `apps/web/src/components/admin/OrderActions.tsx` |
| provider abstraction + mock | `packages/integrations/src/shipping/{provider,mock,shiprocket,index}.ts` |
| storefront tracking to populate | `apps/web/src/lib/orders/tracking.ts` (`getOrderTracking`) |
| list + filters + table + detail | `app/admin/(shell)/inventory/page.tsx` + `components/admin/InventoryTable.tsx` |
| the full deferred Phase 2‑3 spec | `docs/modules/shipping-fulfillment.md` |

Build the **console** (mock provider) — create → AWB → advance → deliver/RTO, with order
mirroring and storefront tracking. The webhook/poller/live‑Shiprocket automation is a
separate later phase, already specced. 🍫📦
