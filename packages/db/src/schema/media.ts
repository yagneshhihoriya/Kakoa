/**
 * Media Library assets (docs/admin-platform/02-CORE-MODULES.md §5). Each row is
 * one uploaded image stored behind the `MediaProvider` (S3 in prod, local disk
 * in dev). `key` is the storage path; `url` is the resolved public URL. Assets
 * are referenced by product_images (by url) and, later, by content blocks.
 */
import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamptz } from "./helpers";
import { adminUsers } from "./admin";

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    /** Storage key/path shared with the object in the bucket. */
    key: text("key").notNull().unique(),
    /** Resolved public URL (CDN/bucket or /uploads in dev). */
    url: text("url").notNull(),
    /** Original (sanitized) filename, for display + download. */
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    folder: text("folder").notNull().default("general"),
    uploadedBy: uuid("uploaded_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("media_assets_created_idx").on(t.createdAt)],
);
