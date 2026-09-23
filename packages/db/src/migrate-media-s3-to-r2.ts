/**
 * migrate-media-s3-to-r2 — copy Media Library objects from a LEGACY public host
 * (the old AWS S3 bucket) into the CURRENTLY CONFIGURED S3-compatible store
 * (Cloudflare R2 via the S3_* env), then repoint the stored URLs.
 *
 * SAFE BY DESIGN
 *   • DRY RUN by default — nothing is written unless `--apply` is passed.
 *   • Idempotent / resumable — an object already present at its new public URL
 *     is not re-uploaded (its row is still repointed, completing a run that
 *     stopped between upload and DB update); rows already on the new host are
 *     never selected.
 *   • Non-destructive — it NEVER deletes anything from the legacy bucket.
 *   • Per-object failures are logged and skipped; the process exits non-zero
 *     if any failed so a rerun can pick them up.
 *   • Legacy objects are read over their PUBLIC URL (the S3 bucket policy allows
 *     anonymous GetObject), so no AWS credentials are required.
 *
 * USAGE (from packages/db, with DATABASE_URL and the S3_* vars pointing at R2):
 *   pnpm db:migrate-media --legacy-host=<old-bucket-host>            # dry run
 *   pnpm db:migrate-media --legacy-host=<old-bucket-host> --apply    # migrate
 *   optional: --limit=<n>   --concurrency=<n>   (default concurrency 4)
 * `--legacy-host` defaults to the first entry of S3_LEGACY_PUBLIC_HOSTS.
 */
import { db, mediaAssets, productImages } from "@kakoa/db";
import { S3MediaProvider } from "@kakoa/integrations";
import { eq, like } from "drizzle-orm";

interface Args {
  legacyHost: string;
  apply: boolean;
  limit: number;
  concurrency: number;
}

interface AssetRow {
  id: string;
  key: string;
  url: string;
  mimeType: string;
}

type Outcome = "migrated" | "already-present" | "planned" | "failed";

function readFlag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of argv) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return undefined;
}

function parseArgs(argv: string[]): Args {
  const fromEnv = (process.env.S3_LEGACY_PUBLIC_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter((h) => h !== "")[0];
  const legacyHost = (readFlag(argv, "legacy-host") ?? fromEnv ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (legacyHost === "") {
    throw new Error(
      "Pass --legacy-host=<old-bucket-host> (or set S3_LEGACY_PUBLIC_HOSTS).",
    );
  }
  const limit = Number(readFlag(argv, "limit") ?? "0");
  const concurrency = Number(readFlag(argv, "concurrency") ?? "4");
  return {
    legacyHost,
    apply: argv.includes("--apply"),
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0,
    concurrency:
      Number.isFinite(concurrency) && concurrency >= 1
        ? Math.min(16, Math.floor(concurrency))
        : 4,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`Missing env var ${name}`);
  return value;
}

/** Destination provider from the S3_* env — same rules as the app's factory. */
function buildDestination(): S3MediaProvider {
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL || undefined;
  if (endpoint !== undefined && publicBaseUrl === undefined) {
    throw new Error(
      "S3_PUBLIC_BASE_URL is required when S3_ENDPOINT is set (an S3-API endpoint such as R2's is not publicly readable).",
    );
  }
  return new S3MediaProvider({
    bucket: requireEnv("S3_BUCKET"),
    region: requireEnv("S3_REGION"),
    accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    endpoint,
    publicBaseUrl,
  });
}

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Repoint the media row and every product image that references the same URL. */
async function repoint(row: AssetRow, newUrl: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(mediaAssets).set({ url: newUrl }).where(eq(mediaAssets.id, row.id));
    await tx.update(productImages).set({ url: newUrl }).where(eq(productImages.url, row.url));
  });
}

