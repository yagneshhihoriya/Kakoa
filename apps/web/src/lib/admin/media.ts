/**
 * Admin Media Library data layer (docs/admin-platform §5). Uploads flow through
 * the `MediaProvider` (S3 in prod, local disk in dev); every asset is a
 * `media_assets` row. Validation (magic-byte sniff, size, MIME allowlist) lives
 * in the pure `media-validation` module. Mutations are audited.
 *
 * SERVER-ONLY: uses @kakoa/db + @kakoa/integrations.
 */
import { adminAuditLog, db, mediaAssets } from "@kakoa/db";
import { desc, eq, sql, type SQL } from "drizzle-orm";
import { getMediaProvider } from "@kakoa/integrations";
import {
  mediaKey,
  sanitizeFilename,
  validateUpload,
} from "./media-validation";

export const MEDIA_PAGE_SIZE = 24;

export interface MediaAssetRow {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  alt: string;
  createdAt: string;
}

export interface MediaList {
  rows: MediaAssetRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function likeParam(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listMedia(input: {
  search?: string;
  page?: number;
}): Promise<MediaList> {
  const page = Math.min(1_000_000, Math.max(1, Math.floor(Number(input.page ?? 1)) || 1));
  const pageSize = MEDIA_PAGE_SIZE;

  const conds: SQL[] = [];
  const search = input.search?.trim();
  if (search) conds.push(sql`${mediaAssets.filename} ilike ${likeParam(search)}`);
  const where = conds.length > 0 ? conds[0] : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(mediaAssets)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      id: mediaAssets.id,
      url: mediaAssets.url,
      filename: mediaAssets.filename,
      mimeType: mediaAssets.mimeType,
      sizeBytes: mediaAssets.sizeBytes,
      alt: mediaAssets.alt,
      createdAt: mediaAssets.createdAt,
    })
    .from(mediaAssets)
    .where(where)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      url: r.url,
      filename: r.filename,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      alt: r.alt,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type UploadResult =
  | { ok: true; asset: MediaAssetRow }
  | { ok: false; code: "VALIDATION_ERROR"; message: string };

/**
 * Validate raw bytes, store via the provider, and record the asset. The stored
 * MIME/extension come from the SNIFFED type, never the client's declared type.
 */
export async function uploadMedia(input: {
  bytes: Uint8Array;
  filename: string;
  adminUserId: string;
}): Promise<UploadResult> {
  const check = validateUpload(input.bytes);
  if (!check.ok) return { ok: false, code: "VALIDATION_ERROR", message: check.message };

  const id = crypto.randomUUID();
  const key = mediaKey(id, check.ext);
  const provider = getMediaProvider();
  const { url } = await provider.upload({
    key,
    body: input.bytes,
    contentType: check.mime,
  });

  const filename = sanitizeFilename(input.filename);
  const [row] = await db
    .insert(mediaAssets)
    .values({
      id,
      key,
      url,
      filename,
      mimeType: check.mime,
      sizeBytes: input.bytes.length,
      uploadedBy: input.adminUserId,
    })
    .returning({
      id: mediaAssets.id,
      url: mediaAssets.url,
      filename: mediaAssets.filename,
      mimeType: mediaAssets.mimeType,
      sizeBytes: mediaAssets.sizeBytes,
      alt: mediaAssets.alt,
      createdAt: mediaAssets.createdAt,
    });
  if (!row) return { ok: false, code: "VALIDATION_ERROR", message: "Could not save the upload." };

  await db.insert(adminAuditLog).values({
    adminUserId: input.adminUserId,
    action: "media.upload",
    entityType: "media",
    entityId: row.id,
    before: null,
    after: { key, filename, mimeType: check.mime, sizeBytes: input.bytes.length },
  });

  return {
    ok: true,
    asset: {
      id: row.id,
      url: row.url,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      alt: row.alt,
      createdAt: new Date(row.createdAt).toISOString(),
    },
  };
}

export type MediaMutationResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "VALIDATION_ERROR"; message: string };

/** Delete an asset from storage (best-effort) + the DB row. Audited. */
export async function deleteMedia(
  id: string,
  adminUserId: string,
): Promise<MediaMutationResult> {
  const [row] = await db
    .select({ id: mediaAssets.id, key: mediaAssets.key, filename: mediaAssets.filename })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);
  if (!row) return { ok: false, code: "NOT_FOUND", message: "We couldn't find that file." };

  // Remove the object first (best-effort — a storage failure shouldn't strand
  // the row; but a successful DB delete with an orphaned object is worse, so we
  // try storage first and only delete the row if it succeeds).
  try {
    await getMediaProvider().remove(row.key);
  } catch {
    return { ok: false, code: "VALIDATION_ERROR", message: "Could not remove the file from storage — try again." };
  }

  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  await db.insert(adminAuditLog).values({
    adminUserId,
    action: "media.delete",
    entityType: "media",
    entityId: id,
    before: { key: row.key, filename: row.filename },
    after: null,
  });
  return { ok: true };
}

/** Update an asset's alt text (accessibility / SEO). Audited. */
export async function updateMediaAlt(
  id: string,
  alt: string,
  adminUserId: string,
): Promise<MediaMutationResult> {
  const clean = alt.slice(0, 300);
  const [row] = await db
    .update(mediaAssets)
    .set({ alt: clean })
    .where(eq(mediaAssets.id, id))
    .returning({ id: mediaAssets.id });
  if (!row) return { ok: false, code: "NOT_FOUND", message: "We couldn't find that file." };
  await db.insert(adminAuditLog).values({
    adminUserId,
    action: "media.update",
    entityType: "media",
    entityId: id,
    before: null,
    after: { alt: clean },
  });
  return { ok: true };
}
