# Build Handoff — Admin **Notifications** module (+ free provider setup)

> **You are a fresh Claude with no prior context. Read this whole file first.**
> This module manages **transactional notification templates** (email + SMS), records a
> **send log**, and offers a **send‑test**. The delivery providers already exist behind
> interfaces (`EmailProvider`, `SmsProvider`) — you wire the admin surface + DB‑backed
> template overrides + a log. It needs **one migration** (2 new tables). Match the
> existing admin modules exactly.
>
> Shared conventions: `docs/admin-platform/HANDOFF-Customers-and-Reviews.md` §1.

---

## 0. 🟢 FREE PROVIDER SETUP — read this first (answers "what free service do we use now?")

### Email → **Resend (free tier)** — already integrated, use it now
- Interface: `EmailProvider.send({ to, subject, html, text?, idempotencyKey? })`
  (`packages/integrations/src/email/provider.ts`). Impl: `ResendEmailProvider` (`resend.ts`)
  vs `FakeEmailProvider` (`fake.ts`, logs to console). Selected by `RESEND_API_KEY` presence.
- **Free tier**: 100 emails/day, 3,000/month, 1 verified domain — plenty for launch/testing.
  Set `RESEND_API_KEY`; for a real "from" address verify a domain, or use Resend's
  `onboarding@resend.dev` sender for testing. **No code change needed** — it's wired.
- With no key, `FakeEmailProvider` logs the email (works offline for dev).

### SMS → the honest answer for **India**
There is **no genuinely free PRODUCTION transactional SMS in India** — TRAI mandates **DLT
registration** (register your business entity + every message template on a DLT portal via
an operator). Plan accordingly:
- **Right now / dev / demo → `FakeSmsProvider`** (already exists,
  `packages/integrations/src/sms/fake.ts`) — logs the code/message to the console, **free,
  zero setup**. It's auto‑selected when `OTP_TEST_MODE=1` or `MSG91_AUTH_KEY` is unset
  (`packages/integrations/src/sms/index.ts`).
- **Cheapest REAL delivery (after DLT):**
  - **MSG91** — **already integrated** (`Msg91SmsProvider`, `packages/integrations/src/msg91/client.ts`).
    Has free trial credits; production ~₹0.15–0.25/SMS after DLT. Set `MSG91_AUTH_KEY`.
  - **Fast2SMS** — popular/cheap in India; a "Quick‑SMS"/promotional route works for testing
    without full DLT (not for OTP/transactional at scale). If you want it, add a
    `Fast2SmsProvider implements SmsProvider` next to MSG91 (same interface) — do NOT scatter
    Fast2SMS specifics outside `packages/integrations`.
- **Recommendation:** keep `FakeSmsProvider` for now (free, works); wire MSG91 (already there)
  or add Fast2SMS when you complete DLT. Email (Resend free) is the reliable free channel today.

### 🔴 SMS interface GAP you must close
`SmsProvider` today has only `sendOtp({ phoneE164, code, purpose })` — it's **OTP‑only**.
Notification SMS (order shipped/delivered) needs a **generic** message send. Extend the
interface with `sendTransactional({ phoneE164, message, purpose })` (or `send({phoneE164, body})`),
implement it in **`FakeSmsProvider`** (console log) and **`Msg91SmsProvider`** (MSG91 flow/
template SMS API), and leave the OTP path as‑is. Keep all provider specifics inside
`packages/integrations`.

---

## 1. Project & commands
KAKOA — D2C chocolate e‑commerce (India). Turborepo + pnpm; app `apps/web` (pkg `web`),
Next 16 App Router, TS strict, Tailwind v4; DB `@kakoa/db` (Drizzle + postgres‑js); providers
in `@kakoa/integrations`.
```bash
pnpm --filter web typecheck && pnpm --filter web test && pnpm --filter web build   # build is stricter than tsc
# migrations (this module adds tables):
pnpm --filter @kakoa/db db:generate                                   # generate SQL from schema
DATABASE_URL=$DATABASE_URL_SESSION pnpm --filter @kakoa/db db:migrate  # apply via the SESSION pooler (:5432), not the txn pooler
```

---

## 2. Conventions (condensed — full detail in the shared doc §1)
1. **Guard**: `requireAdmin('notifications:read')` for reads, `requireAdmin('notifications:manage')`
   for template edits + send‑test (`lib/admin/guard.ts`). `auth.value.admin.id` for audit/updatedBy.
