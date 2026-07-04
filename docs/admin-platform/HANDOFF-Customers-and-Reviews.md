# Build Handoff — Admin **Customers** + **Reviews** modules

> **You are a fresh Claude with no prior context. Read this whole file first.**
> It gives you everything: the project, the exact conventions to copy, the two
> modules to build, and the verify/review loop to follow. Do not invent new
> patterns — every admin module in this repo follows the same shape. Match it.

---

## 0. What this project is

**KAKOA** — a premium D2C chocolate e‑commerce platform for India. Turborepo + pnpm
monorepo. The storefront is built; you are extending the **Admin Portal** at `/admin`.

- **Repo root:** `/Users/yagneshpatel/Downloads/Projects/Kakoa`
- **App:** `apps/web` (Next.js 16 App Router, React 19, TypeScript strict incl.
  `noUncheckedIndexedAccess`, Tailwind v4). Package name is `web`.
- **DB:** `packages/db` (`@kakoa/db`) — Drizzle ORM + postgres‑js, Supabase Postgres.
- **Core:** `packages/core` (`@kakoa/core`) — shared enums, money (`formatPaise`,
  paise = integer), `maskPhone`, etc.
- **Kernel:** `packages/kernel` (`@platform/kernel`) — RBAC permissions, module registry.

**Commands** (run from repo root):
```bash
pnpm --filter web typecheck        # tsc --noEmit
pnpm --filter web test             # vitest run
pnpm --filter web build            # next build
```
Money is **integer paise** everywhere. Dates stored as `timestamptz` (Drizzle Date mode).

### Admin modules already built (copy their shape exactly)
Dashboard, Orders (+ actions), Products (CRUD + variants), Categories, Inventory
(stock + ledger), Promotions/Coupons. Look at these as your templates:
- Data layer: `apps/web/src/lib/admin/{orders,products,categories,inventory,coupons}.ts`
- Pure validators: `apps/web/src/lib/admin/{product-validation,coupon-validation}.ts`
- Routes: `apps/web/src/app/api/admin/**`
- Pages: `apps/web/src/app/admin/(shell)/**`
- Client components: `apps/web/src/components/admin/**`

---

## 1. The conventions — COPY THESE, don't reinvent

### 1.1 Auth guard (every route)
`apps/web/src/lib/admin/guard.ts` → `requireAdmin(permission?)`:
```ts
export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('customers:read');   // a Permission string
  if (!auth.ok) return auth.response;                  // ready 401/403
  // auth.value.admin.id  → the admin user id (for audit)
  // auth.value.ctx.can('customers:pii-view') → boolean permission check
  ...
}
```
Pages gate the same way via `resolveAdminContext()`:
```ts
const resolved = await resolveAdminContext();
if (resolved === null) return null;                    // not signed in
if (!resolved.ctx.can("customers:read")) return <NoAccess module="Customers" />;
```
`NoAccess` is `apps/web/src/components/admin/NoAccess.tsx`.

### 1.2 HTTP envelope
`apps/web/src/lib/api/http.ts`:
- `jsonOk(data, { cacheControl: NO_STORE, status?: 201 })`
- `jsonErr(code, message)` where `code ∈ 'VALIDATION_ERROR' | 'NOT_FOUND' |
  'CONFLICT' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_TRANSITION' | ...`
- Response shape: success `{ ok:true, data, meta }`, error `{ ok:false, error:{ code, message } }`.
- Client reads `data.ok` and `data.error?.message`.

### 1.3 UUID guard — MANDATORY before any uuid comparison
Never pass a raw string into a `uuid` column — a malformed value raises Postgres
`22P02` → unhandled 500. Use the shared helper:
```ts
import { isUuid } from '@/lib/admin/product-validation';
if (!isUuid(id)) return { ok:false, code:'NOT_FOUND', message: "We couldn't find that." };
```

