# Build Handoff — Admin **Analytics & Reports** module

> **You are a fresh Claude with no prior context. Read this whole file first.**
> Analytics is **READ‑ONLY** — no mutations, no audit, no money moves. But it reports on
> money, so **correctness = reconciliation**: your totals MUST match the Dashboard
> (`lib/admin/metrics.ts`) to the paise, because both must use the *same* "collected
> payment" definition and the same net = gross − refunds rule. Reuse the shared
> constants; never re‑derive "revenue". Match the existing admin modules exactly.
>
> Shared conventions: `docs/admin-platform/HANDOFF-Customers-and-Reviews.md` §1. This
> file restates the critical ones and adds everything Analytics‑specific.

---

## 0. Project & commands
**KAKOA** — premium D2C chocolate e‑commerce for India. Turborepo + pnpm monorepo.
- Repo root `/Users/yagneshpatel/Downloads/Projects/Kakoa`; app `apps/web` (pkg `web`),
  Next.js 16 App Router, React 19, TS strict (`noUncheckedIndexedAccess`), Tailwind v4.
- DB `packages/db` (`@kakoa/db`), Drizzle + postgres‑js. Money = **integer paise**;
  `formatPaise` from `@kakoa/core`.
```bash
pnpm --filter web typecheck   # tsc --noEmit
pnpm --filter web test        # vitest run
pnpm --filter web build       # next build — STRICTER than typecheck; ALWAYS run it
```
Templates to copy: `lib/admin/metrics.ts` (the compute layer you EXTEND),
`app/admin/(shell)/page.tsx` (the Dashboard — cards over metrics),
`app/admin/(shell)/inventory/page.tsx` (list + filters shell).

---

## 1. Conventions you MUST copy (condensed)
1. **Guard every route** — `requireAdmin('analytics:read')` for reads,
   `requireAdmin('reports:export')` for CSV export (`lib/admin/guard.ts`).
   `auth.value.ctx.can('reports:export')` gates the export buttons in the UI.
2. **HTTP envelope** — `jsonOk(data,{cacheControl:NO_STORE})` / `jsonErr(code,msg)` (`lib/api/http.ts`).
   CSV export returns a raw `Response` with `text/csv` (see §7) — NOT `jsonOk`.