async function migrateOne(
  row: AssetRow,
  dest: S3MediaProvider,
  apply: boolean,
  log: (msg: string) => void,
): Promise<Outcome> {
  const newUrl = dest.publicUrl(row.key);

  // Already at the destination (a previous run uploaded it): just finish the
  // DB repoint. Never re-upload — keys are content-unique and immutable.
  if (await headOk(newUrl)) {
    if (apply) await repoint(row, newUrl);
    log(`already-present  ${row.key}`);
    return "already-present";
  }

  const src = await fetch(row.url);
  if (!src.ok) {
    log(`FAILED (source ${src.status})  ${row.key}  ${row.url}`);
    return "failed";
  }
  const body = new Uint8Array(await src.arrayBuffer());
  if (body.length === 0) {
    log(`FAILED (empty source)  ${row.key}`);
    return "failed";
  }

  if (!apply) {
    log(`planned  ${row.key}  (${body.length} bytes) → ${newUrl}`);
    return "planned";
  }

  await dest.upload({ key: row.key, body, contentType: row.mimeType });
  if (!(await headOk(newUrl))) {
    log(`FAILED (uploaded but not readable at ${newUrl}) — check public access / S3_PUBLIC_BASE_URL  ${row.key}`);
    return "failed";
  }
  await repoint(row, newUrl);
  log(`migrated  ${row.key}  → ${newUrl}`);
  return "migrated";
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dest = buildDestination();
  const legacyPrefix = `https://${args.legacyHost}/`;

  console.log(
    `${args.apply ? "APPLY" : "DRY RUN"} · legacy host ${args.legacyHost} → ${dest.publicUrl("<key>")}` +
      (args.limit > 0 ? ` · limit ${args.limit}` : "") +
      ` · concurrency ${args.concurrency}`,
  );

  const query = db
    .select({
      id: mediaAssets.id,
      key: mediaAssets.key,
      url: mediaAssets.url,
      mimeType: mediaAssets.mimeType,
    })
    .from(mediaAssets)
    .where(like(mediaAssets.url, `${legacyPrefix}%`));
  const rows: AssetRow[] = args.limit > 0 ? await query.limit(args.limit) : await query;

  // Product images on the legacy host with no matching Media Library row can't be
  // placed by key — report them so they can be re-uploaded through the admin.
  // Compare against EVERY legacy media row (not just this --limit batch) and
  // count distinct URLs, since one asset can back several product images.
  const knownRows = await db
    .select({ url: mediaAssets.url })
    .from(mediaAssets)
    .where(like(mediaAssets.url, `${legacyPrefix}%`));
  const orphanRows = await db
    .select({ url: productImages.url })
    .from(productImages)
    .where(like(productImages.url, `${legacyPrefix}%`));
  const known = new Set(knownRows.map((r) => r.url));
  const orphans = new Set(orphanRows.map((r) => r.url).filter((u) => !known.has(u))).size;

  console.log(`media_assets on legacy host: ${rows.length}` + (orphans > 0 ? ` · product_images orphans (no media row): ${orphans}` : ""));

  const counts: Record<Outcome, number> = { migrated: 0, "already-present": 0, planned: 0, failed: 0 };
  let done = 0;
  const log = (msg: string): void => {
    done += 1;
    console.log(`[${done}/${rows.length}] ${msg}`);
  };

  for (let i = 0; i < rows.length; i += args.concurrency) {
    const chunk = rows.slice(i, i + args.concurrency);
    const results = await Promise.all(
      chunk.map((row) =>
        migrateOne(row, dest, args.apply, log).catch((err: unknown): Outcome => {
          log(`FAILED (${err instanceof Error ? err.message : String(err)})  ${row.key}`);
          return "failed";
        }),
      ),
    );
    for (const r of results) counts[r] += 1;
  }

  console.log(
    `\nSummary: migrated ${counts.migrated} · already-present ${counts["already-present"]} · planned ${counts.planned} · failed ${counts.failed}` +
      (args.apply ? "" : "\n(dry run — re-run with --apply to write)") +
      "\nLegacy objects were NOT deleted.",
  );
  process.exit(counts.failed > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