### 1.4 Constraint‑error backstop — wrap every mutation transaction
`apps/web/src/lib/admin/db-errors.ts`:
```ts
import { withConstraintMapping } from '@/lib/admin/db-errors';
return withConstraintMapping(() => db.transaction(async (tx) => { ... }));
```
It converts Postgres constraint violations (`23505` unique, `23514` check, `23503`
FK, `22003`/`22P02` range) into a clean `VALIDATION_ERROR` result instead of a 500.
> ⚠️ **Critical gotcha (already fixed, don't regress):** drizzle wraps the real
> `PostgresError` inside `error.cause`. `pgConstraintMessage` walks the `.cause`
> chain to find `.code`/`.constraint_name`. If you add new pg‑error mapping, keep
> the unwrap. Prefer a SELECT pre‑check for a nice message **plus**
> `withConstraintMapping` as the race backstop.

### 1.5 Audit‑in‑transaction — every admin mutation
Write an `admin_audit_log` row in the SAME tx as the mutation:
```ts
await tx.insert(adminAuditLog).values({
  adminUserId,
  action: 'customer.block',      // '<entity>.<verb>'
  entityType: 'customer',
  entityId: customerId,
  before: { isBlocked: false },
  after:  { isBlocked: true },
});
```
Columns: `adminUserId, action(text), entityType(text), entityId(uuid), before(jsonb), after(jsonb)`.

### 1.6 Optimistic concurrency (for edits that can collide)
Pattern from `updateProduct`: `SELECT ... FOR UPDATE`, compare
`expectedUpdatedAt` against the row's `updatedAt`; mismatch → return `CONFLICT`.
Use it only where two admins might edit the same row; low‑contention actions can skip it.

### 1.7 PII masking — Customers is PII‑heavy, gate it
`maskPhone` from `@kakoa/core` (used in `orders.ts`). Rule for this module:
- `customers:read` sees **masked** phone/email and names.
- `customers:pii-view` sees the **full** phone/email.
- Decide masking on the server (`auth.value.ctx.can('customers:pii-view')`), never
  send unmasked PII to a client that lacks the permission.
- Never log full PII. Audit `before/after` for block/unblock should store ids/flags,
  not full contact details.

### 1.8 `revalidateTag` needs a 2nd arg in Next 16
If you invalidate a storefront cache tag (Reviews approval affects the PDP), it is
`revalidateTag('products', 'max')` — the cache‑profile arg is required. See
`apps/web/src/lib/catalog/queries.ts:748`.

### 1.9 Client list components — resync after `router.refresh()`
`useState(initialProp)` ignores later prop changes. After a mutation you call
`router.refresh()`; add `useEffect(() => setRows(initial), [initial])` so the table
reflects server truth. (Bug we already hit in `CategoryManager`/`InventoryTable`.)

### 1.10 Page shell + styling
Server page wrapper: `<div className="mx-auto max-w-6xl">`, `export const dynamic = "force-dynamic"`.
Palette used across admin: ink `#2a1d12`, cream card border `#eadbc6`, muted `#8a7a68`,
active pill `bg-[#2a1d12] text-[#f3e7d5]`, success `#3f8a54`, danger `#b25b5b`,
warn `#a9791f`. Copy filter‑pill + table markup from
`apps/web/src/app/admin/(shell)/inventory/page.tsx` (it has search + filters + pagination + a client table — the closest template for Customers).

### 1.11 Typed routes
Dynamic `href` strings need a cast: `href={\`/admin/customers/${id}\` as Route}`
(`import type { Route } from "next"`).

### 1.12 Nav is automatic
Both modules are **already registered** in `apps/web/src/lib/admin/modules.ts`
(Customers order 14, Reviews order 16). The sidebar renders them from the registry
once the admin has the permission — you do **not** touch the sidebar. Reviews has
`enabledByDefault: false` (opt‑in) — for local testing the Owner role has `'*'` so
it shows anyway.

### 1.13 Pure logic → separate file + unit tests
Any pure helper (formatting, validation, status derivation) goes in its own file
with **no `@kakoa/db` import** so it's unit‑testable (importing db needs env). See
`product-validation.ts` + `product-validation.test.ts`. Add vitest tests for pure logic.

---

## 2. Data model (already in the schema — no migration needed)

### customers (`packages/db/src/schema/customers.ts`)
`id, phone (unique, +91 format), email (citext unique), phoneVerifiedAt,
emailVerifiedAt, name, isBlocked (bool, default false — "serial‑RTO abusers"),
createdAt, updatedAt`. Passwordless; row created on first OTP verify.

### orders link (`packages/db/src/schema/orders.ts`)
`orders.customerId` is **nullable** (guest‑first). Also `contactPhone`,
`contactEmail`, `orderNumber`, `status (OrderStatus)`, `paymentMode`,
`grandTotalPaise`/total, `placedAt`. Index `orders_customer_idx (customerId, placedAt desc)`.
A customer's orders = `WHERE orders.customer_id = :id` **plus** you may also surface
guest orders that share the customer's verified phone (`orders.contact_phone`).

### reviews (`packages/db/src/schema/reviews.ts`)
`id, productId, customerId, orderItemId (unique = proof of purchase),
rating (1..5 check), title (≤120), body (10..2000 check), status
(reviewStatusEnum: 'pending' | 'approved' | 'rejected'), moderatedBy (adminUsers),
moderatedAt, moderationNote, createdAt, updatedAt`. Index
`reviews_moderation_queue_idx WHERE status='pending'`. PDP reads only `approved`.

`REVIEW_STATUSES = ['pending','approved','rejected']` (`@kakoa/core`).

---

## 3. MODULE A — Customers  (`/admin/customers`)

**Permissions** (already in registry): `customers:read`, `customers:pii-view`,
`customers:block`, `customers:data-request`.
Route base: `/api/admin/customers`. Nav label "Customers".

### 3.1 Data layer — `apps/web/src/lib/admin/customers.ts`
Model on `inventory.ts` / `orders.ts`.

- `listCustomers({ search?, filter?: 'all'|'blocked', page? })`
  - Join to aggregate each customer's order count + lifetime spend (sum of collected
    order totals) — LEFT JOIN orders on `customerId`, group by customer.
  - `search`: match `name`, `phone`, `email` (ilike; escape `%_\` like `likeParam`
    in products.ts). Search on raw columns server‑side (search is not "viewing PII").
  - Order by `createdAt desc` (newest) or lifetime spend desc — pick newest.
  - Page size ~30. Return `{ rows, total, page, pageSize, pageCount }`.
  - **Row shape depends on PII permission** — accept a `canViewPii: boolean` arg;
    when false, mask phone via `maskPhone` and mask email (e.g. `a***@domain`).
- `getCustomerDetail(id, canViewPii)` → the customer + derived stats:
  - core fields (phone/email masked per permission), `isBlocked`, verified flags,
    createdAt; counts: total orders, delivered, cancelled; lifetime spend (paise).
  - Return `null` when `!isUuid(id)` or not found.
- `listCustomerOrders(id)` → that customer's orders (orderNumber, status,
  paymentMode, totalPaise, placedAt), newest first, for the detail page. Reuse the
  shape from `orders.ts`. (Optionally also include guest orders matching the
  customer's verified phone — label them "guest".)
- `listCustomerAddresses(id, canViewPii)` → from `customer_addresses` (mask phone
  unless pii‑view). Read‑only.
- `setCustomerBlocked(id, blocked, adminUserId)` → tx: `FOR UPDATE` the customer,
  flip `isBlocked`, audit `customer.block`/`customer.unblock`. Wrap in
  `withConstraintMapping`. `isUuid` guard. This is the only **mutation** here.

> Keep it read‑mostly. Editing customer identity is out of scope. Block/unblock is
> the one write (abuse control). "Data request" (GDPR‑style export/delete) can be a
> later increment — leave a `// TODO(customers:data-request)` note, don't build it now.

### 3.2 Routes
- `GET  /api/admin/customers` — list. Guard `customers:read`. Pass
  `canViewPii = auth.value.ctx.can('customers:pii-view')` into `listCustomers`.
- `GET  /api/admin/customers/[id]` — detail + orders + addresses. Guard `customers:read`.
- `POST /api/admin/customers/[id]/block` — body `{ blocked: boolean }`. Guard
  `customers:block`. Returns `{ ok:true }`.

### 3.3 UI
- `app/admin/(shell)/customers/page.tsx` (server): gate `customers:read`, filters
  (All / Blocked), search box, table (Name · Contact[masked] · Orders · Lifetime
  spend · Joined · Status), link each row to `/admin/customers/[id]`. Copy the
  inventory page's filter‑pill + search + pagination structure.
- `app/admin/(shell)/customers/[id]/page.tsx` (server): gate `customers:read`,
  `notFound()` if missing. Show: profile card (contact per PII permission, verified
  badges, joined date), stats row (orders / delivered / cancelled / lifetime spend),
  an **orders table**, an **addresses list**, and a **Block/Unblock** control (only
  if `customers:block`).
- `components/admin/CustomerBlockButton.tsx` (client): posts to `/block`,
  `router.refresh()`, confirm dialog before blocking. Small — model on the toggle
  buttons in `InventoryTable`/`CategoryManager`.

### 3.4 Edge cases to handle
1. Guest orders (customer_id null) — a customer detail only shows their own; don't
   crash when a customer has 0 orders.
2. Customer with email but no phone (or vice‑versa) — `maskPhone(null)` must be safe.
3. Blocking is idempotent — blocking an already‑blocked customer is a no‑op success
   (or return a gentle message); don't error.
4. `customers:read` WITHOUT `customers:pii-view` → every phone/email masked, in both
   list and detail and addresses.
5. Malformed `[id]` → `NOT_FOUND`, never a 500 (isUuid guard).
6. A read‑only admin must not be able to block (route enforces `customers:block`).
7. Lifetime spend counts only **collected** payments — reuse the "collected" status
   set from `apps/web/src/lib/admin/metrics.ts` (captured / cod_collected / partially_
   refunded / refunded / cod_pending_remittance) and subtract refunds if you show net.
8. Large result sets — paginate (don't return all customers).

---

## 4. MODULE B — Reviews moderation  (`/admin/reviews`)

**Permission** (already in registry): `reviews:moderate`. Route base `/api/admin/reviews`.
Simpler than Customers — a moderation queue.

### 4.1 Data layer — `apps/web/src/lib/admin/reviews.ts`
- `listReviews({ status?: 'pending'|'approved'|'rejected'|'all', page? })`
  - Join `products` (name) + `customers` (name — masked; reviewers are semi‑public
    but keep contact out). Return rating, title, body, status, product name,
    reviewer display name, createdAt, moderatedAt. Default filter `pending`
    (the queue). Order by `createdAt` (oldest pending first is fine, or newest).
- `moderateReview(id, decision: 'approved'|'rejected', note?, adminUserId)`
  - tx + `withConstraintMapping` + `isUuid` guard: `FOR UPDATE` the review; set
    `status`, `moderatedBy = adminUserId`, `moderatedAt = now()`, `moderationNote`.
  - Audit `review.moderate` with `before:{status}`, `after:{status, decision}`.
  - **On approve/reject, the PDP cache changes** → call
    `revalidateTag('products', 'max')` (and `'reviews'` if such a tag exists — grep
    `queries.ts` for the exact tags; use the 2‑arg form).
  - Validate `decision ∈ {approved, rejected}`; `note` ≤ 500 chars.

### 4.2 Routes
- `GET  /api/admin/reviews` — list/queue. Guard `reviews:moderate`.
- `POST /api/admin/reviews/[id]/moderate` — body `{ decision, note? }`. Guard
  `reviews:moderate`.

### 4.3 UI
- `app/admin/(shell)/reviews/page.tsx` (server): gate `reviews:moderate`, status
  filter pills (Pending / Approved / Rejected / All), render a client
  `ReviewQueue`.
- `components/admin/ReviewQueue.tsx` (client): each review card shows product,
  stars (rating), title, body, reviewer, date, current status; for `pending` show
  **Approve** / **Reject** buttons (+ optional note field) → POST `/moderate` →
  `router.refresh()`. Resync state on `[initial]` (§1.9).

### 4.4 Edge cases
1. Moderating an already‑moderated review — allow re‑moderation (approve → reject
   later) but keep it a clean transition; don't 500.
2. Rating outside 1..5 can't exist (DB check) — trust it, but render defensively.
3. Malformed `[id]` → NOT_FOUND.
4. Empty queue → friendly "No reviews awaiting moderation."
5. `revalidateTag` must use the 2‑arg Next‑16 form or the build/runtime errors.
6. Body can be up to 2000 chars — don't break the layout; clamp/scroll long bodies.

---

## 5. Build loop (follow this exactly — it's how all 6 modules were built)

For **each** module, in order:
1. **Data layer** → typecheck (`pnpm --filter web typecheck`).
2. **Routes**.
3. **UI** (server page + client component).
4. **Pure‑logic unit tests** if any pure helper exists (e.g. email masking, status
   labels). Run `pnpm --filter web test`.
5. **Full gate:** typecheck + test + build all green.
6. **Live‑verify** against the running dev server (it runs on `:3000`). Prefer
   driving the real API/UI: create/read via `fetch` in the browser context and
   assert the responses + DB effects. Admin login in dev: email OTP for
   `owner@kakoa.in`, code `000000` (OTP test mode) — POST `/api/admin/auth/otp/request`
   then `/api/admin/auth/otp/verify` with `{challengeId, code:'000000'}`. Verify:
   PII masking actually masks for `customers:read`; block/unblock persists + audits;
   review approve flips status + the PDP reflects it.
7. **Adversarial self‑review** of the write path before declaring done. Focus areas:
   - authz: is every route gated on the right permission? can a `customers:read`
     user block or view PII? can a non‑`reviews:moderate` user moderate?
   - PII leak: does any response send unmasked phone/email without `pii-view`?
   - injection/robustness: malformed ids → NOT_FOUND not 500; unbounded page param
     clamped; ilike search escapes `%_\`.
   - integrity: block/unblock + moderate write audit rows; idempotent where stated;
     mutations wrapped in `withConstraintMapping`.
   Fix anything you find, re‑verify.
8. **Commit** (do NOT push unless asked). Message style:
   `Admin Customers: read view + block + PII gating`.
   End the commit body with:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## 6. Definition of Done (both modules)
- [ ] `pnpm --filter web typecheck` clean
- [ ] `pnpm --filter web test` green (new pure‑logic tests added)
- [ ] `pnpm --filter web build` clean; new routes appear in the route list
- [ ] Every route gated on the correct permission; `customers:pii-view` actually
      controls masking; `customers:block` / `reviews:moderate` enforced server‑side
- [ ] No unmasked PII reaches a client lacking `customers:pii-view`
- [ ] All mutations: `isUuid` guard + `withConstraintMapping` + `admin_audit_log` in‑tx
- [ ] Malformed ids → NOT_FOUND (no 500s); search escaped; pages clamped
- [ ] Review approve/reject calls `revalidateTag(tag, 'max')` and the PDP updates
- [ ] Client tables resync via `useEffect(()=>setRows(initial),[initial])`
- [ ] Live‑verified end‑to‑end against the dev server; screenshots/DOM confirm it

---

## 7. Gotchas learned the hard way this session (do NOT repeat)
1. **`pgConstraintMessage` must unwrap `error.cause`** — drizzle/postgres‑js wraps
   the `PostgresError`; reading `.code` off the top‑level error is always `undefined`
   → the backstop silently rethrows as a 500. (Already fixed in `db-errors.ts`.)
2. **Every paise/count column is Postgres `int4` (max 2,147,483,647).** Cap money
   and count inputs in the validator BEFORE the DB or you get a `22003` overflow → 500.
3. **`revalidateTag(tag)` alone throws in Next 16** — needs the cache‑profile 2nd arg.
4. **`useState(initialProp)` never resyncs** — add the `[initial]` effect after refresh.
5. **Never compare a raw string to a uuid column** — `isUuid` guard first (`22P02`).
6. **`products` has no `position` column** (order by name); `product_variants` has a
   partial unique index for exactly one default per product — irrelevant here but a
   reminder that check/partial‑unique indexes exist and surface as constraint errors.
7. Admin mutations are **audited in‑tx** — reviewers will flag a missing audit row.

---

### Appendix — quick file map to imitate
| Need | Copy from |
|---|---|
| list + filters + search + pagination + client table | `app/admin/(shell)/inventory/page.tsx` + `components/admin/InventoryTable.tsx` |
| detail page + notFound | `app/admin/(shell)/products/[id]/page.tsx` |
| mutation data layer (tx + audit + FOR UPDATE + mapping) | `lib/admin/inventory.ts` (`adjustStock`), `lib/admin/coupons.ts` |
| pure validator + tests | `lib/admin/coupon-validation.ts` + `.test.ts` |
| route with guard + envelope | `app/api/admin/inventory/[variantId]/adjust/route.ts` |
| PII masking usage | `lib/admin/orders.ts` (`maskPhone`) |
| toggle button client component | `components/admin/CategoryManager.tsx` |

Build **Customers** first (bigger, higher value), then **Reviews**. Good luck. 🍫
