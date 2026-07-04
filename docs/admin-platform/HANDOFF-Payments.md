# Build Handoff — Admin **Payments** module

> **You are a fresh Claude with no prior context. Read this whole file first.**
> This module handles **money** — refunds and COD remittance. Correctness beats
> features: never over‑refund, make refunds idempotent, and reuse the existing
> refund money‑path (do NOT write a second one). Match the existing admin modules
> exactly.
>
> Shared conventions live in `docs/admin-platform/HANDOFF-Customers-and-Reviews.md`
> §1 (guard, HTTP envelope, `isUuid`, `withConstraintMapping`, audit‑in‑tx, client
> resync, page shell, typed routes). This file restates the critical ones and adds
> everything Payments‑specific.

---

## 0. Project & commands

**KAKOA** — premium D2C chocolate e‑commerce for India. Turborepo + pnpm monorepo.
- Repo root `/Users/yagneshpatel/Downloads/Projects/Kakoa`; app `apps/web` (pkg `web`),
  Next.js 16 App Router, React 19, TS strict, Tailwind v4.
- DB `packages/db` (`@kakoa/db`), Drizzle + postgres‑js, Supabase Postgres.
- Money is **integer paise** everywhere; `formatPaise` from `@kakoa/core`.
```bash
pnpm --filter web typecheck   # tsc --noEmit
pnpm --filter web test        # vitest run
pnpm --filter web build       # next build
```
**Templates to copy:** `lib/admin/{orders,inventory,coupons}.ts`,
`app/admin/(shell)/inventory/page.tsx`, `app/api/admin/inventory/[variantId]/adjust/route.ts`,
`components/admin/InventoryTable.tsx`.

---

## 1. Conventions you MUST copy (condensed)
1. **Guard every route** — `requireAdmin('payments:read' | 'payments:refund')` from
   `lib/admin/guard.ts`; `if (!auth.ok) return auth.response;`. `auth.value.admin.id`
   for audit, `auth.value.ctx.can(...)` for conditional UI.
2. **HTTP envelope** — `jsonOk(data,{cacheControl:NO_STORE})` / `jsonErr(code,msg)`
   (`lib/api/http.ts`). Client reads `data.ok` / `data.error.message`.
3. **`isUuid(x)`** (`@/lib/admin/product-validation`) before any uuid compare (`22P02` → 500 otherwise).
4. **Wrap mutations** in `withConstraintMapping(() => db.transaction(...))` (`@/lib/admin/db-errors`).
5. **Audit in‑tx** — `admin_audit_log { adminUserId, action, entityType, entityId, before, after }`.
6. **Money guards** — every paise column is Postgres `int4` (max 2,147,483,647); the
   `payments` table has CHECKs `amount_paise > 0` and `amount_refunded_paise <= amount_paise`.
7. **Client tables resync**: `useEffect(() => setRows(initial), [initial])` after `router.refresh()`.
8. **Page shell**: `export const dynamic="force-dynamic"`, `<div className="mx-auto max-w-6xl">`.
   Palette: ink `#2a1d12`, border `#eadbc6`, muted `#8a7a68`, active pill
   `bg-[#2a1d12] text-[#f3e7d5]`, success `#3f8a54`, danger `#b25b5b`, warn `#a9791f`.
9. **Nav is automatic** — the `payments` module is already in
   `apps/web/src/lib/admin/modules.ts` (order 17, nav "Payments" → `/admin/payments`,
   perms `payments:read`, `payments:refund`). Don't touch the sidebar.
10. Pure formatting → own file + vitest.

---

## 2. Data model (already in the schema — read `packages/db/src/schema/payments.ts`)

### `payments` — one row per payment ATTEMPT (retries create new rows, never mutate old)
`id, orderId (FK), provider (razorpay|mock|cod…), providerOrderId, providerPaymentId,
method (card|upi|netbanking|wallet|emi|cod|unknown), status, amountPaise,
amountRefundedPaise (default 0), signatureVerified (bool), failureCode, failureReason,
codRemittedAt, codRemittanceRef, rawPayload (jsonb — provider debug), createdAt, updatedAt`.
CHECKs: `amount_paise > 0`, `amount_refunded_paise <= amount_paise`. Unique indexes on
`(provider, providerPaymentId)` and `(provider, providerOrderId)`.

**`PAYMENT_STATUSES`** (`@kakoa/core`): `created, authorized, captured, failed,
partially_refunded, refunded, cod_pending_collection, cod_collected,
cod_pending_remittance` (+ maybe `cod_remitted`). Read the enum for the exact list.
- **Collected/settled money** = `captured, partially_refunded, refunded, cod_collected,
  cod_pending_remittance` — this is the exact "collected" set used in
  `apps/web/src/lib/admin/metrics.ts`; **reuse that constant**, don't re‑derive.

### `refunds` — one row per refund INSTRUCTION
`REFUND_STATUSES = ['initiated','processed','failed']`;
`REFUND_DESTINATIONS = ['original_method','bank_transfer','upi']`. Prepaid refunds go
back to the original method via Razorpay; **COD refunds are manual payouts** with an
operator‑entered reference. Read the `refunds` table for its columns
(`orderId, paymentId?, amountPaise, status, destination, providerRefundId, reason,
initiatedBy (adminUsers), reference, createdAt`).