2. **Envelope**: `jsonOk`/`jsonErr` (`lib/api/http.ts`).
3. **`isUuid(x)`** before any uuid compare.
4. **Wrap mutations** in `withConstraintMapping(() => db.transaction(...))` (unwraps `error.cause`).
5. **Audit in‑tx**: `admin_audit_log { adminUserId, action:'notification_template.update'|'notification.test', entityType:'notification_template', entityId, before, after }`.
6. **`FOR UPDATE` + `LEFT JOIN` → `0A000`** — scope with `.for('update', { of: <table> })`.
7. **Client resync**: `useEffect(() => setState(initial), [initial])`.
8. **Page shell**: `export const dynamic="force-dynamic"`, `<div className="mx-auto max-w-5xl">`; standard palette.
9. **Nav is automatic** — `notifications` module registered (order 50, group kernel, perms
   `notifications:read` + `notifications:manage`, nav "Notifications" → `/admin/notifications`, icon `bell`).
10. **Pure logic → own file + vitest** (template placeholder rendering + validation).
11. 🔴 **PII**: notification recipients are phone/email — **mask** them in the log UI
    (`maskPhone` from `@kakoa/core`, `maskEmail` from `lib/admin/customer-privacy.ts`). Never log a raw OTP code.

---

## 3. What exists today (read before building)
- **Templates are CODE**: `apps/web/src/lib/email/templates.ts` renders `orderConfirmationEmail`,
  `orderCancelledEmail` (pure; brand‑voiced; HTML‑escapes via `esc()`).
  `apps/web/src/lib/email/send.ts` composes + dispatches **best‑effort**
  (`sendOrderConfirmation`, `sendOrderCancellation`) via `getEmailProvider()`.
- **No DB tables** for notifications yet, **no send log**, **no editable templates**.
- The notification *events* that exist: order confirmation, order cancellation (email). SMS is
  only OTP today. Ship/deliver emails + SMS are NOT built (this module can add the templates,
  but the actual triggers on shipment status are the Shipping module's job — coordinate: this
  module owns the *templates + log + provider*, Shipping calls the send).

---

## 4. Migration — two new tables (`packages/db/src/schema/notifications.ts`)
Add the schema, export from the schema index, then generate + apply (§1).

### `notification_templates` — DB overrides for the code defaults
```
notification_templates {
  id uuid pk default gen_random_uuid(),
  key text not null,              -- event key: 'order_confirmed','order_cancelled','order_shipped','order_delivered', ...
  channel text not null,          -- 'email' | 'sms'  (CHECK)
  subject text,                   -- email only (null for sms)
  body text not null,             -- template with {{placeholders}}
  is_active boolean not null default true,
  updated_by uuid references admin_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  UNIQUE(key, channel)            -- one override per event×channel
}
```
The CODE templates remain the **fallback**: rendering looks up the DB override for
`(key, channel)`; if absent or `is_active=false`, use the code default. So the store works
with zero rows, and admins can override copy without a deploy.

### `notification_log` — append‑only send history (`notifications:read`)
```
notification_log {
  id uuid pk default gen_random_uuid(),
  channel text not null,          -- 'email' | 'sms'
  template_key text not null,     -- the event key
  recipient text not null,        -- STORE MASKED (never full PII) OR store full + mask in the read layer — pick masked-at-write for safety
  order_id uuid references orders(id) on delete set null,
  status text not null,           -- 'sent' | 'failed' | 'skipped'  (CHECK)
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
}
```
Wire `send.ts` (and the OTP send path, and future ship/deliver sends) to insert a
`notification_log` row after each attempt — **best‑effort** (a log‑insert failure must never
break the send, and a send is already best‑effort). Store the recipient **masked**.

---

## 5. Data layer
### `apps/web/src/lib/admin/notification-templates.ts`
- `TEMPLATE_CATALOG` (PURE, in `notification-catalog.ts`): the known `{ key, channel, label,
  defaultSubject?, defaultBody, placeholders: string[] }[]` — e.g. `order_confirmed`(email),
  `order_cancelled`(email), `order_shipped`(email+sms), `order_delivered`(email+sms). This
  drives the editor and lists the allowed `{{placeholders}}` per template
  (e.g. `{{orderNumber}}`, `{{customerName}}`, `{{trackingUrl}}`, `{{amount}}`).
- `listTemplates()` → for each catalog entry, merge the DB override (if any) → `{ key,
  channel, label, subject, body, isActive, isOverridden, placeholders }`.
