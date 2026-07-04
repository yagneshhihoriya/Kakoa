# Build Handoff — Admin **Staff & Roles** (+ Audit Log)

> **You are a fresh Claude with no prior context. Read this whole file before writing code.**
> This is the **most security‑sensitive** admin module in the project — it controls
> who can do what. A mistake here means privilege escalation, admin lockout, or a
> business with no owner. The **§4 Security Invariants are non‑negotiable** — build
> them first, test them hardest. Match the existing module patterns exactly; do not
> invent new ones.
>
> Companion doc with the shared conventions in more depth:
> `docs/admin-platform/HANDOFF-Customers-and-Reviews.md` (§1). This file restates the
> critical ones and adds everything RBAC‑specific.

---

## 0. Project & where things live

**KAKOA** — premium D2C chocolate e‑commerce for India. Turborepo + pnpm monorepo.
- Repo root: `/Users/yagneshpatel/Downloads/Projects/Kakoa`
- App: `apps/web` (package name `web`) — Next.js 16 App Router, React 19, TS strict
  (`noUncheckedIndexedAccess`), Tailwind v4.
- DB: `packages/db` (`@kakoa/db`) — Drizzle + postgres‑js, Supabase Postgres.
- **Kernel: `packages/kernel` (`@platform/kernel`) — the RBAC engine. THIS MODULE IS ITS UI.**

**Commands** (repo root):
```bash
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```

**Already‑built admin modules to copy the shape of:** Dashboard, Orders, Products
(CRUD + variants), Categories, Inventory, Promotions/Coupons. Templates:
- data layer `apps/web/src/lib/admin/{inventory,coupons,products}.ts`
- pure validators `apps/web/src/lib/admin/{coupon,product}-validation.ts`
- routes `apps/web/src/app/api/admin/**`
- pages `apps/web/src/app/admin/(shell)/**`
- client components `apps/web/src/components/admin/**`

---

## 1. Conventions you MUST copy (condensed — full detail in the companion doc §1)

1. **Guard every route** — `requireAdmin(permission)` from `apps/web/src/lib/admin/guard.ts`:
   ```ts
   const auth = await requireAdmin('staff:manage');
   if (!auth.ok) return auth.response;           // ready 401/403
   // auth.value.admin  → AdminIdentity (id, email, name, roleKey, grants)
   // auth.value.ctx.can('roles:manage') → boolean
   ```
   Gate **pages** with `resolveAdminContext()` → `ctx.can(...)` → `<NoAccess module="…"/>`.
2. **HTTP envelope** — `jsonOk(data,{cacheControl:NO_STORE,status?})` / `jsonErr(code,msg)`
   (`apps/web/src/lib/api/http.ts`). Client reads `data.ok` / `data.error.message`.
3. **`isUuid(x)` guard** (from `@/lib/admin/product-validation`) before ANY uuid compare — else `22P02` → 500.
4. **Wrap mutations** in `withConstraintMapping(() => db.transaction(...))`
   (`@/lib/admin/db-errors`) — turns unique/check/FK/range violations into clean
   `VALIDATION_ERROR`. It already unwraps drizzle's `error.cause`; keep that if you extend it.
5. **Audit in‑tx** — every mutation writes `admin_audit_log`
   `{ adminUserId, action:'<entity>.<verb>', entityType, entityId, before, after }`.
6. **Client tables resync**: `useEffect(() => setRows(initial), [initial])` after `router.refresh()`.
7. **Page shell**: `export const dynamic="force-dynamic"`, `<div className="mx-auto max-w-6xl">`.
   Palette: ink `#2a1d12`, border `#eadbc6`, muted `#8a7a68`, active pill
   `bg-[#2a1d12] text-[#f3e7d5]`, success `#3f8a54`, danger `#b25b5b`, warn `#a9791f`.
   Copy list markup from `app/admin/(shell)/inventory/page.tsx`.
