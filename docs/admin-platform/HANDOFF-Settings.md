# Build Handoff — Admin **Settings** module

> **You are a fresh Claude with no prior context. Read this whole file first.**
> Settings is the store's **live control panel**: these values drive checkout fees,
> the COD toggle, the free‑shipping threshold, and the legal/GST identity printed on
> invoices. A wrong value here changes real customer‑facing behavior — validate every
> field, store the correct JSON type, and never let a bad number reach the DB.
> Match the existing admin modules exactly; do not invent new patterns.
>
> Shared conventions live in `docs/admin-platform/HANDOFF-Customers-and-Reviews.md`
> §1 (guard, HTTP envelope, `isUuid`, `withConstraintMapping`, audit‑in‑tx, client
> resync, page shell, typed routes). This file restates the critical ones and adds
> everything Settings‑specific.

---

## 0. Project & commands
**KAKOA** — premium D2C chocolate e‑commerce for India. Turborepo + pnpm monorepo.
- Repo root `/Users/yagneshpatel/Downloads/Projects/Kakoa`; app `apps/web` (pkg `web`),
  Next.js 16 App Router, React 19, TS strict (`noUncheckedIndexedAccess`), Tailwind v4.
- DB `packages/db` (`@kakoa/db`), Drizzle + postgres‑js, Supabase Postgres.
- Money is **integer paise**; `formatPaise` from `@kakoa/core`.
```bash
pnpm --filter web typecheck   # tsc --noEmit
pnpm --filter web test        # vitest run
pnpm --filter web build       # next build  (STRICTER than typecheck — always run it)
```
**Templates to copy:** the pure‑validator + form pattern of
`lib/admin/coupon-validation.ts` + `components/admin/CouponForm.tsx`, and the page
shell of `app/admin/(shell)/inventory/page.tsx`.

---

## 1. Conventions you MUST copy (condensed)
1. **Guard every route** — `requireAdmin('settings:read' | 'settings:write')` from
   `lib/admin/guard.ts`; `if (!auth.ok) return auth.response;`. `auth.value.admin.id`
   for audit / `updatedBy`; `auth.value.ctx.can(...)` for conditional UI.
2. **HTTP envelope** — `jsonOk(data,{cacheControl:NO_STORE})` / `jsonErr(code,msg)`
   (`lib/api/http.ts`). Client reads `data.ok` / `data.error.message`.