- `getTemplate(key, channel)` → merged template + placeholders for the editor.
- `upsertTemplate({ key, channel, subject, body, isActive }, adminUserId)` → tx +
  `withConstraintMapping`: validate `(key, channel)` is in the catalog (reject unknown);
  validate placeholders in `body`/`subject` are a subset of the catalog's allowed set (reject
  unknown `{{x}}`); `onConflictDoUpdate` on `(key, channel)`; set `updatedBy`; audit.
- `renderTemplate(merged, vars)` (PURE, tested) → substitute `{{placeholder}}` from `vars`,
  HTML‑escape values for email bodies (reuse the `esc()` approach), leave SMS plain. Missing
  var → leave a clear marker or empty (documented). Used by both the preview and the real send.

### `apps/web/src/lib/admin/notification-log.ts`
- `listNotificationLog({ channel?, status?, search?, page? })` → recent sends, newest first,
  recipient masked, paginate ~50. Join `orders` for order number when `order_id` set.
- `recordNotification({...})` → the best‑effort insert used by send paths (export it; call
  from `send.ts` etc.).

### `apps/web/src/lib/admin/notification-test.ts`
- `sendTestNotification({ key, channel, to }, adminUserId)` → render the (merged) template
  with **sample vars**, send via `getEmailProvider()` / `getSmsProvider()` (the generic SMS
  method from §0), record a `notification_log` row, audit `notification.test`. Validate `to`
  (email regex or `+91` phone). Rate‑limit (e.g. ≤ 5 tests/min/admin) to avoid abuse.

---

## 6. Routes
- `GET  /api/admin/notifications/templates` — list. `notifications:read`.
- `GET  /api/admin/notifications/templates/[key]/[channel]` — one template. `notifications:read`.
- `PATCH /api/admin/notifications/templates/[key]/[channel]` — upsert override. `notifications:manage`.
- `POST /api/admin/notifications/test` — `{ key, channel, to }`. `notifications:manage`.
- `GET  /api/admin/notifications/log` — send history. `notifications:read`.
- `GET  /api/admin/notifications/providers` — active provider status (email: Resend|Fake;
  sms: MSG91|Fake) so the admin sees whether real delivery is configured. `notifications:read`.
  (Derive from env presence — do NOT return keys.)

---

## 7. UI — `/admin/notifications`
- `app/admin/(shell)/notifications/page.tsx` (server, gate `notifications:read`): three
  sections/tabs — **Templates**, **Log**, **Providers**.
  - **Providers card**: "Email: Resend (live)" / "Email: Fake (dev)"; "SMS: Fake (dev)" /
    "SMS: MSG91 (live)" — a green/grey badge. A note: "SMS requires DLT for production in India."
  - **Templates**: list catalog entries (key · channel · overridden? · active?); click →
    editor.
  - **Log**: table (When · Channel · Template · Recipient[masked] · Status · Order) with
    status filter; read‑only.
- `components/admin/NotificationTemplateEditor.tsx` (client, gate on `notifications:manage`):
  subject (email only) + body textarea, a **placeholder palette** (the allowed `{{vars}}` as
  clickable chips), a **live preview** (render with sample vars), an **active** toggle, Save,
  and a **Send test** control (to field + button). Show server validation errors (unknown
  placeholder, bad recipient). Disable editing when lacking `notifications:manage`.

---

## 8. 🔴 Edge cases — test every one
1. **Zero overrides**: with no `notification_templates` rows, the store still sends using the
   CODE defaults (fallback) — verify an order confirmation email still renders.
2. **Unknown placeholder**: a body with `{{not_a_var}}` → rejected on save (subset check).
3. **Unknown (key, channel)**: PATCH for a template not in the catalog → rejected.
4. **HTML escaping**: email body vars are HTML‑escaped (no injection); SMS body is plain text.
5. **PII in the log**: recipient stored/shown **masked**; a raw OTP code is NEVER logged.
6. **Best‑effort logging**: a `notification_log` insert failure must not break the actual send
   (wrap it; the send is already best‑effort).
7. **Test‑send authz + rate‑limit**: `notifications:read` can't send a test; test‑send is rate‑limited.
8. **Provider not configured**: with Fake providers, a "send test" still "succeeds" (logs to
   console) and is recorded as `sent` (fake) — the Providers card must make clear delivery is
   simulated. With a bad real key, the provider throws → recorded `failed`, clean error to the admin.
