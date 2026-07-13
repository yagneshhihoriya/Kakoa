# Build Handoff — **Order Fulfilment: End‑to‑End Flow** (order placed → delivered)

> **You are a fresh Claude with no prior context. Read this whole file first.**
> This is the **master fulfilment handoff**: the COMPLETE journey from the moment a customer places
> an order to the moment it's delivered — what the **customer sees**, what the **admin does**, and
> what the **system does automatically** at every stage. It shows **what already exists** vs **the
> gaps to close**, and specs each gap. Deep provider details for two steps live in sub‑handoffs
> (referenced inline): **`HANDOFF-Shiprocket-Integration.md`** (real courier automation) and
> **`HANDOFF-Notifications.md`** (email/SMS). Build the wiring here; dive into those for the API depth.
> Match the existing admin‑module conventions exactly.

---

## 0. Project & the docs this ties together
KAKOA — premium D2C chocolate e‑commerce (India). Turborepo + pnpm; app `apps/web` (pkg `web`),
Next 16 App Router, TS strict, Tailwind v4; DB `@kakoa/db`; providers in `@kakoa/integrations`.
```bash
pnpm --filter web typecheck && pnpm --filter web test && pnpm --filter web build   # build stricter than tsc
```
This doc = the **flow + the wiring**. It references:
- **`docs/admin-platform/HANDOFF-Shiprocket-Integration.md`** — the real Shiprocket API integration (Step 5).
- **`docs/admin-platform/HANDOFF-Notifications.md`** — email/SMS templates + log (the "your box shipped" messages).
- **`docs/admin-platform/HANDOFF-Returns-Refunds.md`** — the post‑delivery claim/refund flow (after this one).
Conventions (guard, envelope, `isUuid`, `withConstraintMapping`, audit‑in‑tx, `FOR UPDATE OF`,
`useState`+`[initial]` resync, `AddressSnapshot` from `@kakoa/db`, build stricter than tsc): see
`HANDOFF-Customers-and-Reviews.md` §1 and the gotchas in every other handoff.

---

## 1. THE COMPLETE FLOW (what happens at every stage)

| # | Stage / status | Customer sees | Admin does | System does automatically | Order status |
|---|---|---|---|---|---|
| 1 | **Order placed & paid** | Order‑success page; **confirmation email** | — | Payment captured (Razorpay) or COD‑pending; **confirmation email** fired; stock decremented; order appears in admin | `confirmed` (or `cod_pending_confirmation`) |
| 2 | **Lands on dashboard** | — | Sees the new order at the top of the **Orders** list; opens it | *(GAP A: real‑time alert)* | `confirmed` |
| 3 | **Open order** | — | Sees items, shipping address, action buttons + a **Shipment** card | — | `confirmed` |
| 4 | **Start packing** | — | Clicks **"Mark packed"** | Stamps `packedAt`, writes `order_status_history` + audit | `packed` |
| 5 | **Create shipment → Shiprocket** | — | *(today: clicks "Create shipment" + "Assign AWB")* | *(GAP B+D: auto‑create + auto‑AWB on `packed`)* → Shiprocket order created, courier auto‑picked, **AWB + label** returned | shipment `awb_assigned` |
| 6 | **Print label + request pickup** | — | **Bulk‑print labels**, stick them, **Bulk‑request pickup** | *(GAP D)* Shiprocket schedules courier pickup; manifest generated | shipment `pickup_scheduled` |
| 7 | **Courier picks up / ships** | **"Shipped" + tracking link email/SMS** | — | *(GAP D webhook)* Shiprocket scan → status `picked_up`/`shipped`; **order → `shipped`**; *(GAP C)* **shipped email/SMS** with AWB + tracking link | `shipped` |
| 8 | **In transit** | Tracking timeline updates (AWB, courier, ETA) | — | *(GAP D)* webhook/poller advances `in_transit`; storefront tracking reflects it | `shipped` |
| 9 | **Out for delivery** | *(GAP C)* **"Out for delivery" email/SMS** | — | webhook → `out_for_delivery`; order mirror | `out_for_delivery` |
| 10 | **Delivered** | *(GAP C)* **"Delivered" email/SMS** | — | webhook → `delivered`; **order → `delivered`**; COD payment → `cod_collected`; delivery timestamp | `delivered` |
| — | **Exceptions** | Tracking shows RTO/failed | Admin handles NDR/RTO in the console | *(GAP D)* webhook maps `rto_*`; NDR = needs‑action; storefront tracking shows it | `rto_initiated`/`rto_delivered` |
| — | **After delivery** | Can file a damage/melt claim | Reviews + refunds/replaces | → **`HANDOFF-Returns-Refunds.md`** | (claim flow) |

