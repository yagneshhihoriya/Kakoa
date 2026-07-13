# Build Handoff — Admin **Taxes** module

> **You are a fresh Claude with no prior context. Read this whole file first.**
> This is a **small, focused** module: GST is stored as **rate‑as‑data on each variant**
> (`gst_rate_bp` + `hsn_code`). The tax *computation* already exists in `@kakoa/core`
> (tax‑inclusive extraction + CGST/SGST/IGST split) — you do NOT change it. The Taxes
> module is the **admin surface to manage the rate data** (per‑HSN / per‑variant) and to
> show the seller's GST identity. **No migration, no new table.** Match the existing
> admin modules exactly.
>
> Shared conventions: `docs/admin-platform/HANDOFF-Customers-and-Reviews.md` §1.

---

## 0. Project & commands
KAKOA — premium D2C chocolate e‑commerce (India). Turborepo + pnpm; app `apps/web` (pkg `web`),
Next 16 App Router, TS strict, Tailwind v4; DB `@kakoa/db` (Drizzle + postgres‑js). Money = paise.
```bash
pnpm --filter web typecheck && pnpm --filter web test && pnpm --filter web build   # all must pass; build is stricter than tsc
```
Templates to copy: `lib/admin/inventory.ts` + `components/admin/InventoryTable.tsx`
(list + inline edit is the closest shape), `lib/admin/coupon-validation.ts` (pure validator + test).

---

## 1. Conventions (condensed — full detail in the shared doc §1)
1. **Guard** every route: `requireAdmin('taxes:manage')` (`lib/admin/guard.ts`); `if(!auth.ok) return auth.response;`. `auth.value.admin.id` for audit.
2. **Envelope**: `jsonOk(data,{cacheControl:NO_STORE})` / `jsonErr(code,msg)` (`lib/api/http.ts`).
3. **`isUuid(x)`** before any uuid compare (`@/lib/admin/product-validation`) — else `22P02` → 500.
4. **Wrap mutations** in `withConstraintMapping(() => db.transaction(...))` (`@/lib/admin/db-errors`) — it maps the `gst_rate_bp BETWEEN 0 AND 2800` check violation (`23514`) to a clean error and unwraps drizzle's `error.cause`.
5. **Audit in‑tx**: `admin_audit_log { adminUserId, action:'tax.*', entityType:'variant', entityId, before, after }`.
6. **`FOR UPDATE` + `LEFT JOIN` → `0A000`** — if a lock‑select joins, scope it `.for('update', { of: productVariants })`. (A real bug that shipped in `staff.ts`.)
7. **Client tables resync**: `useEffect(() => setRows(initial), [initial])` after `router.refresh()`.
8. **Page shell**: `export const dynamic="force-dynamic"`, `<div className="mx-auto max-w-5xl">`; palette ink `#2a1d12`, border `#eadbc6`, muted `#8a7a68`, active pill `bg-[#2a1d12] text-[#f3e7d5]`.
9. **Nav is automatic** — `taxes` module is registered (order 19, `requiresCapabilities:['tax-inclusive']`, perm `taxes:manage`, nav "Taxes" → `/admin/taxes`, icon `percent`). Don't touch the sidebar.
10. **Pure logic → own file + vitest.**

---

## 2. How GST works here (read, don't change)
- **Rate‑as‑data on the variant**: `product_variants.gst_rate_bp` (int, **CHECK 0…2800** =
  0%…28%, default `500` = 5%) and `product_variants.hsn_code` (text, default `'1806'` =
  chocolate). (`packages/db/src/schema/catalog.ts`.)
- **Prices are GST‑INCLUSIVE** (`pricePaise` = MRP incl. tax). `@kakoa/core/gst.ts`:
  `taxFromInclusive(grossPaise, rateBp)` extracts the tax component; `splitGst(taxPaise,
  intraState)` → `{cgstPaise, sgstPaise, igstPaise}` (intra‑state = CGST+SGST half each,
  remainder paisa to CGST; inter‑state = all IGST). `intraState` = buyer `stateCode` ==
  seller `stateCode`.
