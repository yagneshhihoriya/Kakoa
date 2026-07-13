import { describe, expect, it } from "vitest";
import {
  MAX_MEDIA_BYTES,
  mediaKey,
  sanitizeFilename,
  sniffImageType,
  validateUpload,
} from "./media-validation";

/** Build a byte array from a prefix, padded to `len` so length checks pass. */
function bytes(prefix: number[], len = 16): Uint8Array {
  const a = new Uint8Array(len);
  prefix.forEach((v, i) => (a[i] = v));
  return a;
}

const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0]);
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const AVIF = bytes([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);

describe("sniffImageType", () => {
  it("detects jpeg/png/gif/webp/avif by magic bytes", () => {
    expect(sniffImageType(JPEG)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(sniffImageType(PNG)).toEqual({ mime: "image/png", ext: "png" });
    expect(sniffImageType(GIF)).toEqual({ mime: "image/gif", ext: "gif" });
    expect(sniffImageType(WEBP)).toEqual({ mime: "image/webp", ext: "webp" });
    expect(sniffImageType(AVIF)).toEqual({ mime: "image/avif", ext: "avif" });
  });

  it("rejects too-short and non-image content", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(bytes([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // %PDF
    expect(sniffImageType(bytes([0x3c, 0x73, 0x76, 0x67]))).toBeNull(); // <svg (blocked)
  });
});

describe("validateUpload", () => {
  it("accepts a real image and returns its sniffed type (ignores declared MIME)", () => {
    expect(validateUpload(PNG)).toEqual({ ok: true, mime: "image/png", ext: "png" });
  });

  it("rejects empty, oversized, and unrecognized content", () => {
    expect(validateUpload(new Uint8Array(0)).ok).toBe(false);
    const tooBig = new Uint8Array(MAX_MEDIA_BYTES + 1);
    tooBig.set(JPEG);
    expect(validateUpload(tooBig).ok).toBe(false);
    expect(validateUpload(bytes([1, 2, 3, 4])).ok).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  it("strips paths and unsafe chars, caps length", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("my photo (1).JPG")).toBe("my_photo__1_.JPG");
    expect(sanitizeFilename("")).toBe("file");
  });
});

describe("mediaKey", () => {
  it("namespaces under media/ with the validated extension", () => {
    expect(mediaKey("abc-123", "jpg")).toBe("media/abc-123.jpg");
  });
});
