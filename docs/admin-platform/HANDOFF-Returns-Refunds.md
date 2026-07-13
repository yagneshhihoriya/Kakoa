# Build Handoff — **Returns & Refunds** module (claim workflow + admin queue)

> **You are a fresh Claude with no prior context. Read this whole file first.**
> This module is the **refund/claim WORKFLOW** for a premium food business where **product
> returns are NOT accepted** (chocolate) — customers claim melt/damage/quality/missing/wrong;
> admins review evidence and **refund or replace WITHOUT a physical return**. It is grounded in
> `docs/REFUND-STRATEGY-RESEARCH.md` (the industry research + hybrid model). The **money
> movement is NOT re‑implemented here** — you REUSE the existing refund money‑path. Match the
> existing admin modules exactly.
>
> Shared conventions: `docs/admin-platform/HANDOFF-Customers-and-Reviews.md` §1.

---

## 0. 🔴 The seam — Returns vs Payments (READ FIRST; prevents duplication)
KAKOA has parallel builds. Keep concerns separate:
- **Payments module** owns **money movement**: the provider refund + the `refunds` ledger +
  `payments.amount_refunded_paise`. It exposes the executor.
- **Returns & Refunds module (THIS)** owns the **workflow**: the customer claim
  (`return_requests`), the admin review **queue**, evidence, **approve/reject/replace**
  decisions, status machine, notifications, fraud gating.
- **When an admin approves a refund, this module CALLS the Payments module's refund executor — it
  does NOT move money itself.** There must be **ONE** admin refund entry point.
  - 🔴 **Reuse `refundPayment({ paymentId, amountPaise, destination, reason, reference? }, adminUserId)`
    from `apps/web/src/lib/admin/payments.ts`** — the Payments module already built the complete
    executor: `FOR UPDATE` over‑refund guard (`remainingRefundablePaise` + `validateRefundAmount`),
    refundable‑status check, **prepaid → `PaymentProvider.refund`** (idempotent, keyed by `refunds.id`,
    reconciled post‑commit) and **COD → manual bank/UPI payout** (reference mandatory), writes the
    `refunds` ledger row + bumps `amount_refunded_paise` + transitions payment status
    (`nextStatusAfterRefund`) + audits. Returns picks the **payment** to refund (an order's captured
    payment) and the **amount** (per §6.1), then calls `refundPayment`.
  - `executeCancelRefund` in `apps/web/src/lib/orders/cancel.ts` is the *cancel/RTO full‑refund* path
    (same provider pipe, so no double‑pay) — do **not** use it for claim decisions; use `refundPayment`.
  - Payments manages **payment** status; Returns manages the **claim** (`return_requests`) status and,
    where relevant, nudges the **order** status. Keep those layers distinct.
- **Notifications** (parallel build) sends the refund‑status comms — this module records the
  status change; the send rides the Notifications provider (best‑effort).
- **Media** (deferred) provides **photo upload** — until it lands, claims accept text + reason
  and an admin can still decide; `photo_urls` is populated once Media exists. Build the admin
  side now; the customer photo‑upload UX is a thin follow‑on.

---

## 1. Project & commands
KAKOA — premium D2C chocolate e‑commerce (India). Turborepo + pnpm; app `apps/web` (pkg `web`),
Next 16 App Router, TS strict, Tailwind v4; DB `@kakoa/db` (Drizzle + postgres‑js). Money = paise.
```bash
pnpm --filter web typecheck && pnpm --filter web test && pnpm --filter web build   # build is stricter than tsc
```
Templates: `lib/admin/order-actions.ts` (guarded transitions + the refund reuse + audit),
`lib/admin/orders.ts` (order read + PII masking), `components/admin/OrderActions.tsx` (action panel),
`lib/admin/inventory.ts` (list + queue shape).

---