8. **Typed routes**: `href={\`/admin/staff/${id}\` as Route}` (`import type { Route } from "next"`).
9. **Nav is automatic** — these modules are already registered in
   `apps/web/src/lib/admin/modules.ts`; the sidebar renders them from the registry
   once the admin has the permission. Do **not** edit the sidebar.
10. **Pure logic → own file + vitest** (no `@kakoa/db` import). The authorization
    guard helpers in §4 are pure — put them in `apps/web/src/lib/admin/rbac-guards.ts`
    and unit‑test them thoroughly (this is where the security lives).

---

## 2. The RBAC model (already built in `@platform/kernel` — reuse, don't re‑invent)

**Import everything from `@platform/kernel`:**

| Export | What it is |
|---|---|
| `PERMISSION_KEYS` | the full string catalog (35 permissions, `resource:action`) |
| `type Permission` | union of the catalog keys |
| `isPermission(s)` | typeguard — validate any incoming permission string with this |
| `PERMISSION_CATALOG` | `{ key, resource, action, label, sensitive }[]` — drives the role editor |
| `permissionsByResource()` | `Record<resource, PermissionMeta[]>` — checkbox groups for the UI |
| `type PermissionGrant` | `Permission | '*'` (`'*'` = every permission, Owner) |
| `grantsPermission(grants, perm)` | does a grant set include `perm` (honours `'*'`) |
| `expandPermissions(grants)` | `'*'` → all concrete keys |
| `SYSTEM_ROLES` | the 5 seeded presets (below) |
| `systemRole(key)` | lookup a preset |
| `type Role` | `{ key, name, description, isSystem, permissions }` |

**`SENSITIVE` permissions** (money / identity / administration — default to Owner):
`orders:refund, payments:refund, customers:pii-view, customers:data-request,
coupons:manage, settings:write, staff:manage, roles:manage, audit:read, reports:export`.

**System role presets** (`isSystem: true`, cannot be deleted):
- `owner` → `['*']` (all, incl. future permissions)
- `admin` → everything except `roles:manage`, `audit:read`, `customers:data-request`
- `manager` → ops lead (publish, shipping, notifications; no refunds/roles/settings‑write)
- `staff` → front‑line ops (orders transition, catalog write, inventory adjust, moderate)
- `viewer` → read‑only across the store

### 2.1 Tables (`packages/db/src/schema/admin.ts` — already exist, NO migration)
- **`roles`**: `id, key (unique text), name, description, isSystem (bool),
  permissions (text[] — holds `'*'` for owner), createdAt, updatedAt`.
- **`admin_users`**: `id, email (citext unique), name, role (legacy enum
  owner/staff — being retired), roleId (uuid FK → roles, onDelete set null),
  isActive (bool), lastLoginAt, createdAt, updatedAt`.
- **`admin_sessions`**: `id, adminUserId (FK cascade), tokenHash (unique),
  expiresAt, revokedAt, ip, userAgent`. 12h TTL, cookie `kakoa_admin`.
- **`admin_audit_log`**: `id, adminUserId (FK set null), action(text),
  entityType(text), entityId(uuid), before(jsonb), after(jsonb), createdAt`.
  Index `admin_audit_entity_idx (entityType, entityId, createdAt desc)`.

### 2.2 How auth actually resolves (read `apps/web/src/lib/admin/session.ts`)
`resolveAdminSession()` runs **per request**: joins `admin_sessions + admin_users +
roles`, requires `revokedAt IS NULL AND expiresAt > now() AND admin_users.isActive`,
and resolves `grants` from `roleId → roles.permissions` (falls back to the legacy
enum → kernel preset when `roleId` is null). Returns `AdminIdentity { id, email,
name, roleKey, grants }`. **Consequences you must design around:**
- A **role/permission change takes effect on the user's NEXT request** (grants are
  re‑read each request). No cache to bust — but in‑flight requests use old grants.
- Setting `admin_users.isActive = false` blocks **new** logins immediately (the OTP
  request route only issues a challenge to an active admin) **but does NOT kill an
  existing 12h session** — you must **revoke their sessions** too (see §4.4).

