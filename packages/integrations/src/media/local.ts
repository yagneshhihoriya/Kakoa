/**
 * LocalMediaProvider — dev fallback used until S3 credentials are configured.
 * Writes under `apps/web/public/uploads` (Next serves it at `/uploads/...`).
 * Not for production/serverless (ephemeral FS) — production uses S3.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MediaProvider, MediaUploadInput } from "./provider";

const PUBLIC_PREFIX = "/uploads";

export class LocalMediaProvider implements MediaProvider {
  readonly kind = "local" as const;
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    // Next dev runs with cwd = apps/web, so this resolves to apps/web/public/uploads.
    this.baseDir = baseDir ?? path.join(process.cwd(), "public", "uploads");
  }

  publicUrl(key: string): string {
    return `${PUBLIC_PREFIX}/${key}`;
  }

  async upload(input: MediaUploadInput): Promise<{ url: string }> {
    const dest = path.join(this.baseDir, input.key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, input.body);
    return { url: this.publicUrl(input.key) };
  }

  async remove(key: string): Promise<void> {
    await rm(path.join(this.baseDir, key), { force: true });
  }
}