## 2. Permissions & nav (NO kernel change needed)
There is **no `returns:*` permission** in the catalog. **Reuse existing keys** — they're the
semantically‑correct ones and avoid touching the kernel/presets/seed:
- **View the queue / a claim** → `orders:read`.
- **Decide / refund / reject / replace** → `orders:refund` (this literally IS a refund action).
Register a lightweight **`returns` module** in `apps/web/src/lib/admin/modules.ts` (nav "Returns"
→ `/admin/returns`, pick an existing icon key e.g. `receipt`; `permissions: [{key:'orders:read',...},
{key:'orders:refund',...}]`, group `commerce`, e.g. `order: 10.5`/place after Orders). The sidebar
renders it from the registry automatically.
> Optional (only if you want a dedicated permission): add `returns:read`/`returns:manage` to
> `packages/kernel/src/permissions.ts` `PERMISSION_KEYS` + the admin/manager presets in `roles.ts`
> + re‑seed roles. **Not required** — reuse is cleaner. If you do it, follow HANDOFF‑Staff‑Roles §2.

---

## 3. Conventions you MUST copy (condensed)
1. **Guard** every route: `requireAdmin('orders:read')` for reads, `requireAdmin('orders:refund')`
   for decisions (`lib/admin/guard.ts`). `auth.value.admin.id` for `decidedBy`/audit.
2. **Envelope**: `jsonOk`/`jsonErr` (`lib/api/http.ts`).
3. **`isUuid(x)`** before any uuid compare (`@/lib/admin/product-validation`) — else `22P02` → 500.
4. **Wrap mutations** in `withConstraintMapping(() => db.transaction(...))` (unwraps `error.cause`);
   the **one‑open‑per‑order** unique index + item‑unique index surface as clean `VALIDATION_ERROR`.
5. **Audit in‑tx**: `admin_audit_log { adminUserId, action:'return.*', entityType:'return_request', entityId, before, after }` for every decision; the money move is audited by the reused refund path.
6. 🔴 **`FOR UPDATE` + `LEFT JOIN` → `0A000`** — scope with `.for('update', { of: returnRequests })`. (Shipped as a real bug in `staff.ts`.)
7. **Client tables resync**: `useEffect(() => setRows(initial), [initial])` after `router.refresh()`.
8. **PII**: the admin claim view shows order contact — **mask** phone (`maskPhone`) unless the actor
   has `customers:pii-view` (mirror `lib/admin/orders.ts`).
9. **Page shell**: `export const dynamic="force-dynamic"`, `<div className="mx-auto max-w-6xl">`; standard palette.
10. **Pure logic → own file + vitest** (the eligibility + refund‑amount rules).

---

## 4. Data model (already in the schema — NO migration). `packages/db/src/schema/returns.ts`

### `return_requests`
`id, orderId (FK→orders CASCADE), customerId (FK→customers SET NULL — NULL = guest via OTP token),
status (return_status DEFAULT 'requested'), reason (return_reason), resolution (return_resolution
DEFAULT 'refund'), comment (text ≤1000 CHECK), photoUrls (text[] DEFAULT '{}'),
decidedBy (FK→admin_users SET NULL), decidedAt, decisionNote, receivedAt, createdAt, updatedAt`.
- **`return_requests_one_open_idx`**: UNIQUE on `order_id` WHERE `status IN
  ('requested','approved','pickup_scheduled')` → **one OPEN claim per order** (dup → clean 400).
- **`return_requests_queue_idx`**: WHERE `status='requested'` → the admin queue.

### `return_request_items`
`id, returnRequestId (FK CASCADE), orderItemId (FK CASCADE), quantity (int CHECK > 0)`.
`UNIQUE(returnRequestId, orderItemId)` — one row per claimed order line.

### Enums (`@kakoa/core`)
- `RETURN_STATUSES`: `requested, approved, rejected, pickup_scheduled, received, refunded, closed, cancelled`.
- `RETURN_REASONS`: `damaged_or_melted, wrong_item, quality_issue, changed_mind, other`.
- `RETURN_RESOLUTIONS`: `refund, replacement`.