- **Seller identity** lives in `store_settings`: `seller_gstin`, `seller_state_code`
  (e.g. '27' Maharashtra), `seller_legal_name` (managed by the **Settings** module —
  Taxes shows them read‑only or links to Settings). `@kakoa/core/gst-states.ts` maps
  state code → name (`stateByCode`, `GST_STATES`).
- 🔴 **You do NOT recompute or store CGST/SGST/IGST** — the checkout/quote + invoice paths
  already do it from the variant's `gst_rate_bp`. The Taxes module only edits the **rate +
  HSN data**. Orders snapshot tax at placement — rate changes are **not retroactive**.

---

## 3. What to build — `/admin/taxes` (`taxes:manage`)
A **tax‑rate console** over the per‑variant GST data, grouped by HSN.

### 3.1 Data layer — `apps/web/src/lib/admin/taxes.ts`
- `listTaxGroups()` → `SELECT hsn_code, gst_rate_bp, count(*) AS variantCount FROM
  product_variants GROUP BY hsn_code, gst_rate_bp ORDER BY hsn_code, gst_rate_bp`. Return
  `{ hsnCode, gstRateBp, ratePct: gstRateBp/100, variantCount }[]`. This surfaces every
  (HSN, rate) combination in the catalog. **Flag inconsistency**: if one `hsn_code` maps to
  more than one `gst_rate_bp`, mark it (same HSN should have one rate) — the UI warns.
- `listVariantsForHsn(hsnCode)` → variants under an HSN with their product name, sku,
  `gstRateBp`, `hsnCode`, `isActive` — for the drill‑down / per‑variant edit.
- `getSellerTaxIdentity()` → read `seller_gstin`, `seller_state_code` (+ state name via
  `stateByCode`), `seller_legal_name` from `store_settings` (read‑only display).
- `updateVariantTax(variantId, { gstRateBp, hsnCode }, adminUserId)` → tx +
  `withConstraintMapping` + `FOR UPDATE OF productVariants`:
  - `isUuid(variantId)`; validate `gstRateBp` (integer, **0…2800**) and `hsnCode`
    (`^[0-9]{4,8}$` — HSN is 4/6/8 digits) via a PURE `validateTaxInput` in
    `tax-validation.ts`.
  - update the variant; audit `tax.update` with before/after `{gstRateBp, hsnCode}`.
- `bulkSetHsnRate(hsnCode, gstRateBp, adminUserId)` → set `gst_rate_bp` for **all** variants
  of an HSN in one tx (fixes an inconsistent HSN group in a click). Validate the rate;
  audit `tax.bulk_update` with `{hsnCode, gstRateBp, affected: n}`. (No per‑row FOR UPDATE
  needed — a single `UPDATE … WHERE hsn_code = ?`; the check constraint guards the value.)

