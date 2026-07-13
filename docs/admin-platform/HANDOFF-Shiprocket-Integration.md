# Build Handoff — **Real Shiprocket Integration** (Phase 2‑3: automate fulfilment)

> **You are a fresh Claude with no prior context. Read this whole file first.**
> This turns the existing **mock** shipping console into the **real, automated** Shiprocket flow:
> mark an order packed → auto‑create the Shiprocket order → Shiprocket auto‑picks the courier (per
> the seller's dashboard rules) → pull AWB + label back → bulk‑print + bulk‑pickup → Shiprocket
> webhook auto‑advances tracking → customer gets shipped/delivered notifications. **Most of the
> code skeleton already exists** — you're swapping the mock provider for the real API + adding a
> webhook + a poller. Match the existing module conventions exactly.
>
> **Sourcing note:** the API facts below were web‑verified (2024–2025) from Shiprocket's support
> helpsheets, the public **Postman workspace `shiprocketdev`**, and typed SDKs. `apidocs.shiprocket.in`
> is a JS SPA that can't be scraped verbatim, so **field TYPES (string vs number) and a few exact
> response keys must be confirmed against one live call** before hardcoding. Endpoint PATHS, methods,
> auth, token TTL, the courier auto‑pick behavior, and the webhook shape are confirmed.

---

## 0. 🟢 What already exists (don't rebuild — extend)
- `packages/integrations/src/shipping/` — the `ShippingProvider` interface, `MockShippingProvider`
  (working), and **`ShiprocketShippingProvider` (a STUB that throws "not implemented")**. `getShippingProvider()`
  **auto‑selects Shiprocket when `SHIPROCKET_EMAIL` is set**, else Mock.
- `apps/web/src/lib/admin/shipping.ts` + routes + `(shell)/shipping` pages — the admin **console**
  (create shipment / assign AWB / advance / cancel) over `shipments` + `shipment_events`.
- `packages/db/src/schema/shipments.ts` — `shipments` (shiprocketOrderId, shiprocketShipmentId,
  awbCode UNIQUE, courierCompanyId, courierName, labelUrl, manifestUrl, status, cod, pickupScheduledAt,
  expectedDeliveryAt, lastSyncedAt, supersededAt) + `shipment_events` (status, srStatusCode, activity,
  location, occurredAt, source∈webhook|poll|manual, raw; UNIQUE(shipment_id,status,occurred_at)).
- `SHIPMENT_STATUSES` (`@kakoa/core`): `pending, awb_assigned, pickup_scheduled, picked_up, in_transit,
  out_for_delivery, delivered, rto_initiated, rto_in_transit, rto_delivered, cancelled, lost`.
- Storefront tracking already reads the active shipment's AWB/courier (`lib/orders/tracking.ts`).

**Your job:** (1) real `ShiprocketShippingProvider`; (2) auto‑push on `packed`; (3) bulk label +
bulk pickup; (4) webhook receiver; (5) poller; (6) notifications; (7) config + dashboard setup.

---

## 1. 🔴 The dashboard‑vs‑code split (READ FIRST — half the "automation" is NOT code)
| The "automation" | Where it lives | Who does it |
|---|---|---|
| **Courier Priority rules** (auto‑pick Cheapest / Fastest / Best‑rated / Recommended / Custom) | **Shiprocket dashboard → Settings › Courier › Courier Priority** | **Seller configures it. Zero code.** |
| Auto‑pick a courier when we assign AWB | Shiprocket, at `assign/awb` time | **We just OMIT `courier_id`** → Shiprocket applies the priority rules |
| Push order, get AWB/label, bulk print, request pickup, sync tracking | Our server ↔ Shiprocket API + webhook | **We build (this doc)** |

So: **`assign/awb` with `shipment_id` only (no `courier_id`) = Shiprocket auto‑selects the courier
per the seller's Courier‑Priority setting.** That single fact is the whole "auto‑pick cheapest" feature.

### Dashboard setup the SELLER does (document these; they're not code):
1. **Create an API user** — Settings › API › **Configure** (a *dedicated* API user, NOT the merchant login). Its email/password go in env.
2. **Set Courier Priority** — Settings › Courier › **Courier Priority** (Recommended / Fastest / Cheapest / Best‑rated / Custom).
3. **Register a pickup location** — the `pickup_location` nickname (e.g. "Primary") must match EXACTLY what we send.
4. **Configure the tracking webhook** — Settings › API › **Webhooks**: paste our webhook URL + a token (the `x-api-key` value). Keep the words shiprocket/kartrocket/sr/kr OUT of the URL path (documented Shiprocket restriction).
5. Keep the **Shiprocket wallet funded** (AWB assignment fails on insufficient balance).

---

## 2. Shiprocket API — verified reference (base `https://apiv2.shiprocket.in`, prefix `/v1/external`)
All calls (except login) need `Authorization: Bearer <token>` **AND** `Content-Type: application/json`
(missing content‑type → **403 even with a valid token**).

| Method | Path | Purpose | Key fields |
|---|---|---|---|
| POST | `/v1/external/auth/login` | Get token | body `{email, password}` → `{token, ...}`. **Token valid 240h (10 days)**; NO refresh endpoint — re‑login. Cache server‑side. |
| POST | `/v1/external/orders/create/adhoc` | Create order + shipment | flat billing/shipping fields, `pickup_location` (EXACT nickname), `order_items[]` `{name, sku, units, selling_price}`, `payment_method` `"Prepaid"|"COD"`, **`sub_total` (REQUIRED — not auto‑computed)**, `length/breadth/height` (cm), `weight` (kg). → `{order_id (SR numeric), shipment_id}` (AWB null here) |
| GET | `/v1/external/courier/serviceability/` | List couriers + rates/ETD | query `pickup_postcode, delivery_postcode, weight (kg), cod (1|0)` → couriers w/ `courier_company_id, rate, etd, estimated_delivery_days` + recommended |
| POST | `/v1/external/courier/assign/awb` | **Assign AWB (picks courier)** | body `{shipment_id (req), courier_id (OPTIONAL)}`. **OMIT `courier_id` → Shiprocket auto‑picks per Courier Priority.** → assigns `awb_code, courier_company_id, courier_name`. Fails on wallet/non‑serviceable/weight/already‑assigned — inspect `message` |
| POST | `/v1/external/courier/generate/label` | Label PDF | body `{shipment_id: number[]}` → `{label_created, label_url}` |
| POST | `/v1/external/manifests/generate` | Manifest PDF | body `{shipment_id: number[]}` → manifest_url. **Note plural `/manifests/…`, NOT `/courier/…`.** |
| POST | `/v1/external/courier/generate/pickup` | Request pickup | body `{shipment_id: number[]}` → `{pickup_scheduled_date, pickup_token_number, ...}` |
| GET | `/v1/external/courier/track/awb/{awb}` | Track (primary) | → `tracking_data { track_status, shipment_status (numeric), shipment_track[], shipment_track_activities[] }` |

**Confirmed status codes** (for the webhook + track mapper): `5`=manifest generated, `42`=picked up,
`6`=shipped, `18`/`20`=in transit, `17`=out for delivery, `7`=delivered, `9`=RTO initiated,
`10`=RTO delivered. **NDR** = an "undelivered"/failed‑attempt scan (NON‑terminal, needs‑action).
⚠️ The full code→label table isn't officially published — **map the confirmed codes, and fall back
to the scan's `sr-status-label` string** (contains "RTO", "Delivered", etc.) for anything unmapped.

**⚠️ Verify against ONE live call before hardcoding:** exact price field types (`selling_price` as
string vs number), the label/manifest response key names, and the `track/shipment/{id}` path. Use the
**`shiprocketdev` public Postman workspace** for live request/response examples.

---

## 3. Build: the real `ShiprocketShippingProvider` (`packages/integrations/src/shipping/shiprocket.ts`)
Implement the `ShippingProvider` interface methods against §2. Extend the interface first if a method
is missing (add `getLabel`, `requestPickup`, `track`; `createShipment`/`assignAwb` already exist) —
and add the same methods to `MockShippingProvider` (fabricated responses) so dev/tests still work.

- **Token management** — a private `token()` that: reads a cached token + expiry from `store_settings`
  (`shiprocket_token`, `shiprocket_token_expires_at`); if missing/within a refresh margin (e.g. < 1 day
  left) or after a 401, calls `/auth/login` and re‑caches (240h TTL). **Never login per request** (rate
  limits + discouraged). All specifics stay INSIDE `packages/integrations` — nothing outside imports
  Shiprocket types (the interface is the only seam).
- `createShipment(input)` → POST `/orders/create/adhoc`. Build the body from the order: address snapshot,
  `order_items` from the order lines (name/sku/units/selling_price), `payment_method` from paymentMode,
  **compute `sub_total` correctly** (sum units×price − discounts), dims/weight from the variants
  (`shipWeightGrams`→kg, length/breadth/height). `pickup_location` from a setting. Return
  `{shiprocketOrderId, shiprocketShipmentId}`.
- `assignAwb({shiprocketShipmentId, courierCompanyId?})` → POST `/courier/assign/awb` **omitting
  `courier_id` unless one is explicitly chosen** (so Courier Priority applies). Return
  `{awbCode, courierName, courierCompanyId, labelUrl?}`.
- `getLabel(shiprocketShipmentIds[])` → POST `/courier/generate/label` → `label_url`.
- `getManifest(shiprocketShipmentIds[])` → POST `/manifests/generate` → manifest_url.
- `requestPickup(shiprocketShipmentIds[])` → POST `/courier/generate/pickup` → `{pickupScheduledDate}`.
- `track(awb)` → GET `/courier/track/awb/{awb}` → normalized `{ status, scans[] }` mapped to `SHIPMENT_STATUSES`.
- **Error handling:** non‑2xx → read the `message` field; classify **transient** (5xx/timeout/429 →
  retry with backoff) vs **permanent** (wallet balance, non‑serviceable, already‑assigned → surface a
  clean error, do NOT retry). Never leak raw Shiprocket payloads to the client.

---

## 4. Build: auto‑push on `packed` (the "no manual Ship Now")
When an order transitions to **`packed`** (admin "Mark packed", `order-actions.ts`), trigger fulfilment:
1. **Idempotency** — if the order already has an active shipment with a `shiprocketOrderId`, do nothing
   (the `shipments_one_active_idx` + a stored `shiprocketOrderId` prevent double‑create).
2. `createShipment` → store `shiprocketOrderId/ShipmentId` on the `shipments` row.
3. `assignAwb` (no `courier_id`) → store `awbCode/courierName/courierCompanyId` + `labelUrl`; advance
   the shipment to `awb_assigned` + append a `shipment_events` row (`source:'manual'` or `'system'`).
4. Do this **best‑effort + out of the packed‑transition tx** (never block or fail the status change on a
   Shiprocket hiccup) — mirror the email best‑effort pattern. If Shiprocket fails, leave the shipment
   `pending` and surface a "needs attention" flag in the console for a manual retry (a `Retry AWB` button).
> Where to hook: extend `apps/web/src/lib/admin/order-actions.ts` (or `lib/admin/shipping.ts`) so
> advancing to `packed` fires an async `pushToShiprocket(orderId)`. Keep the order status‑machine writes
> exactly as they are; add the Shiprocket push alongside.

---

## 5. Build: bulk label + bulk pickup (the morning workflow)
On the admin Shipping console, add **bulk actions** over selected ready‑to‑ship shipments:
- **Bulk print labels** → `getLabel([shiprocketShipmentId...])` → open/merge the returned `label_url`(s);
  store `labelUrl` per shipment.
- **Bulk request pickup** → `requestPickup([...])` → set each shipment `pickup_scheduled` + store
  `pickupScheduledAt`; append events. Route: `POST /api/admin/shipping/bulk` `{action, shipmentIds[]}`,
  guard `shipping:manage`, audited. (Shiprocket accepts arrays — one call per action.)

---

## 6. Build: the tracking webhook (`apps/web/src/app/api/webhooks/shiprocket/route.ts`)
The **auto‑sync** — Shiprocket POSTs a scan; you advance state + notify. **No HMAC** — auth is a static
`x-api-key` header.
1. **Verify** — constant‑time compare `req.headers['x-api-key']` to the secret in `store_settings`
   (`shiprocket_webhook_token`). Mismatch → 401. **Always return 200** on accepted (non‑200 triggers
   Shiprocket retries).
2. **Persist‑then‑ack + dedupe** — the body has `{awb, current_status, current_status_id,
   shipment_status_id, current_timestamp, scans[], order_id, sr_order_id}`. Find the shipment by `awb`;
   **dedupe on `(awb, current_timestamp, current_status_id)`** (the `shipment_events` UNIQUE handles it —
   `onConflictDoNothing`). Store the raw payload in `shipment_events.raw`, `source:'webhook'`.
3. **Map + advance FORWARD ONLY** — map the code (§2) → `SHIPMENT_STATUSES`; only advance if the new
   rank ≥ current (never regress — webhooks arrive out of order/retried). Two dimensions exist
   (`shipment_status_id` = lifecycle vs `current_status_id` = latest scan) — prefer the lifecycle one for
   the shipment status; fall back to the `sr-status-label` string for unmapped codes.
4. **Mirror to the order** — `picked_up`→order shipped is already done at packed; `in_transit`/`out_for_
   delivery`/`delivered` → mirror via `applyStatusTransition` (delivered → order delivered, COD →
   `cod_collected`). **RTO** (`9`/`10`) → `rto_initiated`/`rto_delivered` + order RTO. **NDR** → mark a
   needs‑action flag; do NOT terminal‑ize.
5. **Notify** — on `shipped`/`out_for_delivery`/`delivered`, fire the customer email/SMS (Notifications
   module) with the tracking link — best‑effort.

---

## 7. Build: the reconciliation poller (safety net for missed webhooks)
A scheduled job (~every 30 min) that scans `shipments_stale_poll_idx` (active, non‑terminal,
`last_synced_at` old), calls `track(awb)` for each, upserts `shipment_events` (`source:'poll'`), and runs
the **same mapper + forward‑only advance** as the webhook. Update `last_synced_at`. (Wire via the
project's scheduler/cron; if none exists yet, expose a guarded `POST /api/admin/shipping/poll` an external
cron can hit, and note that a real cron/Inngest is the productionization step.)

---

## 8. Config & secrets
- **Env** (`.env.local`, gitignored — never commit): `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` (the API
  user). Setting `SHIPROCKET_EMAIL` **auto‑switches `getShippingProvider()` to the real provider**.
- **`store_settings`** (via the Settings module): `shiprocket_pickup_location` (nickname), the cached
  `shiprocket_token` + `shiprocket_token_expires_at`, `shiprocket_webhook_token` (the `x-api-key`), and
  optional default `courier_company_id` (leave empty = auto‑pick). Seller identity (name/address/pincode)
  already in settings.
- **No sandbox** — Shiprocket has no true test env. Test against the **live account** with a real (small)
  order, or keep `MockShippingProvider` for CI/dev and only use the real one where `SHIPROCKET_EMAIL` is set.

---

## 9. 🔴 Edge cases — handle/verify every one
1. **Token expiry / 401** → re‑login + retry once; cache the new token (240h). Never login per request.
2. **403 with a valid token** → you forgot `Content-Type: application/json`.
3. **Wallet balance / non‑serviceable / weight‑mismatch / already‑assigned** on `assign/awb` → permanent
   error, surface cleanly + a "Retry AWB" affordance; do NOT retry blindly.
4. **`sub_total` wrong/zero** → invoices + COD amounts wrong. Compute it explicitly, don't send 0.
5. **`pickup_location` mismatch** → order create fails. Must exactly match a registered nickname.
6. **Idempotency (double‑create)** → the one‑active index + stored `shiprocketOrderId` block a 2nd push;
   re‑running the packed trigger must be a no‑op.
7. **Out‑of‑order / duplicate webhooks** → dedupe on `(awb, current_timestamp, current_status_id)` +
   advance forward only. Webhook must return **200** always (or Shiprocket retries/floods).
8. **Two status dimensions** (`shipment_status_id` vs `current_status_id`) — pick lifecycle for the
   shipment; don't let a stale `current_status` regress the state.
9. **Unmapped status code** → fall back to the `sr-status-label` string; log the unknown code, don't crash.
10. **RTO** (`9`/`10`) mirrors to order RTO; **NDR** is needs‑action, not terminal.
11. **Rate limits** (~hundreds/min, plan‑dependent) → backoff on 429/5xx; batch label/pickup calls.
12. **Best‑effort push** → a Shiprocket outage must NEVER block the order status change or the customer;
    leave the shipment `pending` + flag for retry.
13. **Webhook secret leak** → verify `x-api-key` constant‑time; store the token in settings, never in code.
14. **Storefront leak** → expose only `awb/courierName/expectedDeliveryAt` to customers (already enforced);
    never Shiprocket internal ids / label URLs.
15. **Cancel/supersede** → cancel the Shiprocket shipment (if an endpoint is wired) or at least supersede
    locally + stop polling.

---

## 10. Build + test loop
provider (real + extend mock) → token mgr → auto‑push on packed → bulk actions → webhook → poller →
notifications → config. **Unit‑test the pure parts** (status‑code→`SHIPMENT_STATUSES` mapper, the
create/adhoc body builder incl. `sub_total`, webhook dedupe/forward‑only logic) with mock responses.
`typecheck` clean · `test` green · **`build` clean**.

**Verify (needs the live Shiprocket account):** on a real small order — mark packed → shipment created +
AWB assigned (courier auto‑picked) + label URL present; bulk pickup → scheduled; fire a test webhook
(or a real scan) → status advances + order mirrors + notification sent; kill‑switch: unset
`SHIPROCKET_EMAIL` → falls back to Mock. **Confirm the field‑type/response‑key uncertainties (§2) against
your first live 200 response** and adjust.

**Commit** (don't push unless asked):
`Shipping: real Shiprocket integration — auto-push, AWB auto-pick, bulk label/pickup, tracking webhook + poller`
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## 11. Definition of Done
- [ ] Real `ShiprocketShippingProvider` (token cache 240h, create/adhoc, assign/awb auto‑pick, label,
      manifest, pickup, track) — all Shiprocket specifics inside `packages/integrations`
- [ ] Mock provider implements the same extended interface (dev/CI still works); `SHIPROCKET_EMAIL` toggles real
- [ ] Auto‑push on `packed` (idempotent, best‑effort, needs‑attention flag + retry on failure)
- [ ] Bulk **print labels** + **request pickup** admin actions (guarded, audited)
- [ ] Webhook `/api/webhooks/shiprocket` — `x-api-key` verified, dedupe, forward‑only, order mirror, RTO/NDR, always 200
- [ ] Poller safety‑net over stale shipments (same mapper)
- [ ] Shipped/out‑for‑delivery/delivered customer notifications with tracking link (Notifications module)
- [ ] Config: env creds + settings (pickup_location, token cache, webhook token); dashboard setup steps documented
- [ ] Pure mapper + body‑builder + dedupe unit‑tested; typecheck + tests + **build** clean
- [ ] Live‑verified on the real account; §2 field‑type/response‑key uncertainties confirmed

---

## 12. Gotchas
1. **Half the "automation" is the seller's dashboard Courier‑Priority setting** — we just omit `courier_id`.
2. **Token = 240h, no refresh endpoint** — cache in settings, re‑login on expiry/401, never per request.
3. **`Content-Type: application/json` is mandatory** (403 without it).
4. **`sub_total` is not auto‑computed** — send the right number.
5. **`pickup_location` must match a registered nickname exactly.**
6. **Webhook: no HMAC, `x-api-key` static token; must return 200; dedupe + forward‑only.**
7. **No sandbox** — test on the live account (small order) or keep Mock for CI.
8. **`FOR UPDATE` + `LEFT JOIN` → `0A000`** (use `.for('update',{of: shipments})`); **`AddressSnapshot` from `@kakoa/db`**; **`next build` stricter than `tsc`** — the recurring project traps.
9. **Verify the §2 uncertainties on your first live call** (price field types, label/manifest keys, track/shipment path) — `apidocs.shiprocket.in` couldn't be read verbatim; use the `shiprocketdev` Postman workspace.

### Appendix — files to touch/read
| Need | File |
|---|---|
| the stub to implement | `packages/integrations/src/shipping/shiprocket.ts` |
| the interface + mock to extend | `packages/integrations/src/shipping/{provider,mock,index}.ts` |
| the admin console + data layer | `apps/web/src/lib/admin/shipping.ts`, `app/admin/(shell)/shipping/**`, `app/api/admin/shipping/**` |
| order transition to hook (`packed`) | `apps/web/src/lib/admin/order-actions.ts` (`applyStatusTransition`, `ADMIN_ADVANCE_TARGETS`) |
| shipments/events schema + status enum | `packages/db/src/schema/shipments.ts`, `packages/core/src/enums.ts` (`SHIPMENT_STATUSES`) |
| storefront tracking (already reads AWB) | `apps/web/src/lib/orders/tracking.ts` |
| notifications (shipped/delivered) | `docs/admin-platform/HANDOFF-Notifications.md` + `apps/web/src/lib/email/**` |
| the deferred‑phase spec this fulfils | `docs/modules/shipping-fulfillment.md`, `docs/admin-platform/HANDOFF-Shipping.md` (§ deferred) |

Wire the real provider, omit `courier_id` for auto‑pick, add the webhook + poller, and the mock console
becomes the fully automated Shiprocket flow you described. 📦⚡