3. **Wrap mutations** in `withConstraintMapping(() => db.transaction(...))`
   (`@/lib/admin/db-errors`) — maps unique/check/FK/range (`22003`) violations to a
   clean `VALIDATION_ERROR` (it already unwraps drizzle's `error.cause` — keep that).
4. **Audit in‑tx** — write `admin_audit_log { adminUserId, action, entityType,
   entityId, before, after }` in the same tx as the change.
5. **int4 ceiling** — every `*_paise` value is Postgres `int4` (max 2,147,483,647).
   Validate/cap BEFORE the DB or you get a `22003` overflow → 500.
6. **Client form resync**: `useEffect(() => setState(initial), [initial])` after
   `router.refresh()` (the `useState(initialProp)`‑ignores‑later‑props gotcha).
7. **Page shell**: `export const dynamic="force-dynamic"`, `<div className="mx-auto max-w-4xl">`.
   Palette: ink `#2a1d12`, border `#eadbc6`, muted `#8a7a68`, active pill
   `bg-[#2a1d12] text-[#f3e7d5]`, success `#3f8a54`, danger `#b25b5b`, warn `#a9791f`.
8. **Nav is automatic** — the `settings` module is already in
   `apps/web/src/lib/admin/modules.ts` (order 54, group kernel, nav "Settings" →
   `/admin/settings`, perms `settings:read`, `settings:write`). Don't touch the sidebar.
9. **Pure logic → own file + vitest** (no `@kakoa/db` import).

---

## 2. Data model — `store_settings` (already in the schema, NO migration)
`packages/db/src/schema/settings.ts`:
```
store_settings {
  key       text PRIMARY KEY,     // flat key, e.g. 'cod_enabled'
  value     jsonb NOT NULL,       // typed JSON: number | boolean | string
  updatedBy uuid → admin_users (set null),
  updatedAt timestamptz default now(),
}
```
It is a **singleton key/value store** (one row per key). 🔴 **`value` is `jsonb`** —
store a **number as a JSON number**, a **boolean as a JSON boolean**, a **string as a
JSON string**. Do NOT `JSON.stringify` everything into a string; the app reads typed
values (`getInt`/`getBool`/`getString`). A write is an **upsert**:
`INSERT ... ON CONFLICT (key) DO UPDATE SET value=…, updated_by=…, updated_at=now()`.

### 2.1 How the app READS settings (do not break these consumers)
`apps/web/src/lib/admin/context.ts` builds a `SettingsReader` via `makeSettingsReader`
(reads all rows into a map). Interface (`@platform/kernel` `SettingsReader`):
`get<T>(ns,key)`, `getBool(ns,key,fb)`, `getInt(ns,key,fb)`, `getString(ns,key,fb)`.
It resolves `namespace.key` first, then the **flat `key`**. **Today's keys are FLAT**
(`cod_enabled`, `seller_state_code`, …) — so the Settings module reads/writes **flat
keys**. Consumers today:
- **`lib/checkout/quote.ts`** reads `shipping_fee_standard_paise`,
  `shipping_fee_express_paise`, `free_shipping_threshold_paise`, `cod_fee_paise`,
  `gift_wrap_fee_paise`, `cod_enabled`, `payment_expiry_minutes`.
- **`context.ts`** reads `seller_legal_name` (and brand identity).

### 2.2 🔴 Two behavioral rules you MUST surface in the UI
1. **Fee changes are NOT retroactive.** Orders snapshot every fee value at placement
   (schema comment). Editing `shipping_fee_*`, `cod_fee_paise`, `gift_wrap_fee_paise`,
   `free_shipping_threshold_paise` affects **only future orders**. Say so near those fields.
2. **`cod_enabled` is read LIVE at checkout** — flipping it OFF immediately removes COD
   as a payment option storefront‑wide (it launched `false` = prepaid‑only). Treat it
   as a high‑impact toggle (a confirm is nice).

---

## 3. The setting catalog — build a typed schema that DRIVES the form

Put this in a PURE file `apps/web/src/lib/admin/settings-schema.ts` (no db import) so
it's unit‑testable and the single source of truth for label/type/validation. This is
the same "schema drives the form" pattern the Products attribute form uses.

| key | group | type | validation | default | notes |
|---|---|---|---|---|---|
| `seller_legal_name` | Business identity | string | 2–120 chars | 'Kakao Chocolates Private Limited' | printed on invoices |
| `seller_gstin` | Business identity | gstin | `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$` | '27AABCK4321M1Z5' | 15‑char GSTIN |
| `seller_state_code` | Business identity | state-code | `^[0-9]{2}$` (01–37) | '27' | GST state code |
| `seller_address` | Business identity | string | 5–300 chars | (Mumbai addr) | |
| `origin_pincode` | Business identity | pincode | `^[1-9][0-9]{5}$` | '400053' | dispatch origin |
| `fssai_license_number` | Legal | string | `^[0-9]{14}$` | '11525023000841' | 14‑digit FSSAI |
| `shipping_fee_standard_paise` | Fees & shipping | int‑paise | 0 … 1,00,00,000 | 4900 | ₹49 |
| `shipping_fee_express_paise` | Fees & shipping | int‑paise | 0 … 1,00,00,000 | 14900 | ₹149 |
| `free_shipping_threshold_paise` | Fees & shipping | int‑paise | 0 … 1,00,00,000 | 99900 | ₹999; 0 = always free |
| `gift_wrap_fee_paise` | Fees & shipping | int‑paise | 0 … 1,00,00,000 | 4900 | per line |
| `cod_enabled` | Payments | bool | — | false | live COD toggle |
| `cod_fee_paise` | Payments | int‑paise | 0 … 1,00,00,000 | 4900 | ₹49 COD surcharge |
| `payment_expiry_minutes` | Payments | int | 5 … 1440 | 30 | prepaid order hold window |
| `support_phone` | Support | phone | `^\+91[6-9][0-9]{9}$` | '+919820012345' | |
| `support_email` | Support | email | RFC‑ish, ≤ 254 | 'support@kakoa.in' | |

- **`int‑paise`**: the UI shows/edits **₹ (rupees)**; convert ₹→paise on submit
  (`Math.round(rupees*100)`), cap at **1,00,00,000 paise (₹10,00,000)** well under int4.
- **`int`**: whole‑number bounds as above.
- Keep a `SETTINGS_DEFAULTS` map so a missing row falls back to the default (never
  render `undefined`). The seed already inserts all 15 — but code defensively.

---

## 4. Data layer — `apps/web/src/lib/admin/settings.ts`
- `getAllSettings()` → read every `store_settings` row into `Record<key, value>`,
  overlaying `SETTINGS_DEFAULTS` for any missing key; return only the catalogued keys
  (drop stray/legacy keys from the response). Also return each key's `updatedAt`/
  `updatedBy` email if you show "last changed by" (optional, nice).
- `validateSettingsPatch(patch: unknown)` (PURE, in `settings-schema.ts`) → for each
  key present in `patch`: reject unknown keys (not in the catalog); coerce+validate per
  its type (paise ₹→int + cap, bool, int bounds, regex for gstin/pincode/phone/email/
  state‑code/fssai; trim + length for strings). Return `{ ok, value: Record<key, JSONValue> }`
  (typed JSON values) or `{ ok:false, message }` with the FIRST failing field's message
  (e.g. "Enter a valid GSTIN.", "Pincode must be 6 digits.").
- `updateSettings(validated: Record<key, JSONValue>, adminUserId)` →
  `withConstraintMapping(db.transaction(...))`:
  - Read the current values of the keys being changed (for the audit `before`).
  - For each changed key, **upsert**:
    `insert(storeSettings).values({key, value, updatedBy: adminUserId})
     .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedBy, updatedAt: sql\`now()\` }})`.
    (Skip keys whose value is unchanged — no‑op, keeps audit clean.)
  - Write ONE `admin_audit_log` row `action:'settings.update'`, `entityType:'settings'`,
    `entityId: null`, `before`/`after` = the changed keys only (never dump everything).
  - Return `{ ok:true, changed: string[] }`.
  > `value` is jsonb — pass the actual JS number/boolean/string; drizzle serializes it.
  > Storing `"4900"` (string) instead of `4900` (number) will silently break the
  > checkout reader (`getInt`). Test that a saved paise value reads back as a number.

---

## 5. Routes
- `GET  /api/admin/settings` — return `getAllSettings()`. Guard `settings:read`.
- `PATCH /api/admin/settings` — body = partial `{ key: value }` map (rupee units for
  paise fields — the client converts, OR accept ₹ and convert in the validator; pick
  ONE and document it in the route comment). Validate via `validateSettingsPatch`,
  then `updateSettings`. Guard `settings:write`. Return `{ changed }`.

---

## 6. UI
- `app/admin/(shell)/settings/page.tsx` (server, gate `settings:read`): fetch
  `getAllSettings()`, render `<SettingsForm settings={...} canWrite={ctx.can('settings:write')} />`.
- `components/admin/SettingsForm.tsx` (client): render fields **grouped by section**
  (Business identity · Legal · Fees & shipping · Payments · Support) driven by the
  catalog. Field widgets by type: text input (string/gstin/pincode/phone/email/state‑code),
  ₹ number input (int‑paise, prefilled `paise/100`), plain number (int),
  checkbox/toggle (bool). Disable all inputs + hide Save when `!canWrite`. On Save,
  build the patch of **changed** fields only, convert ₹→paise, `PATCH`, then
  `router.refresh()`; show per‑field or top‑level server error; resync via `[initial]`.
  Put the "changes aren't retroactive" note under Fees, and a confirm on `cod_enabled`.

---

## 7. 🔴 Edge cases — test every one
1. **jsonb type integrity**: saving `shipping_fee_standard_paise` stores a JSON
   **number**, not a string; reads back as a number; checkout `getInt` still works.
2. **int4 overflow**: a ₹ value that would exceed int4 → clean `VALIDATION_ERROR`
   (capped in the validator), never a `22003` 500.
3. **Unknown key** in the PATCH body → dropped/rejected (only catalogued keys persist).
4. **Bad formats** → clear per‑field messages: GSTIN, pincode (`^[1-9][0-9]{5}$`),
   phone (`^\+91[6-9][0-9]{9}$`), email, state‑code (2 digits), FSSAI (14 digits).
5. **`free_shipping_threshold_paise = 0`** is valid (everything ships free) — allow 0.
6. **`payment_expiry_minutes`** bounded (5…1440); reject 0/negative/huge.
7. **`cod_enabled` toggle** flips storefront COD availability live — confirm dialog;
   after toggling ON, a live checkout must offer COD (verify), OFF must hide it.
8. **No‑op save** (nothing changed) → success, no audit row, no upsert.
9. **Partial save**: PATCH with only 2 keys updates only those; others untouched.
10. **Missing row**: if a key was never seeded, `getAllSettings` returns its default;
    saving it INSERTs the row.
11. **Concurrency**: two admins saving different keys → both apply (per‑key upsert).
    (Optional: optimistic concurrency via `updatedAt` per key — note as a nice‑to‑have,
    not required; last‑write‑wins per key is acceptable and `updatedBy` records who.)
12. **`settings:read` without `settings:write`** → read‑only form; PATCH route refuses
    (enforced server‑side, not just disabled inputs).
13. **Fee change is not retroactive** — an already‑placed order's totals don't change
    (they're snapshotted); confirm an existing order is unaffected after editing a fee.
14. Malformed JSON body / non‑object → `VALIDATION_ERROR`, not 500.
15. Every successful change writes exactly one audit row with only the changed keys.

---

## 8. Build + TEST loop (same discipline as every shipped module)
data layer → routes → UI → **pure unit tests** → gate → live‑verify → self‑review → commit.

### 8.1 Tests (REQUIRED)
- Unit‑test `validateSettingsPatch` in `settings-schema.test.ts` (no db): ₹→paise
  conversion + cap, each regex (valid + invalid), bool coercion, int bounds, unknown‑key
  drop, threshold=0 allowed, first‑error message. Aim for broad coverage — this is
  where correctness lives.
- `pnpm --filter web typecheck` clean · `pnpm --filter web test` green ·
  **`pnpm --filter web build` clean** (Next's build type‑check is stricter than
  `tsc --noEmit` — a module can pass typecheck and still fail build; always run build).
  New routes must appear in the route list.

### 8.2 Live verify (dev server on :3000; sign in as `owner@kakoa.in`, OTP `000000`)
Drive the real API via `fetch` and assert DB + read‑back:
- `GET /api/admin/settings` returns all 15 keys with correct types.
- PATCH `shipping_fee_standard_paise` (via ₹) → read back a JSON **number**; the
  storefront checkout quote reflects the new fee on a NEW cart.
- PATCH an out‑of‑range ₹ → `400` (not 500). PATCH a bad GSTIN/pincode/phone → `400`
  with the right message. PATCH an unknown key → rejected/ignored.
- Toggle `cod_enabled` true → a live checkout offers COD; false → it doesn't.
- Confirm an `admin_audit_log` row `settings.update` recorded only the changed keys.
- Confirm a `settings:read`‑only context is refused PATCH (401/403).
Screenshot the grouped Settings page.

### 8.3 Adversarial self‑review
Hunt for: a paise value stored as a string (breaks the checkout reader), int4 overflow
→ 500, unknown‑key persistence, a `settings:read` user reaching PATCH, missing audit,
a `cod_enabled`/fee edit that unexpectedly mutates existing orders. Fix, re‑verify.

### 8.4 Commit (do NOT push unless asked)
```
Admin Settings: store config (fees, COD toggle, GST identity) — typed, audited

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## 9. Definition of Done
- [ ] typecheck clean · tests green (`validateSettingsPatch` fully unit‑tested) · **build clean**
- [ ] All 15 catalogued keys editable, grouped, with correct widgets + ₹↔paise conversion
- [ ] `value` stored as the correct **jsonb type** (number/bool/string); reads back typed
- [ ] Every field validated (GSTIN/pincode/phone/email/state‑code/FSSAI + paise caps + int bounds)
- [ ] Unknown keys never persisted; no‑op saves write nothing
- [ ] `settings:write` enforced server‑side on PATCH; `settings:read` gives a read‑only form
- [ ] Change is audited (one row, changed keys only) + `updatedBy` set on each upserted row
- [ ] `cod_enabled` + fee edits verified against a LIVE checkout quote; existing orders unaffected
- [ ] "not retroactive" + COD‑impact copy shown in the UI

---

## 10. Gotchas (from this project's history — do not repeat)
1. **`pgConstraintMessage` unwraps `error.cause`** — drizzle wraps the PostgresError;
   `.code` is undefined on the top‑level error. (Already handled in `db-errors.ts`.)
2. **Every `*_paise` column is `int4`** (max 2,147,483,647) — cap ₹ inputs before the DB.
3. **jsonb type matters** — store `4900` (number), not `"4900"` (string), or the
   storefront `getInt` reader silently misbehaves.
4. **`useState(initialProp)` never resyncs** — add the `[initial]` effect after refresh.
5. **`next build` type‑check is stricter than `tsc --noEmit`** — a file can pass
   `typecheck` and still break `build` (e.g. a bad import). ALWAYS run `build` before "done".
6. **Do not trust the client** — disabled inputs are UX; enforce `settings:write` in the route.
7. Admin mutations are **audited in‑tx** — a missing audit row is a review failure.

---

### Appendix — files to read/imitate
| Need | File |
|---|---|
| schema‑driven form + pure validator + ₹↔paise | `lib/admin/coupon-validation.ts` + `components/admin/CouponForm.tsx` |
| page shell + gate + read‑only when lacking write | `app/admin/(shell)/products/[id]/page.tsx` |
| route guard + envelope | `app/api/admin/inventory/[variantId]/adjust/route.ts` |
| settings table + reader | `packages/db/src/schema/settings.ts`, `apps/web/src/lib/admin/context.ts` (`makeSettingsReader`) |
| settings consumers (don't break) | `apps/web/src/lib/checkout/quote.ts` |
| seed defaults (the 15 keys) | `packages/db/src/seed.ts` (`const SETTINGS`) |

After Settings, the remaining modules are **Shipping** (Shiprocket — external/mocked,
`shipments` table), **Taxes** (GST rate/HSN config), **Media** (uploads — needs
storage), **Notifications** (templates), **Analytics/Reports**. Settings is the
highest‑leverage self‑contained build — it turns the hardcoded store config into an
admin‑editable control panel. 🍫