### 🔴 REUSE THE EXISTING REFUND PATH — do not write a new one
Refunds are already implemented for order cancellation. Reuse it:
- `apps/web/src/lib/orders/cancel.ts` exports `executeCancelRefund` + `RefundIntent`.
- `PaymentProvider.refund(...)` with Razorpay + Mock implementations
  (`@kakoa/integrations` / `lib/checkout` provider). It bumps
  `payments.amountRefundedPaise`, writes a `refunds` row, restocks, and flips the
  order/payment status — **all in one transaction, idempotently**.
- Admin order cancel already calls this (`apps/web/src/lib/admin/order-actions.ts`).
Your Payments "refund" action should call the **same** function (or a thin wrapper),
not a parallel implementation. Grep `executeCancelRefund` and `PaymentProvider` and follow it.

---

## 3. What to build — `/admin/payments` (`payments:read`, `payments:refund`)

Scope it as **financial visibility + refund + COD remittance marking**. Read‑heavy.

### 3.1 Data layer — `apps/web/src/lib/admin/payments.ts`
- `listPayments({ search?, status?, method?, page? })` → join `orders` for order
  number + contact (mask phone via `maskPhone` — see `orders.ts`); return
  `id, orderNumber, provider, method, status, amountPaise, amountRefundedPaise,
  createdAt`. `search` matches order number / providerPaymentId (ilike, escape `%_\`).
  Filter by `status` and `method`. Newest first. Paginate ~30.
- `getPaymentDetail(id)` → the payment + its order summary + the list of `refunds`
  rows for it (amount, status, destination, reference, when, by whom). `isUuid` guard;
  `null` if not found. **Do not** send `rawPayload` to the client unless you redact it
  — it can contain provider PII/tokens; prefer showing only `failureCode/failureReason`.
- `listCodRemittanceQueue()` → payments in `cod_collected` / `cod_pending_remittance`
  (the `payments_cod_remit_idx` set) for the remittance view.
- `refundPayment({ paymentId, amountPaise, destination, reason }, adminUserId)` →
  **thin wrapper that calls the existing `executeCancelRefund` / `PaymentProvider.refund`
  path.** Validate: `isUuid`, `amountPaise` integer `> 0`, and
  `amountPaise <= amountPaise_remaining` where remaining = `amountPaise -
  amountRefundedPaise` (read `FOR UPDATE`). Audit `payment.refund`. Idempotency +
  the actual money move are handled by the reused path — do not duplicate them.
- `markCodRemitted({ paymentId, reference }, adminUserId)` → set `status` →
  remitted, `codRemittedAt = now()`, `codRemittanceRef = reference`; only valid from
  a COD‑collected state; audit `payment.cod-remit`. Wrap in `withConstraintMapping`.

### 3.2 Routes
- `GET  /api/admin/payments` — list. Guard `payments:read`.
- `GET  /api/admin/payments/[id]` — detail (+ refunds). Guard `payments:read`.
- `POST /api/admin/payments/[id]/refund` — body `{ amountPaise, destination, reason }`.
  Guard `payments:refund`.
- `POST /api/admin/payments/[id]/remit` — body `{ reference }` (mark COD remitted).
  Guard `payments:refund` (or add if a `payments:remit` perm exists — check the manifest;
  if not, gate on `payments:refund`).

### 3.3 UI
- `app/admin/(shell)/payments/page.tsx` (server, gate `payments:read`): filter pills
  by status (All / Captured / Refunded / COD‑pending…), method filter, search, table
  (Order · Provider/Method · Amount · Refunded · Status · When), row → detail.
  Optionally a "COD remittance" tab/filter using `listCodRemittanceQueue`.
- `app/admin/(shell)/payments/[id]/page.tsx` (server, gate `payments:read`): payment
  summary, linked order, the refunds list, and — if `payments:refund` — a
  **Refund panel** (amount defaulting to the remaining refundable, destination select,
  reason) and a **Mark COD remitted** control for COD‑collected payments.
- `components/admin/PaymentRefundPanel.tsx` (client): posts to `/refund`;
  `router.refresh()`; disable when remaining refundable is 0; show server errors;
  confirm dialog (money action). Model on `InventoryTable`'s adjust panel.

### 3.4 🔴 Money edge cases (test every one)
1. **Never over‑refund**: reject `amountPaise > (amountPaise − amountRefundedPaise)`
   with a clear message; compute remaining under `FOR UPDATE`.
2. **Partial refunds**: multiple partial refunds sum to ≤ total; status becomes
   `partially_refunded` then `refunded` at full — the reused path handles this; verify.
3. **Idempotency**: a double‑submitted refund must not double‑refund (the reused path
   is idempotent; confirm with a repeat request in verification).
4. **Refunding a `failed`/`created` payment** (never captured) → reject (nothing to refund).
5. **COD refund** → destination must be `bank_transfer`/`upi` (no `original_method`);
   requires an operator reference; it's a manual payout instruction, not a Razorpay call.
6. **Mark‑remitted only from a COD‑collected state**; not from prepaid; idempotent.
7. `signatureVerified = false` payments are suspect — surface a warning; do not block
   reads, but be cautious about actions.
8. Malformed `[id]` → NOT_FOUND (isUuid). 9. `rawPayload` never leaked unredacted.
10. Amount overflow / non‑integer / negative → VALIDATION_ERROR (int4 + `>0`).
11. Every refund / remit writes an `admin_audit_log` row.
12. A `payments:read`‑only admin cannot refund or remit (route enforces `payments:refund`).

---

## 4. Build + TEST loop (same discipline as every shipped module)
data layer → routes → UI → **pure‑logic unit tests** → gate → live‑verify → self‑review → commit.

### 4.1 Tests
- Unit‑test pure helpers: remaining‑refundable math (`remaining = amount − refunded`,
  clamp, reject over‑refund), status/label formatting, the collected‑status predicate.
  Put pure logic in `lib/admin/payment-format.ts` (+ `.test.ts`), no `@kakoa/db` import.
- `pnpm --filter web typecheck` clean · `test` green · `build` clean (new routes listed).

### 4.2 Live verify (dev server :3000; sign in as `owner@kakoa.in`, OTP `000000`)
Drive the real API via `fetch` and assert DB effects:
- List payments; open a captured prepaid payment; **refund a partial amount** →
  `amountRefundedPaise` increases, a `refunds` row (`initiated`) appears, status →
  `partially_refunded`; **refund the remainder** → `refunded`; **try to over‑refund** →
  rejected. **Repeat the same refund request** → not double‑charged (idempotent).
- Mark a `cod_collected` payment remitted with a reference → status + `codRemittedAt`
  + `codRemittanceRef` set; repeat → idempotent/no‑op.
- Confirm every action wrote an `admin_audit_log` row.
- Confirm a `payments:read`‑only context is refused refund/remit (401/403).
Screenshot the list + a payment detail with its refund history.

### 4.3 Adversarial self‑review
Hunt specifically for: over‑refund paths, non‑idempotent refunds, refunding
non‑captured payments, `rawPayload`/PII leakage, missing `isUuid`/audit, unmapped
constraint → 500, and a `payments:read` user reaching a mutating route. Fix, re‑verify.

### 4.4 Commit (do NOT push unless asked)
```
Admin Payments: transactions view + refund (reuse refund path) + COD remittance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## 5. Definition of Done
- [ ] typecheck clean · tests green (refund math + formatting unit‑tested) · build clean
- [ ] Refund action **reuses** `executeCancelRefund` / `PaymentProvider.refund` — no second money path
- [ ] Over‑refund impossible (remaining computed under `FOR UPDATE`); partials sum correctly
- [ ] Refund is idempotent (verified with a repeated request)
- [ ] COD refund requires bank/UPI + reference; mark‑remitted only from COD‑collected, idempotent
- [ ] `rawPayload` / provider PII never sent unredacted; contact phone masked
- [ ] `payments:refund` enforced server‑side on every mutating route; reads gated `payments:read`
- [ ] Every mutation `isUuid`‑guarded, `withConstraintMapping`‑wrapped, audited in‑tx
- [ ] Live‑verified end‑to‑end; audit rows + refund rows + status transitions confirmed

---

## 6. Gotchas (from this project's history)
1. **`pgConstraintMessage` unwraps `error.cause`** — drizzle wraps the PostgresError;
   `.code` is undefined on the top‑level error. (Already handled in `db-errors.ts`.)
2. **Every paise column is `int4`** (max 2,147,483,647) — validate amounts before the DB (`22003`).
3. **`useState(initialProp)` never resyncs** — add the `[initial]` effect after refresh.
4. **Never compare a raw string to a uuid column** — `isUuid` first (`22P02` → 500).
5. **Do not fork the refund logic** — money‑critical code must have ONE implementation;
   reuse `executeCancelRefund`. A reviewer will reject a second refund path.
6. Admin mutations are **audited in‑tx** — a missing audit row is a review failure.

---

### Appendix — files to read/imitate
| Need | File |
|---|---|
| the refund money‑path to REUSE | `apps/web/src/lib/orders/cancel.ts` (`executeCancelRefund`, `RefundIntent`), `apps/web/src/lib/admin/order-actions.ts` |
| payment/refund provider | grep `PaymentProvider` (Razorpay + Mock) |
| collected‑status set + net revenue | `apps/web/src/lib/admin/metrics.ts` |
| list + filters + table | `app/admin/(shell)/inventory/page.tsx` + `components/admin/InventoryTable.tsx` |
| money action panel | `components/admin/InventoryTable.tsx` (adjust panel) |
| PII masking | `apps/web/src/lib/admin/orders.ts` (`maskPhone`) |
| schema | `packages/db/src/schema/payments.ts` |

After Payments, the remaining modules are **Shipping** (Shiprocket — external, mocked),
**Taxes** (GST config), **Settings** (store config / feature flags), **Media**,
**Notifications**, **Analytics/Reports**. Build **Payments** carefully — it moves money. 🍫