**Storefront tracking** (`/account/track` + order page) already renders this timeline and shows
AWB/courier once assigned — it just needs the real data flowing in (Gap D).

---

## 2. CURRENT STATE — what's built vs missing (accurate as of now)
| Stage | Status | Reality in the code |
|---|---|---|
| 1. Order lands (paid) + confirmation email | ✅ **Have** | Order → `confirmed`; `sendOrderConfirmation` fires on placement/confirm; appears in Orders list + "orders today" metric |
| 2. Real‑time new‑order alert to admin | ❌ **Missing** | No websocket/push/SSE, no admin email/SMS on new order — you **refresh the dashboard** |
| 3. Open order detail (items, address, actions, Shipment card) | ✅ **Have** | Order detail page + a **Shipment** card + a `CreateShipmentButton` |
| 4. "Mark packed" (`confirmed→packed`) | ✅ **Have** | Button → `applyStatusTransition`, stamps `packedAt`, history + audit |
| 5a. Create shipment | 🟡 **Manual + Mock** | `CreateShipmentButton` → `createShipment(orderId)` via the **Mock** provider. **NOT auto on packed.** |
| 5b. Courier auto‑pick (Cheapest/Fastest…) | ❌ **Missing** | Mock assigns fixed "Mock Express"; no real Courier‑Priority |
| 5c. AWB + Label | 🟡 **Mock AWB, ❌ Label** | Mock AWB (`KKMOCK…`) shows in console + tracking; **no real label/manifest PDF** |
| 5d. Pickup + manifest | ❌ **Missing** | No real pickup request / manifest |
| 6. "Mark shipped" (`packed→shipped`) | ✅ **Have** (manual) | Button → order `shipped` + history/audit |
| 7–10. Auto tracking sync (in‑transit → delivered) | ❌ **Missing** | Shipment status advanced **manually** in the console; **no webhook, no poller** |
| Customer packed/shipped/out‑for‑delivery/delivered emails/SMS | ❌ **Missing** | **Only** confirmation + cancellation emails are wired |
| Storefront tracking shows AWB/courier | ✅ **Have** (once AWB set) | `getOrderTracking` reads the active shipment's AWB/courier |

**Summary:** the **manual pipeline works end‑to‑end today** (place → pack → create shipment → AWB →
ship, all clickable, mock courier). What's missing to make it the **automated real flow**: **(A)** a
new‑order alert, **(B)** auto‑push on packed, **(C)** the customer fulfilment emails/SMS, **(D)** the
real Shiprocket integration (courier auto‑pick, label, pickup, webhook, poller).

---

## 3. THE GAPS TO CLOSE (each a build task)

### Gap A — New‑order alert to the admin
So you're not refreshing all day.
- **Simplest (do this first):** on new order, send an **admin email/SMS alert** (best‑effort, via the
  Notifications module) — "New order #KK‑… ₹X — N items." Add a `sendAdminNewOrderAlert(orderId)` in
  `lib/email/send.ts`, called from the same place as `sendOrderConfirmation` (`checkout/place.ts` +
  `checkout/confirm.ts`), gated by a `store_settings` recipient (`ops_alert_email` / `ops_alert_phone`).
- **Nicer (optional):** a lightweight **live badge** on the admin Orders nav — poll `/api/admin/orders?
  status=confirmed&since=…` every ~30s from a client component and show an unseen‑count badge (no
  websocket infra needed). A true push/SSE is a later nicety; the email alert covers the need now.

### Gap B — Auto‑create shipment + assign AWB when an order is marked `packed`
Turn the manual "Create shipment" button into automatic fulfilment.
- **Where:** extend the `packed` transition in `apps/web/src/lib/admin/order-actions.ts` (the
  `adminAdvanceStatus` → `packed` path). **After** the status‑change tx commits, fire (best‑effort,
  outside the tx) `pushToShiprocket(orderId)` which calls the existing `createShipment(orderId)` +
  `assignAwb(...)` in `lib/admin/shipping.ts`.
- **Idempotent:** if an active shipment with a `shiprocketOrderId` already exists, no‑op (the
  `shipments_one_active_idx` + the stored id guard it). Manual "Create shipment" stays as a fallback.
- **Best‑effort:** a provider hiccup must NOT block the `packed` transition — on failure leave the
  shipment `pending` + a **"needs attention / Retry AWB"** flag in the console (mirror the email
  best‑effort pattern). The keep‑the‑button escape hatch remains.
