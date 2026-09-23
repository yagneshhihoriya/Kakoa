# Media storage — Cloudflare R2

Product / Media Library images are stored in **Cloudflare R2** through the
existing S3-compatible `MediaProvider` (`packages/integrations/src/media`).
Nothing in the admin or storefront knows which provider is behind it.

```
Admin Dashboard  (Media Library / Media Picker / Product images)
      │  multipart POST  (server-proxied — the browser never talks to the bucket)
      ▼
POST /api/admin/media          requireAdmin("media:write") · magic-byte sniff · 8 MB cap · MIME allowlist
      ▼
uploadMedia()  →  getMediaProvider()  →  S3MediaProvider   (@aws-sdk/client-s3, S3-compatible API)
      ▼
Cloudflare R2 bucket           key = media/<uuid>.<ext>   Cache-Control: public, max-age=1y, immutable
      ▼
media_assets.url + product_images.url   =  <S3_PUBLIC_BASE_URL>/media/<uuid>.<ext>
      ▼
Website: next/image  ·  Admin: <img>      (public objects — no signed URLs, no CORS needed)
```

Locally, with no `S3_*` vars set, uploads go to `apps/web/public/uploads`
(`LocalMediaProvider`) — no bucket needed for day-to-day development.

## 1. Prerequisites

- A Cloudflare account with R2 enabled.
- Wrangler runs via `npx wrangler` and needs **Node.js ≥ 22**
  (e.g. `nvm use 22`).

## 2. Authenticate Wrangler

Interactive (opens a browser):

```bash
npx wrangler login
npx wrangler whoami
```

Non-interactive / CI: create an API token (Cloudflare dashboard → *My Profile →
API Tokens*, template **"Edit Cloudflare Workers"** or a custom token with
`Workers R2 Storage: Edit`) and export it — never commit it:

```bash
export CLOUDFLARE_API_TOKEN=<token>
export CLOUDFLARE_ACCOUNT_ID=<account-id>
```

## 3. Create the bucket

```bash
npx wrangler r2 bucket create kakoa-media
npx wrangler r2 bucket list          # verify it exists
```

The bucket name is yours to choose; it becomes `S3_BUCKET`. **Do not delete or
modify the previous AWS S3 bucket** — existing rows keep pointing at it (§7).

## 4. Make objects publicly readable

The app serves images by public URL (same model as before on S3), and the
`<account>.r2.cloudflarestorage.com` S3 endpoint is **never** publicly readable —
so the bucket needs a public URL. Either:

- **r2.dev subdomain (quickest):** dashboard → R2 → your bucket → *Settings →
  Public access → r2.dev subdomain → Allow*. You get `https://pub-<hash>.r2.dev`.
  Cloudflare rate-limits r2.dev and recommends it for non-production use.
- **Custom domain (recommended for production):** *Settings → Public access →
  Custom domains → Connect domain* (a zone on the same account, e.g.
  `media.<your-domain>`), or `npx wrangler r2 bucket domain add kakoa-media --domain <host>`.
  This puts the bucket behind Cloudflare's CDN/cache.

Whichever you pick is `S3_PUBLIC_BASE_URL`. Uploads never need "write" public
access — writes always go through the server with the API token.

Verify public delivery end to end before wiring the app up:

```bash
npx wrangler r2 bucket dev-url get kakoa-media            # prints the public URL when enabled
npx wrangler r2 object put kakoa-media/_smoke.png --file=./some.png --content-type image/png --remote
curl -I https://<public-host>/_smoke.png                  # expect 200 + image/png
npx wrangler r2 object delete kakoa-media/_smoke.png --remote
```

**`--remote` matters:** Wrangler 4's `r2 object` commands default to a *local*
Miniflare bucket under `./.wrangler/` — without the flag `put` reports
"Upload complete." and `get` round-trips, yet nothing reaches Cloudflare and the
public URL keeps returning 404.

## 5. Create an R2 API token (S3 credentials)

Dashboard → R2 → *Manage R2 API Tokens → Create API token*:
permission **Object Read & Write**, scoped to the bucket. It shows an
**Access Key ID** and **Secret Access Key** once — these are the `S3_ACCESS_KEY_ID`
/ `S3_SECRET_ACCESS_KEY` values. The **Account ID** (dashboard sidebar) forms the
endpoint.