3. **`isUuid(x)`** (`@/lib/admin/product-validation`) before using any id filter (category/product) in a query.
4. **NO `withConstraintMapping`, NO `admin_audit_log`** — this module never writes. (Exports
   are reads; you may optionally audit an export, but it's not required.)
5. **Clamp all params** — date range, `limit`, `bucket` — to sane finite bounds (a huge
   range or `?limit=1e9` must not run an unbounded query).
6. **Client resync**: `useEffect(() => setState(initial), [initial])` after any client refetch.
7. **Page shell**: `export const dynamic="force-dynamic"`, `<div className="mx-auto max-w-6xl">`.
   Palette: ink `#2a1d12`, border `#eadbc6`, muted `#8a7a68`, active pill
   `bg-[#2a1d12] text-[#f3e7d5]`, success `#3f8a54`, danger `#b25b5b`, warn `#a9791f`, info `#4a6b8a`.
8. **Nav is automatic** — the `analytics` module is registered in
   `apps/web/src/lib/admin/modules.ts` (order 40, group insight, nav "Analytics" →
   `/admin/analytics`, icon `chart`, perms `analytics:read`, `reports:export`). Don't touch the sidebar.
9. **Pure logic → own file + vitest** (CSV serializer, date bucketing, % maths).

---

## 2. 🔴 The revenue definition — REUSE, never re‑derive (this is the whole ballgame)
`apps/web/src/lib/admin/payment-format.ts` is the single source of truth. Import:
- `COLLECTED_PAYMENT_STATUSES` — the exact "money we actually took" set
  (`captured, partially_refunded, refunded, cod_collected, cod_pending_remittance`).
- `isCollectedStatus(status)`, `INT4_MAX`.
`lib/admin/metrics.ts` (`computeDashboardMetrics`) defines the canonical maths — **read it
and mirror it exactly**:
- **gross** = `sum(payments.amountPaise) FILTER (WHERE status IN COLLECTED)`.
- **refunded** = `sum(payments.amountRefundedPaise)` (across all payments).
- **net revenue** = gross − refunded.
- **paidOrders** = `count(DISTINCT payments.orderId) FILTER (status IN COLLECTED)`.
- **AOV** = net / paidOrders (0 when no paid orders — guard the divide).
> Your range/timeseries totals MUST fold up to the same net as the Dashboard for an
> all‑time range. If they don't reconcile, your query is wrong. This is the #1 test.

### 2.1 int4 overflow — SUMs must be bigint
Money columns are `int4`. `SUM(amount_paise)` over many rows can exceed 2,147,483,647.
Cast sums to `::bigint` in SQL and coerce with `Number(...)` in JS (the Dashboard/customers
layer already does `::bigint`). A revenue report that 500s on a big month is a real bug.

### 2.2 IST calendar (match the Dashboard's "today")
All day/week/month buckets are **Asia/Kolkata**. Bucket by `orders.placedAt` converted to
IST: `date_trunc('day', ${orders.placedAt} at time zone 'Asia/Kolkata')`. The Dashboard's
"today" uses `date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'`
— reuse the same boundary logic so a day's revenue lines up with "ordersToday".

---

## 3. Data model you read (NO writes, NO migration)
- `orders` — `id, status, paymentMode ('prepaid'|'cod'), deliveryOpt, subtotalPaise,
  totalPaise, placedAt, categoryId? (no — on products), customerId?`. Bucket by `placedAt`.
- `payments` — `orderId, status, amountPaise, amountRefundedPaise` (the revenue source of truth).
- `order_items` — `orderId, productId, variantId, sku (snapshot), unitPricePaise (snapshot),
  quantity, lineTotalPaise (snapshot = unit*qty + gift_wrap)`. Source for best‑sellers.
- `products` (name, categoryId), `categories` (name) — for grouping best‑sellers / sales‑by‑category.
- `product_variants` (stockQuantity, lowStockThreshold, isActive) — low‑stock snapshot (reuse metrics).
- `coupon_redemptions` (couponId, discountPaise, createdAt) + `coupons` (code) — coupon usage.
- `customers` (id, createdAt) — new‑vs‑returning (count orders per customer).

**Revenue‑recognized population**: for best‑sellers / sales‑by‑category, only count
`order_items` whose order has a **collected payment** (join `payments` with `isCollectedStatus`),
NOT every placed order — otherwise failed/pending/abandoned orders inflate the numbers.

---

## 4. Metrics to build (`apps/web/src/lib/admin/analytics.ts`)
Every function takes a resolved `{ fromIso, toIso }` range (see §5) and returns coerced numbers.

1. `getSummary(range)` → `{ netRevenuePaise, grossRevenuePaise, refundedPaise, orders,
   paidOrders, aovPaise, unitsSold, refundRatePct, prepaidRevenuePaise, codRevenuePaise,
   newCustomers, returningCustomers }` — the headline cards for the range.
2. `getRevenueTimeseries(range, bucket: 'day'|'week'|'month')` →
   `{ bucketStartIso, netRevenuePaise, orders, paidOrders }[]` — **zero‑filled** across every
   bucket in the range (no gaps for days with no orders). This drives the chart.
3. `getBestSellers(range, { by: 'revenue'|'units', limit })` →
   `{ productId, productName, sku, unitsSold, revenuePaise }[]` — top N, revenue‑recognized only.
4. `getSalesByCategory(range)` → `{ categoryId, categoryName, revenuePaise, unitsSold }[]`.
5. `getPaymentSplit(range)` → prepaid vs COD `{ orders, netRevenuePaise }` each.
6. `getStatusBreakdown(range)` → order count per `ORDER_STATUSES` (reuse the Dashboard shape).
7. `getCouponUsage(range)` → `{ code, redemptions, totalDiscountPaise }[]` (top codes).
8. `getLowStock()` → count + the top‑N lowest variants (reuse metrics' low‑stock predicate; not range‑bound).

> Keep each query bucketed/filtered in SQL (don't pull rows into JS and aggregate). Use
> `FILTER (WHERE …)` + `generate_series` (for zero‑fill) + `::bigint` sums.

---

## 5. Date range handling (`apps/web/src/lib/admin/analytics-range.ts`, PURE + tested)
- `resolveRange(input)` accepts `{ preset?: '7d'|'30d'|'90d'|'mtd'|'ytd'|'all', from?, to? }`.
  Default `30d`. Custom `from`/`to` are ISO dates; validate they parse, `from <= to`, and
  **cap the span** (e.g. ≤ 731 days) to bound the query + zero‑fill. Return
  `{ fromIso, toIso, bucketDefault }` where boundaries are **IST day starts**.
- `bucketsFor(range, bucket)` → the list of bucket start timestamps for zero‑filling in JS
  (or do it in SQL with `generate_series` at IST). Reject `bucket='day'` on an `all`/multi‑year
  range (too many points) — auto‑upgrade to week/month.
- Unit‑test: presets resolve to the right IST boundaries, `from>to` rejected, span cap,
  bucket auto‑upgrade.

---

## 6. Routes
- `GET /api/admin/analytics/summary?…range` — `getSummary`. Guard `analytics:read`.
- `GET /api/admin/analytics/timeseries?range&bucket` — `getRevenueTimeseries`. `analytics:read`.
- `GET /api/admin/analytics/best-sellers?range&by&limit` — `getBestSellers`. `analytics:read`.
- `GET /api/admin/analytics/breakdown?range` — category + payment split + status + coupons
  (bundle the small ones). `analytics:read`.
- `GET /api/admin/analytics/export?report=orders|best-sellers|revenue&range` — **CSV** (§7).
  Guard `reports:export`.
(You may also fold summary+breakdown into the page's server component directly, since it's
`force-dynamic` — the routes are for the client range‑switcher + export.)

---

## 7. CSV export (`apps/web/src/lib/admin/csv.ts`, PURE + tested) 🔴 injection‑safe
No CSV helper exists — build one:
- `toCsv(headers: string[], rows: (string|number|null)[][]): string` — RFC‑4180: wrap a
  cell in `"…"` and double internal quotes if it contains `, " \n \r`; join rows with `\r\n`.
- 🔴 **CSV injection defense**: if a string cell starts with `= + - @` (or tab/CR), prefix it
  with a single quote `'` so spreadsheets don't execute it as a formula. Do this for every
  text cell (order numbers, SKUs, product names, coupon codes).
- Money in exports: emit **rupees** with 2 decimals (`paise/100`) in a clearly‑labelled
  column (e.g. "Net revenue (₹)"), or emit paise with a "…(paise)" header — pick one and be
  consistent. Dates as ISO (or IST `YYYY-MM-DD`).
- Route returns `new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8',
  'content-disposition': \`attachment; filename="kakoa-<report>-<range>.csv"\`, 'cache-control': 'no-store' }})`.
- Cap export rows (e.g. ≤ 50,000) and `log`/note if truncated — never stream an unbounded table.

---

## 8. UI
- `app/admin/(shell)/analytics/page.tsx` (server, gate `analytics:read`): a **range switcher**
  (7d / 30d / 90d / MTD / YTD / All — as links that set `?preset=`), headline **cards**
  (net revenue, orders, paid orders, AOV, units, refund rate) styled like the Dashboard,
  a **revenue chart**, a **best‑sellers** table, **sales‑by‑category** + **payment split** +
  **coupon usage** panels, and **Export CSV** buttons (only if `reports:export`).
- **Chart with NO external library** (CSP/self‑contained): render an inline **SVG** bar or
  line chart from the timeseries (compute x/y from the bucket array; label a few ticks).
  A simple `<svg viewBox>` with `<rect>`/`<polyline>` is enough — keep it accessible
  (title + aria‑label). Do not add a charting dependency.
- `components/admin/AnalyticsRangeSwitcher.tsx` (client) if you want client‑side range
  changes without full reload; otherwise server links are fine (simpler, `force-dynamic`).
- `components/admin/RevenueChart.tsx` (can be a server component — it just renders SVG from props).

---

## 9. 🔴 Edge cases — test/verify every one
1. **Reconciliation**: `getSummary({all})` net revenue == Dashboard `netRevenuePaise`;
   paidOrders + AOV match. (The single most important test.)
2. **int4 overflow**: a range with large revenue → `::bigint` sums, no `22003` 500.
3. **Empty range** (no orders in window) → all zeros, empty tables, chart renders an empty
   axis — never `NaN`/`Infinity`. **AOV divide‑by‑zero** → 0.
4. **Refund attribution**: refunds are subtracted from gross (net); decide + document
   whether a refund lands in the order's placement bucket (recommended — matches the
   Dashboard and keeps the timeseries reconciling) vs the refund date. Be consistent.
5. **Revenue‑recognized best‑sellers**: exclude order_items from failed/pending/cancelled‑
   unpaid orders (join collected payments). A cancelled‑then‑refunded order should not show
   as a top seller.
6. **Timezone boundaries**: an order placed at 23:30 IST counts in that IST day, not UTC's.
   Verify a late‑evening order buckets correctly.
7. **Zero‑fill**: days with no orders appear as 0 in the timeseries (no missing points /
   broken chart).
8. **Bucket explosion**: `bucket=day` over `all`/multi‑year → auto‑upgrade to week/month
   (cap the number of points); custom range span capped (≤ ~2 years).
9. **CSV injection**: a product name / coupon code starting with `=`/`+`/`-`/`@` is prefixed
   with `'` in the export.
10. **CSV escaping**: cells with commas, quotes, or newlines are quoted + quotes doubled.
11. **Param clamping**: `?limit`, `?from`, `?to`, `?bucket` clamped/validated;
    malformed → `VALIDATION_ERROR`, never a 500 or unbounded query.
12. **Export authz**: `analytics:read` WITHOUT `reports:export` → export route 403, and the
    export buttons hidden. Reads gated `analytics:read`.
13. **Money units in UI**: paise → ₹ via `formatPaise`; never show raw paise to the user.
14. **Consistency with Payments/Customers**: "collected" set == `COLLECTED_PAYMENT_STATUSES`
    (imported, not copied) so all three modules agree.

---

## 10. Build + TEST loop (same discipline as every shipped module)
data layer → range/csv pure helpers → routes → UI → **unit tests** → gate → live‑verify → self‑review → commit.

### 10.1 Tests (REQUIRED)
- Unit‑test the pure helpers: `toCsv` (escaping + injection prefix + RFC‑4180),
  `resolveRange`/`bucketsFor` (presets → IST boundaries, from>to reject, span cap, bucket
  auto‑upgrade), and any pure % maths (refund rate, AOV guard).
- `typecheck` clean · `test` green · **`build` clean** (Next's build type‑check is stricter
  than `tsc`; always run build). New routes appear in the route list.

### 10.2 Live verify (dev server :3000; sign in `owner@kakoa.in`, OTP `000000`)
Drive the real API via `fetch` and **reconcile against the Dashboard**:
- `GET /api/admin/analytics/summary?preset=all` → net revenue == the Dashboard's
  `/api/admin/metrics` net revenue (fetch both, assert equal to the paise). paidOrders + AOV match.
- `timeseries?preset=30d&bucket=day` → summing the buckets' net == the summary net for 30d;
  days with no orders present as 0.
- `best-sellers` → the top product's units match a hand count from a couple of orders; a
  cancelled/unpaid order's items are excluded.
- `export?report=orders&preset=30d` with `reports:export` → returns `text/csv` with the right
  filename; a name starting with `=` is prefixed `'`. Without `reports:export` → 403.
- Empty range (e.g. a future window) → zeros, no `NaN`, chart renders.
Screenshot the analytics page (cards + chart + best‑sellers).

### 10.3 Adversarial self‑review
Hunt for: numbers that DON'T reconcile with the Dashboard, int4 sum overflow, AOV/rate
divide‑by‑zero, best‑sellers counting unpaid orders, IST vs UTC bucket errors, CSV
injection/escaping holes, unbounded queries from unclamped params, `analytics:read` reaching
the export route. Fix, re‑verify.

### 10.4 Commit (do NOT push unless asked)
```
Admin Analytics: revenue/orders timeseries, best-sellers, breakdowns + CSV export

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## 11. Definition of Done
- [ ] typecheck clean · tests green (CSV + range helpers unit‑tested) · **build clean**
- [ ] `getSummary({all})` **reconciles to the paise** with the Dashboard (net, paidOrders, AOV)
- [ ] Revenue defn REUSES `COLLECTED_PAYMENT_STATUSES` / `isCollectedStatus` (imported, not copied)
- [ ] All SUMs `::bigint` (no int4 overflow); AOV/refund‑rate divide‑by‑zero → 0
- [ ] Timeseries zero‑filled; IST day buckets; bucket auto‑upgrade on huge ranges
- [ ] Best‑sellers / sales‑by‑category count **revenue‑recognized** (collected‑payment) items only
- [ ] CSV export is RFC‑4180 + **injection‑safe** (`'` prefix on `=+-@`), correct headers/filename
- [ ] `reports:export` enforced on the export route; buttons hidden without it; reads gated `analytics:read`
- [ ] Chart is inline SVG (no external chart dependency); money shown via `formatPaise`
- [ ] All params clamped/validated (range span, limit, bucket) — no unbounded queries, no 500s
- [ ] Live‑verified incl. Dashboard reconciliation + empty‑range + export authz

---

## 12. Gotchas (do NOT repeat this project's history)
1. **Revenue must reconcile with the Dashboard** — reuse `COLLECTED_PAYMENT_STATUSES` and the
   net = gross − refunds rule from `metrics.ts`; do not invent a second definition.
2. **`SUM(*_paise)` overflows int4** — cast `::bigint` and `Number()` in JS.
3. **IST, not UTC** — bucket by `placedAt at time zone 'Asia/Kolkata'` (matches "today").
4. **CSV injection** — prefix cells starting with `= + - @` with `'`; quote‑escape per RFC‑4180.
5. **`next build` is stricter than `tsc --noEmit`** — always run build before "done".
6. **`AddressSnapshot` (if you touch order address) is from `@kakoa/db`, not `@kakoa/core`.**
7. **Do not trust the client** — hide export buttons AND enforce `reports:export` in the route.
8. **No external chart lib** — the app is self‑contained; render SVG.

---

### Appendix — files to read/imitate
| Need | File |
|---|---|
| the canonical revenue/AOV maths to MIRROR | `apps/web/src/lib/admin/metrics.ts` |
| the collected‑payment constant to REUSE | `apps/web/src/lib/admin/payment-format.ts` (`COLLECTED_PAYMENT_STATUSES`, `isCollectedStatus`) |
| dashboard cards styling | `app/admin/(shell)/page.tsx` |
| list/filters shell | `app/admin/(shell)/inventory/page.tsx` |
| order_items snapshot columns | `packages/db/src/schema/orders.ts` (`orderItems`) |
| money formatting | `@kakoa/core` (`formatPaise`) |

Analytics is read‑only and self‑contained — the correctness bar is **reconciliation** and
**no unbounded queries**. Nail those, keep the CSV injection‑safe, render the chart as SVG,
and it's a clean win. After this, only **Taxes**, **Notifications**, **Content**, and finally
**Media** (storage integration — last) remain. 🍫📈