### 3.2 Routes
- `GET  /api/admin/taxes` — groups + seller identity. Guard `taxes:manage`.
- `GET  /api/admin/taxes/hsn/[hsn]` — variants for an HSN. Guard `taxes:manage`. (Validate
  the `[hsn]` param against `^[0-9]{4,8}$` before querying — it's a text column, not uuid.)
- `PATCH /api/admin/taxes/variant/[id]` — `{ gstRateBp, hsnCode }`. Guard `taxes:manage`.
- `POST /api/admin/taxes/bulk` — `{ hsnCode, gstRateBp }` (set all variants of an HSN). Guard `taxes:manage`.

### 3.3 UI
- `app/admin/(shell)/taxes/page.tsx` (server, gate `taxes:manage`):
  - A **seller GST identity** card (GSTIN, legal name, state — read‑only, with a link to
    `/admin/settings` to edit).
  - A **tax groups table**: HSN · Rate (%) · Variants · (⚠ inconsistent badge). Each row →
    a drill‑down or an inline "set rate for all in this HSN" control (bulk).
  - A short **read‑only explainer** of the CGST/SGST vs IGST rule (intra‑ vs inter‑state)
    and the "not retroactive" note.
- `components/admin/TaxGroupsTable.tsx` (client): inline bulk‑rate edit per HSN + optional
  drill‑down to per‑variant edits; posts to the routes; `router.refresh()`; `[initial]` resync.
- (Optional) a per‑variant edit row reusing the drill‑down list.

---

## 4. 🔴 Edge cases — test every one
1. **Rate bounds**: `gst_rate_bp` outside 0…2800 → clean `VALIDATION_ERROR` (the DB check
   `23514` is the backstop via `withConstraintMapping`; validate in `tax-validation.ts` first).
2. **HSN format**: non‑`^[0-9]{4,8}$` → rejected. The `[hsn]` route param validated before query.
3. **Inconsistent HSN** (same HSN, two rates in the catalog) → flagged in the list; bulk‑set
   resolves it. Verify the flag appears and the bulk fix clears it.
4. **Not retroactive**: editing a variant's rate must NOT change an already‑placed order's
   tax (orders snapshot at placement) — confirm an existing order's totals are unaffected.
5. **Rate stored as basis points**: UI shows `%` (bp/100); a `5%` input persists `500`, not `5`.
6. **Malformed `variantId`** → `NOT_FOUND` (isUuid), never 500.
7. **Bulk on an HSN with 0 variants** → no‑op, clean response (not an error).
8. **Seller identity is read‑only here** — editing GSTIN/state happens in Settings; Taxes
   only reads it. Don't duplicate the write.
9. **`taxes:manage` enforced server‑side** on every mutation (there's no read‑only perm —
   the module is manage‑only, so both view and edit require `taxes:manage`, per the manifest).
10. Every mutation writes an `admin_audit_log` row.

---

## 5. Build + TEST loop
data layer → routes → UI → **unit tests** (`tax-validation.test.ts`: rate bounds, HSN regex,
bp↔% ) → gate (typecheck + test + **build**) → live‑verify → self‑review → commit.

**Live verify** (dev :3000; `owner@kakoa.in`, OTP `000000`): list shows the seeded HSN 1806 @
5% across all variants; edit one variant to 12% (1200 bp) → persists; set an out‑of‑range rate
→ 400; bulk‑set an HSN → all variants update + audit row written; confirm an existing order's
tax is unchanged. Screenshot the Taxes page.

**Commit** (don't push unless asked):
`Admin Taxes: per-HSN / per-variant GST rate management + seller identity`
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## 6. Definition of Done
- [ ] typecheck clean · tests green (`tax-validation` unit‑tested) · **build clean**
- [ ] Tax groups list (HSN · rate · variant count) + inconsistency flag
- [ ] Per‑variant + bulk‑per‑HSN rate edit; rate validated 0…2800 bp; HSN `^[0-9]{4,8}$`
- [ ] Seller GST identity shown read‑only (from Settings); no duplicate write
- [ ] Rate stored as **basis points** (UI shows %); `withConstraintMapping` backstops the check
- [ ] `taxes:manage` enforced server‑side; every mutation audited; `FOR UPDATE OF` used on joined locks
- [ ] "Not retroactive" verified (existing order tax unchanged after a rate edit)

---

## 7. Gotchas
1. **Don't recompute GST** — `@kakoa/core/gst.ts` owns `taxFromInclusive`/`splitGst`; you only edit the rate data.
2. **Rate is basis points** (500 = 5%); the check is `0…2800`.
3. **`FOR UPDATE` + `LEFT JOIN` → `0A000`** — use `.for('update', { of: productVariants })`.
4. **`pgConstraintMessage` unwraps `error.cause`** (handled in `db-errors.ts`); the `23514` check maps to a clean error.
5. **`next build` is stricter than `tsc --noEmit`** — always run build.
6. Admin mutations are **audited in‑tx**.

### Appendix
| Need | File |
|---|---|
| variant GST columns + check | `packages/db/src/schema/catalog.ts` (`gstRateBp`, `hsnCode`) |
| GST maths (don't change) | `packages/core/src/gst.ts`, `packages/core/src/gst-states.ts` |
| seller identity source | `store_settings` via Settings module; `apps/web/src/lib/admin/context.ts` |
| list + inline edit UI | `components/admin/InventoryTable.tsx` |
| pure validator + test | `apps/web/src/lib/admin/coupon-validation.ts` (+ `.test.ts`) |

Taxes is a tight, no‑migration module — manage the rate data, show the identity, keep it
non‑retroactive. 🍫🧾