## 6. Environment variables

Set these in `apps/web/.env.local` locally and in the **Vercel project
environment** (Production + Preview) for deploys. Names only — never commit
values (every `.env*` file except `.env.example` is gitignored; `.env.example`
holds placeholders only).

| Variable | Value for R2 |
|---|---|
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | the bucket name from §3 |
| `S3_ACCESS_KEY_ID` | R2 API token Access Key ID (§5) |
| `S3_SECRET_ACCESS_KEY` | R2 API token Secret Access Key (§5) |
| `S3_PUBLIC_BASE_URL` | the public URL from §4 — **required** whenever `S3_ENDPOINT` is set |
| `S3_LEGACY_PUBLIC_HOSTS` | comma-separated previous media hosts to keep serving, e.g. the old AWS bucket host (§7) |

The provider factory refuses to start with `S3_ENDPOINT` but no
`S3_PUBLIC_BASE_URL` — that combination would persist URLs that 403 for every
shopper. `next.config.ts` allows `/_next/image` to fetch only from
`S3_PUBLIC_BASE_URL`'s host, the AWS bucket host (when no endpoint is set) and
`S3_LEGACY_PUBLIC_HOSTS` — exact hostnames, no wildcards.

Restart `next dev` after changing these (the provider is memoized and
`remotePatterns` are read at config load).

`next.config.ts` reads `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_PUBLIC_BASE_URL` and `S3_LEGACY_PUBLIC_HOSTS` **at build time**. Turborepo
runs tasks in strict env mode, so those five are declared under
`tasks.build.env` in `turbo.json` (and `.env*` files are build inputs) — without
that a process-env-only build (CI, Docker, a cached `turbo build`) would silently
drop the media host from `remotePatterns`. Add any new build-time media var there.

## 7. Existing images (previously uploaded to AWS S3)

`media_assets.url` and `product_images.url` store **full public URLs**, so rows
uploaded before the switch still point at the AWS bucket. No database migration
is required. Two supported strategies:

**A — Keep legacy images where they are (default, zero risk).**
New uploads go to R2; old URLs keep working as long as the AWS bucket and its
public-read policy remain and the host is listed in `S3_LEGACY_PUBLIC_HOSTS`.
Deleting a legacy asset from the admin removes the DB row; the S3 object is left
in place (the app never deletes from a legacy bucket).

**B — Copy legacy objects into R2 and repoint the rows.**
A safe, idempotent, non-destructive script is provided:

```bash
cd packages/db
# DATABASE_URL + the S3_* vars (pointing at R2) must be exported in the shell.
pnpm db:migrate-media --legacy-host=<old-bucket-host>            # dry run: lists what would move
pnpm db:migrate-media --legacy-host=<old-bucket-host> --apply    # copies + repoints URLs
# optional: --limit=50 (trial batch)  --concurrency=4
```

It reads each legacy object over its public URL (no AWS keys needed), uploads it
to R2 under the **same key**, verifies the new public URL responds, then updates
`media_assets.url` and every `product_images.url` that referenced it — in a
transaction. Objects already present in R2 are not re-uploaded (safe to rerun /
resume). It **never deletes from S3**; exit code 1 means some objects failed and
the run should be repeated. Keep `S3_LEGACY_PUBLIC_HOSTS` set until it reports
zero remaining rows, then remove it. Only after that — and after verifying the
site — decide separately whether to retire the AWS bucket.

## 8. CORS, signed URLs, security

- **CORS:** not needed. Uploads are server-proxied (browser → Next.js API →
  R2) and reads are plain `<img>` / `next/image` fetches. If presigned
  direct-to-bucket uploads are ever added, the bucket will then need a CORS
  policy (`npx wrangler r2 bucket cors set …`).
- **Signed URLs:** not used — objects are public by design (same as before).
- Credentials live only in env / Vercel secrets; validation (sniff, size, MIME)
  and the `media:write` admin permission are unchanged; the bucket is
  write-locked to the API token.

## 9. Rollback

Point the `S3_*` vars back at the AWS bucket (unset `S3_ENDPOINT` /
`S3_PUBLIC_BASE_URL`) and add the R2 public host to `S3_LEGACY_PUBLIC_HOSTS` so
anything uploaded to R2 in the meantime keeps rendering.