### The refund executor to REUSE (built by the Payments module)
`apps/web/src/lib/admin/payments.ts` → **`refundPayment({ paymentId, amountPaise, destination,
reason, reference? }, adminUserId)`** — the single admin refund executor. It already does: over‑refund
guard under `FOR UPDATE`, refundable‑status check, prepaid → gateway (`PaymentProvider.refund`, keyed
by `refunds.id`, reconciled post‑commit) and COD → manual bank/UPI payout, `refunds` ledger row +
`amount_refunded_paise` bump + payment‑status transition + audit. **Returns calls this — do not fork
it.** Supporting pure helpers in `apps/web/src/lib/admin/payment-format.ts`:
`remainingRefundablePaise`, `validateRefundAmount`, `validateRefundDestination`, `isRefundableStatus`,
`isCodPayment`, `nextStatusAfterRefund`, `COLLECTED_PAYMENT_STATUSES` — reuse them, never re‑derive.
(`executeCancelRefund` in `orders/cancel.ts` is the separate cancel/RTO full‑refund path.)

---

## 5. Status machine (guard every transition — pure, unit‑tested `return-status.ts`)
```
requested ──approve──▶ approved ──refund done──▶ refunded ──▶ closed
requested ──reject───▶ rejected (terminal)
requested ──(customer cancel)──▶ cancelled (terminal)
approved  ──(replacement path)──▶ pickup_scheduled ─▶ received ─▶ closed
```
- `canTransitionReturn(from, to)` — only the legal edges above; `refunded/rejected/closed/cancelled`
  are terminal (no further transitions). Reject illegal/backward.
- **Resolution branches**: `resolution='refund'` → approve → **execute refund** → `refunded` →
  `closed`. `resolution='replacement'` → approve → arrange fulfilment (new shipment is a manual/
  Shipping‑module concern) → `received`/`closed`; **no money moves** on a pure replacement.

---

## 6. What to build

### 6.1 Pure rules — `apps/web/src/lib/admin/return-rules.ts` (+ `.test.ts`, no db)
- `isEligibleToClaim({ orderStatus, deliveredAt, reason, nowIso, windowDays, meltWindowHours })` →
  `{ ok } | { ok:false, message }`. Rules: order must be `delivered` (claims are post‑delivery);
  within the window (`return_window_days`, default 7); **melt/damage tighter** (e.g. ≤ 48h from
  delivery — `melt_damage_report_window_hours`). `changed_mind` on perishable → **not eligible for
  refund** (offer goodwill at admin discretion) per the research doc.
- `computeRefundPaise({ orderItems, claimedItems, paidPaise, refundedPaise, shippingPaise,
   reason, shippingRefundableOnFault })` → the refund amount: sum of claimed lines' `lineTotalPaise`
   (per‑line partial), **+ shipping only when at fault** (damage/wrong/never‑delivered),
   **clamped to `paidPaise − refundedPaise`** (never over‑refund). Returns `{ amountPaise, breakdown }`.
- `autoDecision({ reason, amountPaise, account })` → `'auto_approve' | 'manual' | 'auto_reject'`
   per the §3 threshold model (auto‑approve ≤ cap for low‑risk + photo; manual above; auto‑reject
   changed‑mind‑after‑dispatch). All thresholds from `store_settings`.

### 6.2 Data layer — `apps/web/src/lib/admin/returns.ts`
- `listReturns({ status?, reason?, search?, page? })` → join `orders` (number, contact **masked**),
  return `{ id, orderNumber, reason, resolution, status, itemCount, claimedValuePaise, customerRefundCount (risk), createdAt }`. Default `status='requested'` (the queue). Newest/oldest‑first per queue.