### 2.3 The invite / login model (passwordless)
There are **no passwords**. To "invite" an admin you just **create an
`admin_users` row** (email, name, roleId, isActive=true). They sign in themselves
via email OTP: `POST /api/admin/auth/otp/request {email}` → `verify {challengeId,
code}`. In dev, OTP test mode returns code `000000` for `owner@kakoa.in`.
So: **invite = insert admin_users row** (optionally email them a heads‑up); the
kernel + OTP flow does the rest. Deactivate = `isActive=false` **+ revoke sessions**.

---

## 3. What to build (three modules, already registered in the registry)

| Module | Permission | Route | Nav label |
|---|---|---|---|
| **A — Staff (Users)** | `staff:manage` | `/admin/staff` | "Users & Roles" |
| **B — Roles (Permissions)** | `roles:manage` | `/admin/roles` | "Permissions" |
| **C — Audit Log** | `audit:read` | `/admin/audit` | "Audit Log" |

Build order: **A → B → C** (Staff first; it depends on roles existing, which they
do via the seed). C is read‑only and easy.

---

## 4. 🔴 SECURITY INVARIANTS — build these as pure, unit‑tested guards FIRST

Put these in `apps/web/src/lib/admin/rbac-guards.ts` (pure, no db) and call them from
the data layer. **Every one needs unit tests.** They are the whole point of the module.