9. **SMS length**: warn if an SMS body exceeds 160 chars (multi‑part billing) — soft warning, not a block.
10. **`is_active=false` override**: falls back to the code default (not "no notification").
11. **Malformed params / body** → `VALIDATION_ERROR`, never 500. `[key]/[channel]` params validated against the catalog.
12. `notifications:manage` enforced server‑side on PATCH + test; audit each change.

---

## 9. Build + TEST loop
schema + migration → provider SMS‑interface extension (Fake + MSG91) → data layer → routes →
UI → **unit tests** → gate → live‑verify → self‑review → commit.

### 9.1 Tests (REQUIRED)
- Unit‑test the PURE bits: `renderTemplate` (placeholder substitution, HTML‑escape for email,
  missing‑var behavior), placeholder‑subset validation, recipient validation, and the catalog
  merge (override vs fallback).
- `typecheck` clean · `test` green · **`build` clean** · migration applies cleanly.

### 9.2 Live verify (dev :3000; `owner@kakoa.in`, OTP `000000`)
- Providers card shows Fake/Fake (or Resend live if `RESEND_API_KEY` set).
- Edit the `order_confirmed` email template → save → preview reflects it; place/confirm an order
  → the confirmation email uses the OVERRIDE (check the Fake provider console log / Resend).
- Send a **test email** to your address → `FakeEmailProvider` logs it (or Resend delivers) →
  a `notification_log` row appears with masked recipient + `sent`.
- Send a **test SMS** → `FakeSmsProvider` logs it → log row recorded.
- Bad placeholder / unknown template / bad recipient → 400. `notifications:read`‑only context
  can't PATCH or test (403).
- Confirm audit rows for template edits + tests. Screenshot the Notifications page.

### 9.3 Commit (don't push unless asked)
```
Admin Notifications: editable templates (code fallback) + send log + test; SMS interface for transactional sends

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## 10. Definition of Done
- [ ] Migration adds `notification_templates` + `notification_log`; applies via SESSION pooler
- [ ] `SmsProvider` extended with a generic transactional send (Fake + MSG91 impl); OTP path unchanged
- [ ] Templates: DB override with CODE fallback; unknown key/channel/placeholder rejected; HTML‑escaped email
- [ ] Send log records every send (best‑effort, masked recipient, never raw OTP); read UI with filters
- [ ] Send‑test works via the active provider, rate‑limited, `notifications:manage`‑gated, recorded
- [ ] Providers card shows Email (Resend/Fake) + SMS (MSG91/Fake) status; no secrets leaked
- [ ] `notifications:manage` enforced server‑side; every change audited
- [ ] typecheck + tests + **build** all clean; pure `renderTemplate` unit‑tested
- [ ] Zero‑override fallback verified (existing order emails still send)

---

## 11. Gotchas
1. **Email = Resend (free tier), already wired** — just set `RESEND_API_KEY`; Fake logs to console otherwise.
2. **India SMS isn't free for production** (DLT) — use `FakeSmsProvider` now; MSG91 (wired) or Fast2SMS after DLT.
3. **`SmsProvider` is OTP‑only today** — extend it for transactional sends; keep specifics inside `packages/integrations`.
4. **Templates stay code‑fallback** — the DB override is optional; the store must work with zero rows.
5. **Mask recipients + never log raw OTP** in `notification_log`.
6. **`pgConstraintMessage` unwraps `error.cause`**; **`FOR UPDATE` + JOIN → `0A000`** (scope with `of`).
7. **`next build` stricter than `tsc`**; migrations apply with `DATABASE_URL=$DATABASE_URL_SESSION`.
8. **`AddressSnapshot` is from `@kakoa/db`, not `@kakoa/core`** (if you touch order data).

### Appendix
| Need | File |
|---|---|
| email provider + selection | `packages/integrations/src/email/{provider,resend,fake,index}.ts` |
| sms provider + selection | `packages/integrations/src/sms/{provider,fake,index}.ts`, `packages/integrations/src/msg91/client.ts` |
| code templates (defaults) + best‑effort send | `apps/web/src/lib/email/{templates,send}.ts` |
| masking | `@kakoa/core` `maskPhone`, `apps/web/src/lib/admin/customer-privacy.ts` `maskEmail` |
| schema + migration pattern | `packages/db/src/schema/*.ts`, `packages/db/migrations/` |
| settings‑style form | `components/admin/CouponForm.tsx` |

Email is free and ready (Resend); SMS runs on the Fake provider now and MSG91/Fast2SMS once
you do DLT. Build the templates + log + test console over the existing provider abstraction. 🍫🔔
