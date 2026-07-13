/**
 * Pure media upload validation — NO db/provider imports, unit-testable. Sniffs
 * the real image type from magic bytes (never trusts the client-declared MIME),
 * enforces a size cap + a MIME allowlist, and sanitizes filenames. Used by the
 * upload route before anything touches storage or the DB.
 */

export const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8 MB

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;
export type ImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export interface SniffResult {
  mime: ImageMime;
  ext: string;
}

/** Detect an image type from leading bytes, or null if unrecognized. */
export function sniffImageType(b: Uint8Array): SniffResult | null {
  if (b.length < 12) return null;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  // GIF: "GIF8"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
    return { mime: "image/gif", ext: "gif" };
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  // AVIF: ISO-BMFF "ftyp" box with avif/avis brand
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!);
    if (brand === "avif" || brand === "avis") {
      return { mime: "image/avif", ext: "avif" };
    }
  }
  return null;
}

/** Reduce an uploaded filename to a safe basename (for display/download). */
export function sanitizeFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "file";
}

export type ValidateUploadResult =
  | { ok: true; mime: ImageMime; ext: string }
  | { ok: false; message: string };

/** Validate raw bytes: size bounds + a real (sniffed) allowed image type. */
export function validateUpload(bytes: Uint8Array): ValidateUploadResult {
  if (bytes.length === 0) return { ok: false, message: "The file is empty." };
  if (bytes.length > MAX_MEDIA_BYTES) {
    return { ok: false, message: `File too large — max ${MAX_MEDIA_BYTES / (1024 * 1024)} MB.` };
  }
  const sniff = sniffImageType(bytes);
  if (sniff === null) {
    return { ok: false, message: "Unsupported or corrupt image. Use JPG, PNG, WebP, GIF, or AVIF." };
  }
  return { ok: true, mime: sniff.mime, ext: sniff.ext };
}

/** Build a content-addressed-ish storage key from a random id + validated ext. */
export function mediaKey(id: string, ext: string): string {
  return `media/${id}.${ext}`;
}