- `getReturnDetail(id, canViewPii)` → the claim + `return_request_items` (with product/sku/qty +
  each line's `lineTotalPaise`) + `photo_urls` + linked order summary (paid/refunded/shipping) +
  the customer's **prior refund/claim history** (fraud signal) + computed refundable amount.
- `createReturnRequest({ orderId, reason, resolution, comment, items:[{orderItemId, quantity}],
   photoUrls? }, actor)` — **customer/guest** entrypoint (storefront). tx + `withConstraintMapping`:
  - Auth: the caller owns the order (customer session) or a valid guest **tracking/OTP token** —
    **reuse the tracking auth** (`lib/orders/tracking.ts` `resolveTrackingAuth`). Never let a
    customer claim someone else's order.
  - `isUuid(orderId)`; load order; `isEligibleToClaim(...)`; validate each `orderItemId` **belongs to
    the order** and `quantity ≤ ordered`; the one‑open‑per‑order index blocks duplicates (clean 400).
  - Insert `return_requests` (`status='requested'`, `customerId` = session customer or null for guest)
    + `return_request_items`. Optionally run `autoDecision` → if `auto_approve` for a provable
    low‑value case, chain to the approve+refund path; else leave in the queue. Rate‑limit creation.
- `decideReturn(id, decision, actor)` — **admin** (`orders:refund`). tx + `.for('update', { of: returnRequests })`:
  - `decision.action ∈ { approve_refund, approve_replacement, reject, request_info, mark_received, close }`.
  - Guard the transition (`canTransitionReturn`); block deciding an already‑decided (terminal) claim.
  - **approve_refund**: resolve the order's captured **payment**, compute the amount
    (`computeRefundPaise`, ≤ remaining refundable), call **`refundPayment({ paymentId, amountPaise,
    destination, reason, reference? }, adminUserId)`** (prepaid → source; COD → bank/UPI with the
    entered reference — the executor enforces the guards), set the claim
    `status='refunded'` (→ `closed`), `decidedBy/decidedAt/decisionNote`, **release the coupon
    on a FULL refund** (decrement `coupons.redemption_count` + void `coupon_redemptions`; keep it on
    a partial), audit `return.approve_refund`.
  - **approve_replacement**: set `resolution='replacement'`, `status='approved'`→(fulfilment)→
    `closed`; **no money moves**; audit. (Creating the replacement shipment is the Shipping module.)
  - **reject**: `status='rejected'` + `decisionNote` (a clear, kind reason); audit.
  - **request_info / mark_received / close**: status + note + audit.
  - Every decision → trigger a **notification** (best‑effort) for the customer.

### 6.3 Routes
- `GET  /api/admin/returns` — queue/list (`orders:read`).
- `GET  /api/admin/returns/[id]` — claim detail + items + evidence + refundable (`orders:read`).
- `POST /api/admin/returns/[id]/decide` — `{ action, amountPaise?, destination?, reference?, note? }`
  (`orders:refund`). (Or sub‑routes `/approve`, `/reject`, `/replace` — mirror the Orders `/action` pattern.)
- **Customer‑facing** (storefront, not admin): `POST /api/returns` (or `/api/account/returns`) →
  `createReturnRequest`, guarded by customer session **or** guest tracking token; rate‑limited.

### 6.4 UI (admin)
- `app/admin/(shell)/returns/page.tsx` (server, gate `orders:read`): the **queue** — status filter
  pills (Requested / Approved / Rejected / Refunded / All), reason filter, table (Order · Reason ·
  Items · Claimed ₹ · Risk badge · Age · Status), row → detail.
- `app/admin/(shell)/returns/[id]/page.tsx` (server, gate `orders:read`): claim detail — order link,
  claimed items + amounts, **photo evidence gallery** (renders `photo_urls`; empty‑state when none),
  the customer's **prior‑refund history** + a risk flag, order paid/refunded/shipping, computed
  refundable, and a **decision panel** (only if `orders:refund`): Approve refund (amount defaulting to
  computed, editable ≤ refundable; destination select for COD + reference field), Approve replacement,
  Reject (reason), Request info, Close. Confirm on money actions.
- `components/admin/ReturnDecisionPanel.tsx` (client) — posts to `/decide`; `router.refresh()`;
  disables when not `orders:refund`; surfaces server errors; `[initial]` resync.
- (Storefront customer "Report a problem" form is a follow‑on; text+reason now, photos when Media lands.)

---

## 7. 🔴 Edge cases — test every one
1. **One open claim per order**: a 2nd open claim → clean 400 (the unique index, mapped). A new claim
   after the prior is `rejected/refunded/closed/cancelled` → allowed.
2. **Eligibility window**: claim on a non‑`delivered` order, or past the window, or melt/damage past the
   tighter window → rejected with a clear message.
3. **Item ownership**: `orderItemId` not on the order, or `quantity > ordered` → rejected (never trust the client).
4. **Never over‑refund**: `computeRefundPaise` clamps to `paidPaise − refundedPaise`; partial per‑line;
   the reused money‑path is idempotent → double‑approve can't double‑refund.
5. **Prepaid vs COD**: prepaid → source refund; **COD → bank/UPI payout** requires a destination +
   operator reference (no `original_method` for COD).
6. **Coupon**: FULL refund → release the coupon (customer can reuse); PARTIAL → keep consumed. Document + test.
7. **Shipping fee**: refunded only when KAKOA/courier at fault (damage/wrong/never‑delivered); NOT for
   changed‑mind/goodwill; gated by the `shipping_refundable_on_fault` setting.
8. **GST**: refund is proportional (prices GST‑inclusive) — the amount carries the embedded tax; note the
   **credit‑note** obligation (the finance/invoice concern; the money amount is correct as‑is).
9. **changed_mind on perishable** → not refund‑eligible; admin may issue **goodwill** (store credit /
   discretionary) — reject with a kind, food‑safety‑framed message.
10. **"Not received" on a `delivered` order** → **never auto‑approve**; force manual + delivery proof
    (courier scan/POD) — fraud‑sensitive.
11. **Guest claims** (`customerId` null): authenticated via the guest tracking/OTP token, never by
    order number alone.
12. **Status‑machine guards**: can't refund a `rejected`/`cancelled` claim; can't re‑decide a terminal
    claim; illegal transition → `INVALID_TRANSITION` (no DB write).
13. **Replacement** sets no money in motion; the actual replacement shipment is the Shipping module.
14. **Fraud gating**: high prior‑refund‑count / `customers.is_blocked` / high velocity → force manual,
    surface the risk in the queue; block auto‑approval.
15. **`FOR UPDATE` + JOIN → `0A000`** — scope with `.for('update', { of: returnRequests })`.
16. Malformed `[id]`/`orderId` → `NOT_FOUND` (isUuid), never 500. Rate‑limit customer claim creation.
17. **PII**: order contact masked in the admin view unless `customers:pii-view`; never log raw contact.
18. Every decision writes an `admin_audit_log` row; the refund writes the `refunds` ledger row (reused path).

---

## 8. Build + TEST loop
pure rules (`return-rules` + `return-status`) → data layer → routes → admin UI → **unit tests** →
gate (typecheck + test + **build**) → live‑verify → self‑review → commit.

### 8.1 Tests (REQUIRED)
- Unit‑test the pure logic: `isEligibleToClaim` (window, melt window, non‑delivered, changed‑mind),
  `computeRefundPaise` (per‑line partial, shipping‑on‑fault, clamp to remaining, over‑refund guard),
  `autoDecision` (threshold model), `canTransitionReturn` (legal + illegal/terminal).
- `typecheck` clean · `test` green · **`build` clean**; new routes appear.

### 8.2 Live verify (dev :3000; `owner@kakoa.in`, OTP `000000`)
Use a **delivered** order (advance one via the flow, or seed). Then via `fetch`:
- Create a claim (reason `damaged_or_melted`, 1 item) → appears in the queue; create a 2nd open claim
  on the same order → 400. Claim an item not on the order / qty too high → 400. Claim on a
  non‑delivered order → 400.
- **Approve refund** (prepaid order) → `executeCancelRefund` runs → `refunds` ledger row + order
  `amount_refunded_paise` bumped + claim `status='refunded'` + audit; **re‑approve** → not double‑refunded.
- Over‑refund attempt (amount > refundable) → 400. Reject a claim → `rejected` + note. changed‑mind →
  not eligible. Confirm coupon released on a full refund.
- A `orders:read`‑only context can view the queue but **can't decide** (403 on `/decide`).
- Confirm every decision wrote an audit row. Screenshot the queue + a claim detail.

### 8.3 Adversarial self‑review
Hunt for: over‑refund / double‑refund, claiming another user's order, item‑ownership bypass, deciding a
terminal claim, one‑open‑per‑order race → 500, coupon double‑release, `orders:read` reaching `/decide`,
PII leak, `FOR UPDATE`+JOIN `0A000`, missing audit. Fix, re‑verify.

### 8.4 Commit (don't push unless asked)
```
Admin Returns & Refunds: claim queue + evidence + approve/reject/replace, reuses refund money-path

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## 9. Definition of Done
- [ ] typecheck clean · tests green (rules + status machine unit‑tested) · **build clean**
- [ ] Reuses the Payments module's **`refundPayment`** executor for money — **no second refund implementation**
- [ ] Queue + claim detail (items, evidence, refundable, risk history) render; filters work
- [ ] Decisions: approve‑refund / approve‑replacement / reject / request‑info / close — all guarded, audited
- [ ] Refund **never exceeds remaining refundable**; per‑line partial; idempotent (no double‑refund)
- [ ] Prepaid → source; **COD → bank/UPI payout** (destination + reference)
- [ ] Coupon released on full refund (kept on partial); shipping refunded only on fault; GST proportional
- [ ] One‑open‑per‑order + item‑ownership + window + changed‑mind rules enforced (clean 400s)
- [ ] Guest claims via tracking token only; "not received on delivered" forced manual + proof
- [ ] `orders:refund` gates decisions; `orders:read` gates views; PII masked; fraud flags surfaced
- [ ] `returns` module registered (nav "Returns"); customer claim API rate‑limited
- [ ] Live‑verified incl. refund reuse + over‑refund guard + reject + coupon release

---

## 10. Gotchas (do NOT repeat this project's history)
1. **ONE refund executor** — reuse the Payments module's `refundPayment`; a second money‑path is a hard reject. (`executeCancelRefund` is the separate cancel/RTO path.)
2. **`FOR UPDATE` + `LEFT JOIN` → `0A000`** — use `.for('update', { of: returnRequests })` (staff.ts bug).
3. **`pgConstraintMessage` unwraps `error.cause`** (handled) — the one‑open + item‑unique indexes map to clean 400s.
4. **`AddressSnapshot` is from `@kakoa/db`, not `@kakoa/core`** (a parallel build broke on this).
5. **`next build` is stricter than `tsc --noEmit`** — always run build.
6. **`useState(initialProp)` never resyncs** — add the `[initial]` effect after refresh.
7. **Never trust the client** — validate order ownership + item ownership + amount server‑side.
8. **Money is auditable** — the reused refund path audits the money move; you audit the decision.

### Appendix — files to read/imitate
| Need | File |
|---|---|
| the refund EXECUTOR to REUSE | `apps/web/src/lib/admin/payments.ts` (`refundPayment`) — the Payments module's engine |
| remaining‑refundable math | `apps/web/src/lib/admin/payment-format.ts` (`remainingRefundablePaise`) |
| returns schema + enums | `packages/db/src/schema/returns.ts`, `packages/core/src/enums.ts` (RETURN_*) |
| guarded transition + audit + refund reuse | `apps/web/src/lib/admin/order-actions.ts` |
| order read + PII masking | `apps/web/src/lib/admin/orders.ts` (`maskPhone`) |
| guest tracking auth (for customer claims) | `apps/web/src/lib/orders/tracking.ts` (`resolveTrackingAuth`) |
| action panel UI | `apps/web/src/components/admin/OrderActions.tsx` |
| the strategy behind this module | `docs/REFUND-STRATEGY-RESEARCH.md` |

**Remember:** this module is the **workflow**; Payments moves the money. Build the queue + evidence +
decisions, call the shared refund path, keep it food‑appropriate (no returns, photo‑gated, replace‑or‑
refund), and fraud‑safe. 🍫↩️