- With the **Mock** provider this already produces an AWB; with the **real** provider (Gap D) it
  produces a real AWB + courier + label. Same wiring, different provider.

### Gap C — Customer fulfilment notifications (packed / shipped / out‑for‑delivery / delivered)
The "your box is on the way, track here" messages.
- **Build the templates + send functions** (per `HANDOFF-Notifications.md`): `order_shipped`,
  `order_out_for_delivery`, `order_delivered` (email + SMS), with placeholders `{{orderNumber}},
  {{customerName}}, {{awb}}, {{courierName}}, {{trackingUrl}}, {{eta}}`. Add `sendOrderShipped(orderId)`,
  `sendOrderDelivered(orderId)`, etc. in `lib/email/send.ts` (+ the generic SMS send from Notifications §0).
- **Trigger them from the status transitions** — best‑effort, like `sendOrderConfirmation`:
  - `packed→shipped` (manual button today, webhook later) → `sendOrderShipped`.
  - webhook `out_for_delivery` → `sendOrderOutForDelivery`.
  - webhook `delivered` → `sendOrderDelivered`.
- **SMS in India** needs DLT (see Notifications §0) — email works now (Resend free tier); SMS runs on
  the Fake provider until DLT. Wire both; the provider abstraction handles which actually delivers.

### Gap D — Real Shiprocket integration (the big one)
Everything in Steps 5–10's "system does" column. **Fully specced in
`docs/admin-platform/HANDOFF-Shiprocket-Integration.md`** — build that. In one line: implement the real
`ShiprocketShippingProvider` (token 240h, create/adhoc, **assign/awb with NO `courier_id` → Shiprocket
auto‑picks per the seller's dashboard Courier‑Priority rule**, label, manifest, pickup, track); add
**bulk print/pickup**; add the **`/api/webhooks/shiprocket`** receiver (`x‑api‑key` verify, dedupe,
forward‑only, order mirror, RTO/NDR) + a **30‑min poller** safety net. `SHIPROCKET_EMAIL` in env
auto‑switches the code from Mock → real. The seller configures Courier Priority + pickup + webhook in
the Shiprocket dashboard (not code).

### Gap E — (Optional) a "packing in progress" middle state
Your Step 3 described a distinct "In Progress" between New and Packed. Today it's `confirmed → packed`
directly. If you want a helper‑visible "someone's on it" state, add a `processing`/`packing` status to
the order state machine (`packages/core/src/order-state-machine.ts`) + `ADMIN_ADVANCE_TARGETS` + a
button. **Low priority** — a single admin doesn't need it; add it when you have a packing team.

---

## 4. THE END‑STATE (what it looks like once A–D are done)
1. Customer orders → **confirmation email**; **you get a new‑order alert** (Gap A).
2. You open the order, click **"Mark packed."** → the system **auto‑creates the Shiprocket order,
   Shiprocket auto‑picks the cheapest/fastest courier (your rule), and the AWB + label come back** —
   no "Ship Now" click (Gaps B+D).
3. Morning: your console shows all packed orders **"Ready to ship" with couriers + AWBs assigned.**
   You **select all → Bulk Print Labels**, stick them, **Bulk Request Pickup** (Gap D).
4. Courier scans the box → Shiprocket **webhook** flips the order to `shipped` → `in_transit` →
   `out_for_delivery` → `delivered` **automatically**, mirrors the order status, and **emails/SMSes the
   customer at each step** with the tracking link (Gaps C+D). A poller catches any missed webhook.
5. The customer watches it all on `/account/track`. You touched it **once** (Mark packed) and printed
   a label. Everything else is automatic.

---

## 5. Build order, DoD, edge cases

### Build order (ship value fast)
**A** (new‑order alert — 1 email fn) → **C** (fulfilment email templates + triggers, using the manual
"Mark shipped" as the first trigger) → **B** (auto‑push on packed, still Mock) → **D** (real Shiprocket:
provider → bulk → webhook → poller) → **E** (optional middle state). A+C+B give a big UX win even before
the real Shiprocket lands; D makes it fully automatic.

### Definition of Done
- [ ] Gap A: new‑order admin alert (email/SMS) fires on order placement (+ optional live badge)
- [ ] Gap B: marking `packed` auto‑creates the shipment + assigns AWB (idempotent, best‑effort, retry flag); manual button remains as fallback
- [ ] Gap C: shipped / out‑for‑delivery / delivered customer email+SMS templates + triggers (best‑effort)
- [ ] Gap D: real Shiprocket provider + bulk label/pickup + webhook + poller (per its sub‑handoff)
- [ ] Order status mirrors shipment status via `applyStatusTransition` (never hand‑rolled); COD→`cod_collected` on delivered
- [ ] Storefront tracking shows real AWB/courier/ETA (already wired — verify with real data)
- [ ] All new mutations `isUuid`‑guarded, `withConstraintMapping`‑wrapped, audited; best‑effort sends never block a status change
- [ ] typecheck + tests + **build** clean; pure mappers/body‑builders unit‑tested; live‑verified end‑to‑end (Mock, then real account)

### Edge cases (the flow‑level ones; provider‑level ones are in the sub‑handoffs)
1. **Best‑effort everywhere** — a Shiprocket outage or an email failure must NEVER block the order
   status change or the customer's checkout. Wrap every send/push in try/catch (mirror `void
   sendOrderConfirmation(id).catch(()=>{})`).
2. **Idempotent auto‑push** — re‑marking packed, or a retry, must not create a 2nd shipment (one‑active
   index + stored `shiprocketOrderId`).
3. **Order↔shipment mirror stays legal** — mirror only via `applyStatusTransition`/`assertTransition`;
   if a webhook implies an illegal order transition, log + skip, don't force it.
4. **Duplicate/out‑of‑order webhooks** — dedupe + advance forward only (Shiprocket handoff §6).
5. **COD** — on `delivered`, move the COD payment to `cod_collected` (reuse the existing path); COD
   remittance is tracked in the Payments module.
6. **No double‑email** — use the email `idempotencyKey` so a webhook + poller both seeing "delivered"
   don't email twice.
7. **RTO/NDR** — surface in the console + tracking; don't terminal‑ize NDR; RTO refunds go via the
   Returns/refund path.
8. **Notifications gating** — respect the Notifications module's active‑template + provider‑configured
   state; missing SMS provider (no DLT) must degrade to email‑only, not error.

---

## 6. Gotchas (recurring project traps — do not repeat)
1. **Reuse `applyStatusTransition`** for order status — never hand‑roll (state machine + history + audit are in it).
2. **Best‑effort sends/pushes** — `void fn().catch(()=>{})`; never block the money/status path.
3. **`FOR UPDATE` + `LEFT JOIN` → `0A000`** — `.for('update',{of: <table>})` (the staff.ts bug).
4. **`pgConstraintMessage` unwraps `error.cause`**; **`AddressSnapshot` from `@kakoa/db`, not `@kakoa/core`**.
5. **`next build` is stricter than `tsc --noEmit`** — always run build.
6. **`useState(initialProp)` never resyncs** — `[initial]` effect after refresh.
7. **Shiprocket has no sandbox**; **`SHIPROCKET_EMAIL` toggles real vs Mock**; **half the courier
   automation is a Shiprocket dashboard setting, not code** (omit `courier_id`).

### Appendix — file map
| Piece | File |
|---|---|
| order status machine + transitions to reuse | `packages/core/src/order-state-machine.ts`; `apps/web/src/lib/admin/order-actions.ts` (`applyStatusTransition`, `ADMIN_ADVANCE_TARGETS`, where `sendOrderCancellation` is already fired) |
| where confirmation email fires (copy the pattern for new triggers) | `apps/web/src/lib/checkout/{place,confirm}.ts`, `apps/web/src/lib/email/send.ts` |
| shipping console + `createShipment`/`assignAwb` to auto‑trigger | `apps/web/src/lib/admin/shipping.ts`, `app/admin/(shell)/shipping/**`, `components/admin/CreateShipmentButton.tsx` |
| shipment section on the order page | `apps/web/src/app/admin/(shell)/orders/[orderNumber]/page.tsx` |
| storefront tracking (already reads AWB) | `apps/web/src/lib/orders/tracking.ts` |
| **real Shiprocket (Step 5, Gap D)** | **`docs/admin-platform/HANDOFF-Shiprocket-Integration.md`** |
| **email/SMS (Gaps A + C)** | **`docs/admin-platform/HANDOFF-Notifications.md`** |
| post‑delivery claims/refunds (after this) | `docs/admin-platform/HANDOFF-Returns-Refunds.md` |

**This is the whole journey.** The manual pipeline works today; close Gaps A–D (alert → emails →
auto‑push → real Shiprocket) and one click ("Mark packed") + one print drives an order all the way to
"Delivered" with the customer notified at every step. 📦→🏠