**4.1 No privilege escalation (grant‑subset rule).**
An acting admin may only assign a role / grant a permission set that is a **subset of
their own grants**. If the actor holds `'*'` (owner) they can grant anything. Otherwise:
```ts
// actorGrants: the acting admin's grants (from auth.value.admin.grants)
// targetPerms: the permissions being assigned (a role's permission set, expanded)
export function canGrantAll(actorGrants: PermissionGrant[], targetPerms: Permission[]): boolean {
  if (actorGrants.includes('*')) return true;
  return targetPerms.every((p) => actorGrants.includes(p));
}
```
Apply when: assigning a role to a user (the role's expanded perms must be ⊆ actor's),
creating/editing a custom role (its perms ⊆ actor's), and **never** let a non‑owner
add `'*'` to any role.

**4.2 Last‑active‑owner protection.**
The business must always have **≥1 active admin whose role grants `'*'`** (or, more
strictly, whose roleKey is `owner`). Block any action that would drop the count of
active owners to zero: deactivating the last owner, changing the last owner's role
to a non‑owner role, or editing the `owner` role to remove `'*'`. Compute the count
inside the transaction (`FOR UPDATE`/`COUNT`), not from a stale read.

**4.3 No self‑lockout.**
An admin **cannot**: deactivate their own account, remove their own `staff:manage`
or `roles:manage` by changing their own role, or delete the role they are currently
assigned to. Return a clear `VALIDATION_ERROR` ("You can't remove your own admin
access."). Compare against `auth.value.admin.id`.

**4.4 Deactivate / role‑downgrade must revoke live sessions.**
When you set `isActive=false` OR change a user's role to fewer permissions, **revoke
that user's `admin_sessions`** in the same tx (`UPDATE admin_sessions SET revoked_at
= now() WHERE admin_user_id = :id AND revoked_at IS NULL`). Otherwise their existing
12h session keeps its old grants. (Role *upgrade* doesn't require revoke, but
revoking is harmless and simplest — revoke on any role change.)

**4.5 System roles are protected.**
`roles.isSystem = true` roles **cannot be deleted**. Their permissions are editable
"per policy" — but **the `owner` role's `'*'` must never be removed** (4.2). Prefer:
block editing `owner` entirely; allow editing other system roles' perms only within
4.1. Custom (non‑system) roles are fully editable/deletable.

**4.6 Can't delete a role that's still assigned.**
Deleting a role with `admin_users.roleId` referencing it would `set null` those users
(they fall back to legacy enum → possibly wrong grants). **Block deletion while any
active admin uses the role** ("Reassign the N admins on this role first."). Only
delete when unused.

**4.7 Validate every incoming permission string** with `isPermission()`; drop
unknowns. Only the `owner` grant may be `'*'`, and only an actor with `'*'` may set it.

**4.8 Email uniqueness** (citext unique) on invite → clean 400 via
`withConstraintMapping` (message "That email already has an admin account.").

**4.9 Everything audited** — invite/edit/deactivate/reactivate a user, create/edit/
delete a role. `entityType: 'admin_user' | 'role'`.

**4.10 `isUuid` guard** on every `[id]`/`[roleId]` param.

---

## 5. MODULE A — Staff / Users  (`/admin/staff`, `staff:manage`)

### 5.1 Data layer — `apps/web/src/lib/admin/staff.ts`
- `listAdminUsers({ search?, filter?: 'all'|'active'|'inactive', page? })` →
  join `roles` for role name/key; return `id, email, name, roleKey, roleName,
  isActive, lastLoginAt, createdAt`. Search on email/name (ilike, escape `%_\`).
- `listAssignableRoles(actorGrants)` → all roles, each flagged `assignable` =
  `canGrantAll(actorGrants, expandPermissions(role.permissions))`. The invite/edit
  UI must only offer assignable roles.
- `inviteAdmin({ email, name, roleId }, actor)` → tx + `withConstraintMapping`:
  validate email shape + `isUuid(roleId)`; load the role `FOR` read; enforce **4.1**
  (role perms ⊆ actor grants); insert `admin_users {email(lowercased via citext),
  name, roleId, role:'staff'(legacy default), isActive:true}`; audit `admin_user.invite`.
  Return the id. (Optionally best‑effort email them — mirror the OTP‑request email send.)
- `updateAdmin(id, { name?, roleId?, isActive? }, actor)` → tx + `FOR UPDATE`:
  - `isUuid(id)`; not found → NOT_FOUND.
  - **4.3** self‑lockout: if `id === actor.id` and (roleId downgrades own admin perms
    OR isActive=false) → reject.
  - **4.1** if roleId changes: new role perms ⊆ actor grants.
  - **4.2** last‑owner: if this change removes the last active owner → reject.
  - Apply changes; **4.4** if isActive→false or roleId changed → revoke the user's
    sessions in‑tx; audit `admin_user.update` (before/after role + isActive).
- (Optional) `getAdminDetail(id)` for an edit page + that user's recent audit actions.

> Do **not** build hard‑delete of admins — deactivate is the safe path (audit history
> keeps referential integrity). Leave a `// TODO` if asked later.

### 5.2 Routes
- `GET  /api/admin/staff` — list. Guard `staff:manage`.
- `POST /api/admin/staff` — invite. Body `{ email, name, roleId }`. Guard `staff:manage`.
- `PATCH /api/admin/staff/[id]` — update `{ name?, roleId?, isActive? }`. Guard `staff:manage`.
  Pass `auth.value.admin` (id + grants) into the data layer for the §4 checks.

### 5.3 UI
- `app/admin/(shell)/staff/page.tsx` (server, gate `staff:manage`): list (Name ·
  Email · Role · Last login · Status), filter pills (All/Active/Inactive), search,
  a **"+ Invite admin"** button, and per‑row inline edit or a row link. Show only
  assignable roles in the role `<select>`.
- `components/admin/StaffManager.tsx` (client): invite form (email, name, role
  select) + per‑row role select + active toggle + Save; posts to the routes;
  `router.refresh()`; resync via `[initial]`; surface server error messages (the
  §4 guards return friendly messages — show them).

### 5.4 Edge cases (Staff)
1. Invite with an email that already exists → 400 "already has an admin account".
2. Invite/assign a role that exceeds the actor's grants → 403/400 (4.1) — and the UI
   shouldn't even offer it.
3. Deactivating yourself → blocked (4.3).
4. Deactivating / demoting the **last active owner** → blocked (4.2).
5. Reactivating an inactive admin → allowed (does not require session revoke).
6. Editing a user's role → their live sessions revoked (4.4); note in UI copy
   "they'll be signed out".
7. Malformed `[id]` or `roleId` → NOT_FOUND / VALIDATION_ERROR, never 500.
8. A `staff:manage` admin who is NOT owner must not be able to grant `roles:manage`,
   `'*'`, or any permission they lack — verify server‑side (don't trust the UI).
9. Email casing — `citext` folds case; treat `Owner@x.com` == `owner@x.com`.
10. Empty name / invalid email shape → validation error.

---

## 6. MODULE B — Roles / Permissions  (`/admin/roles`, `roles:manage`)

### 6.1 Data layer — `apps/web/src/lib/admin/roles.ts`
- `listRoles()` → all roles with `key, name, description, isSystem, permissions`,
  a derived `permissionCount` (or "All" for `'*'`), and `userCount` (active admins on
  each role, via join to `admin_users`). Order: system first, then custom by name.
- `getRole(id)` → the role + its permission set, for the editor.
- `createRole({ key, name, description, permissions }, actor)` → tx +
  `withConstraintMapping`:
  - validate `key` (`^[a-z][a-z0-9_]{1,30}$`, unique — DB enforces), name length,
    description ≤ 200.
  - `permissions`: filter through `isPermission`; drop unknowns; **reject `'*'`
    unless actor holds `'*'`**; enforce **4.1** (⊆ actor grants).
  - insert `isSystem:false`; audit `role.create`.
- `updateRole(id, { name?, description?, permissions? }, actor)` → tx + `FOR UPDATE`:
  - `isUuid(id)`; not found → NOT_FOUND.
  - **4.5**: block editing the `owner` role (or at minimum block removing `'*'`);
    system roles' perms only within 4.1.
  - **4.2**: if editing a role currently held by the last owner in a way that removes
    `'*'` → reject.
  - **4.3**: if `id` is the actor's own role and the change removes `staff:manage`/
    `roles:manage` → reject (self‑lockout).
  - validate + subset‑check permissions as in create; audit `role.update`.
- `deleteRole(id, actor)` → tx: `isUuid`; not found → NOT_FOUND; **4.5** system role
  → reject; **4.6** in use by any active admin → reject with count; else delete +
  audit `role.delete`.

### 6.2 Routes
- `GET   /api/admin/roles` — list. Guard `roles:manage`.
- `POST  /api/admin/roles` — create. Guard `roles:manage`.
- `GET   /api/admin/roles/[id]` — detail. Guard `roles:manage`.
- `PATCH /api/admin/roles/[id]` — update. Guard `roles:manage`.
- `DELETE /api/admin/roles/[id]` — delete custom role. Guard `roles:manage`.
  (Use the `DELETE` method; Next route handler `export async function DELETE`.)

### 6.3 UI
- `app/admin/(shell)/roles/page.tsx` (server, gate `roles:manage`): list roles
  (Name · Key · Users · #Permissions/"All" · System badge), "+ New role", link to editor.
- `app/admin/(shell)/roles/new/page.tsx` and `.../[id]/page.tsx` → a shared
  `components/admin/RoleForm.tsx` (client): name, key (create‑only), description, and
  a **permission checkbox grid built from `permissionsByResource()`** — group headers
  per resource, each permission a checkbox with its `label`, sensitive ones marked
  (e.g. a small "sensitive" tag). Disable checkboxes the actor can't grant (perms not
  in their own grants) so the UI matches 4.1. For the `owner` role, render read‑only.
  Submit → POST/PATCH; delete button on custom roles (confirm dialog) → DELETE.
- Pass the actor's grants (or the assignable‑permission set) from the server page into
  `RoleForm` so it can disable non‑grantable checkboxes.

### 6.4 Edge cases (Roles)
1. Duplicate `key` → 400 (unique). 2. Deleting a system role → blocked (4.5).
3. Deleting a role in use → blocked with the count (4.6). 4. Non‑owner adding `'*'`
or a permission they lack → blocked (4.1/4.7). 5. Editing `owner` → blocked/read‑only
(4.5). 6. Removing `'*'` from the only owner path → blocked (4.2). 7. Editing your own
role to drop `roles:manage` → blocked (4.3). 8. Unknown permission strings in the
payload → silently dropped via `isPermission`. 9. Empty permission set is allowed
(a role that can do nothing) — that's valid. 10. Malformed id → NOT_FOUND.

---

## 7. MODULE C — Audit Log  (`/admin/audit`, `audit:read`) — read‑only

### 7.1 Data layer — `apps/web/src/lib/admin/audit.ts`
- `listAudit({ actorId?, entityType?, action?, page? })` → join `admin_users` for
  the actor email/name (actor may be null → "system"); return `action, entityType,
  entityId, before, after, actorEmail, createdAt`, newest first, paginate ~50.
  `isUuid` guard the optional `actorId`/`entityId` filters (drop if malformed).
- No mutations. This surface is **sensitive** (`audit:read` is Owner‑only by default)
  because it exposes every admin action across the store.

### 7.2 Route
- `GET /api/admin/audit` — list with filters. Guard `audit:read`.

### 7.3 UI
- `app/admin/(shell)/audit/page.tsx` (server, gate `audit:read`): filter by
  entityType / action (dropdowns), a table (When · Actor · Action · Entity · a
  compact before→after diff), pagination. Render `before`/`after` JSON compactly
  (e.g. changed keys only). Read‑only.

### 7.4 Edge cases (Audit)
1. `adminUserId` null (system action or deleted admin) → show "system"/"—".
2. Huge `before/after` blobs → clamp/summarize, don't blow up the row.
3. Malformed filter ids → ignored, not 500. 4. Empty log → friendly empty state.
5. Pagination clamped (finite, 1..1e6). 6. Do NOT expose this to non‑`audit:read`.

---

## 8. Build + TEST loop (follow exactly — this is how all 6 shipped modules were verified)

For each module: **data layer → routes → UI → tests → gate → live‑verify → self‑review → commit.**

### 8.1 Automated tests (REQUIRED — this module is security‑critical)
Add `apps/web/src/lib/admin/rbac-guards.test.ts` (vitest) covering the §4 pure guards:
- `canGrantAll`: owner `'*'` grants anything; non‑owner can grant a subset; **cannot**
  grant a permission they lack; cannot grant `'*'`.
- last‑active‑owner: a helper like `wouldRemoveLastOwner(currentOwners, change)` →
  true when the change drops active‑owner count to 0; false otherwise.
- self‑lockout: `isSelfLockout(actorId, targetId, change)` → true for self‑deactivate
  / self‑demote of `staff:manage`/`roles:manage`.
- permission validation: unknown strings dropped, `'*'` gated.
Keep these functions PURE (inputs → boolean), no db, so they're fast and exhaustive.
Run `pnpm --filter web test` — all green (the repo is currently at 100+ passing tests).

Also: `pnpm --filter web typecheck` clean and `pnpm --filter web build` clean (new
routes appear in the route list).

### 8.2 Live verification (against the running dev server on :3000)
Sign in as owner in dev: `POST /api/admin/auth/otp/request {email:'owner@kakoa.in'}`
then `/verify {challengeId, code:'000000'}` (OTP test mode). Then drive the real API
via `fetch` in the browser context and assert responses + DB effects. **Prove each
invariant with a real request**, e.g.:
- Invite an admin on the `viewer` role → 201; it appears in the list.
- As a **non‑owner** actor, try to assign the `owner`/`admin` role or a role with
  `'*'` → **rejected** (simulate by creating a `staff:manage`‑only role/user, or at
  minimum unit‑test the guard since the seeded owner has `'*'`).
- Deactivate the **last owner** → **rejected** (4.2).
- Deactivate **yourself** → **rejected** (4.3).
- Change a user's role → their `admin_sessions.revoked_at` is set (4.4) — verify the
  row, and that their next `/api/admin/me` is 401.
- Create a custom role with a bogus permission string → it's dropped; with `'*'` as
  non‑owner → rejected.
- Delete a role **in use** → rejected; delete an unused custom role → 200.
- Every mutation wrote an `admin_audit_log` row (query it) and the Audit Log page
  shows it.
Take a screenshot / DOM snapshot of each page as proof.

### 8.3 Adversarial self‑review before "done"
Re‑read the write paths hunting specifically for: privilege escalation (can any
non‑owner grant beyond their grants?), lockout (any path to zero active owners or
self‑lock?), session revoke gaps (deactivate without revoke?), missing `isUuid`,
missing audit, unmapped constraint → 500, and `audit:read` leakage. Fix, re‑verify.

### 8.4 Commit (do NOT push unless asked)
```
Admin Staff & Roles: user management + role editor + audit log

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## 9. Definition of Done
- [ ] `typecheck` clean · `test` green (new `rbac-guards.test.ts` covers §4) · `build` clean
- [ ] Every route gated on `staff:manage` / `roles:manage` / `audit:read` respectively
- [ ] **4.1** no privilege escalation — non‑owner cannot grant beyond own grants or `'*'`
- [ ] **4.2** last active owner can never be removed/demoted/stripped of `'*'`
- [ ] **4.3** no self‑lockout (self‑deactivate / self‑demote blocked)
- [ ] **4.4** deactivate & role change revoke the target's `admin_sessions` in‑tx
- [ ] **4.5** system roles undeletable; `owner` role protected from losing `'*'`
- [ ] **4.6** roles in use can't be deleted
- [ ] **4.7** incoming permission strings validated via `isPermission`; `'*'` gated
- [ ] **4.8** duplicate admin email → clean 400
- [ ] **4.9** every mutation audited; **4.10** every id `isUuid`‑guarded
- [ ] Role editor built from `permissionsByResource()`; non‑grantable checkboxes disabled
- [ ] Audit Log read‑only, filters work, sensitive & Owner‑gated
- [ ] Live‑verified each invariant with a real request; audit rows confirmed

---

## 10. Gotchas (do NOT repeat this session's hard‑won lessons)
1. **`pgConstraintMessage` unwraps `error.cause`** — drizzle wraps the PostgresError;
   `.code` is undefined on the top‑level error. (Already handled in `db-errors.ts`.)
2. **Every count/paise column is `int4`** (max 2,147,483,647) — not relevant to text
   permissions, but cap any numeric input before the DB.
3. **`useState(initialProp)` never resyncs** — add the `[initial]` effect after refresh.
4. **Never compare a raw string to a uuid column** — `isUuid` first (`22P02` → 500).
5. **Grants are resolved per request** in `resolveAdminSession` — a role change is
   live on the target's next request; that's why deactivate/downgrade must **revoke
   sessions** to take immediate effect.
6. **Do not trust the client** for authorization — the disabled checkboxes / filtered
   role list are UX only; enforce §4 in the data layer for every request.
7. Admin mutations are **audited in‑tx** — reviewers flag a missing audit row.

---

### Appendix — file map to imitate
| Need | Copy from |
|---|---|
| list + filters + search + pagination + client table | `app/admin/(shell)/inventory/page.tsx` + `components/admin/InventoryTable.tsx` |
| detail/edit page + notFound | `app/admin/(shell)/products/[id]/page.tsx` + coupons `[id]` |
| create form (new + edit shared component) | `components/admin/CouponForm.tsx` + coupons `new`/`[id]` pages |
| mutation data layer (tx + FOR UPDATE + audit + mapping) | `lib/admin/inventory.ts` (`adjustStock`), `lib/admin/coupons.ts` |
| pure validator + tests | `lib/admin/coupon-validation.ts` + `.test.ts` |
| route with guard + envelope | `app/api/admin/inventory/[variantId]/adjust/route.ts` |
| RBAC kernel exports | `packages/kernel/src/{permissions,roles}.ts` |
| session/grants + revoke | `apps/web/src/lib/admin/session.ts` |

Build **Staff** first, then **Roles**, then **Audit Log**. The invariants in §4 are
the hard part — write them as pure functions, test them to death, then wire the CRUD
around them. Good luck. 🔐🍫
