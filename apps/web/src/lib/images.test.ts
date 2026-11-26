import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allowedImageHosts,
  checkImageSrc,
  isAllowedImageSrc,
  normaliseImageHost,
  parseImageHosts,
  warnUnlistedImageSrc,
} from "./images";

/** A build that registered the current bucket's public host and one legacy host. */
const HOSTS: readonly string[] = [
  "pub-0123456789abcdef.r2.dev",
  "old-bucket.s3.ap-south-1.amazonaws.com",
];

describe("normaliseImageHost / parseImageHosts", () => {
  it("trims, lowercases and strips a pasted scheme or path, like next.config.ts", () => {
    expect(normaliseImageHost("  Media.Example.COM ")).toBe("media.example.com");
    expect(normaliseImageHost("https://media.example.com/some/path")).toBe("media.example.com");
    expect(normaliseImageHost("http://media.example.com/")).toBe("media.example.com");
  });

  it("rejects anything that is not a bare hostname", () => {
    expect(normaliseImageHost("")).toBeNull();
    expect(normaliseImageHost("   ")).toBeNull();
    expect(normaliseImageHost("media.example.com:8443")).toBeNull();
    expect(normaliseImageHost("*.example.com")).toBeNull();
    expect(normaliseImageHost("user@media.example.com")).toBeNull();
  });

  it("splits on commas, dedupes and drops invalid entries", () => {
    expect(parseImageHosts("placehold.co, Pub-abc.r2.dev ,placehold.co,,*.bad")).toEqual([
      "placehold.co",
      "pub-abc.r2.dev",
    ]);
  });

  it("is empty for an unset or blank value", () => {
    expect(parseImageHosts(undefined)).toEqual([]);
    expect(parseImageHosts(null)).toEqual([]);
    expect(parseImageHosts("")).toEqual([]);
  });
});

describe("checkImageSrc / isAllowedImageSrc", () => {
  it("accepts https URLs on a listed host with any path, query or port", () => {
    expect(isAllowedImageSrc("https://pub-0123456789abcdef.r2.dev/media/a.jpg", HOSTS)).toBe(true);
    expect(isAllowedImageSrc("https://old-bucket.s3.ap-south-1.amazonaws.com/x.png?v=2", HOSTS)).toBe(true);
    expect(isAllowedImageSrc("https://pub-0123456789abcdef.r2.dev:8443/a.jpg", HOSTS)).toBe(true);
  });

  it("matches hosts case-insensitively", () => {
    expect(isAllowedImageSrc("https://PUB-0123456789ABCDEF.R2.DEV/a.jpg", HOSTS)).toBe(true);
  });

  it("accepts root-relative paths (same-origin uploads) without consulting the list", () => {
    expect(checkImageSrc("/uploads/2026/11/a.jpg", [])).toEqual({ allowed: true });
    expect(checkImageSrc("/uploads/a.jpg?w=1", [])).toEqual({ allowed: true });
  });

  it("accepts data: and blob: URLs, which next/image serves as-is", () => {
    expect(checkImageSrc("data:image/png;base64,iVBORw0KGgo=", [])).toEqual({ allowed: true });
    expect(checkImageSrc("blob:https://shop.example.com/0f1e2d3c", [])).toEqual({ allowed: true });
  });

  it("rejects a host outside the list and names it", () => {
    expect(checkImageSrc("https://pub-fedcba9876543210.r2.dev/media/a.jpg", HOSTS)).toEqual({
      allowed: false,
      reason: "host",
      host: "pub-fedcba9876543210.r2.dev",
    });
  });

  it("never matches a subdomain, parent or suffix of a listed host (exact hosts only)", () => {
    expect(isAllowedImageSrc("https://cdn.pub-0123456789abcdef.r2.dev/a.jpg", HOSTS)).toBe(false);
    expect(isAllowedImageSrc("https://r2.dev/a.jpg", HOSTS)).toBe(false);
    expect(isAllowedImageSrc("https://evil-pub-0123456789abcdef.r2.dev/a.jpg", HOSTS)).toBe(false);
    expect(isAllowedImageSrc("https://pub-0123456789abcdef.r2.dev.evil.example/a.jpg", HOSTS)).toBe(false);
  });

  it("rejects http on a listed host — every registered pattern is https-only", () => {
    expect(checkImageSrc("http://pub-0123456789abcdef.r2.dev/a.jpg", HOSTS)).toEqual({
      allowed: false,
      reason: "protocol",
      host: "pub-0123456789abcdef.r2.dev",
    });
  });

  it("rejects protocol-relative and unparseable srcs", () => {
    expect(checkImageSrc("//pub-0123456789abcdef.r2.dev/a.jpg", HOSTS)).toEqual({
      allowed: false,
      reason: "protocol-relative",
      host: null,
    });
    expect(checkImageSrc("media/a.jpg", HOSTS)).toEqual({
      allowed: false,
      reason: "unparseable",
      host: null,
    });
    expect(checkImageSrc("", HOSTS)).toEqual({ allowed: false, reason: "unparseable", host: null });
  });

  it("rejects every remote URL when nothing is listed", () => {
    expect(isAllowedImageSrc("https://placehold.co/600x400", [])).toBe(false);
  });
});

describe("allowedImageHosts (NEXT_PUBLIC_IMAGE_HOSTS)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses the build-published list and is the default for checkImageSrc", () => {
    vi.stubEnv("NEXT_PUBLIC_IMAGE_HOSTS", "placehold.co, Pub-0123456789abcdef.r2.dev");
    expect(allowedImageHosts()).toEqual(["placehold.co", "pub-0123456789abcdef.r2.dev"]);
    expect(isAllowedImageSrc("https://pub-0123456789abcdef.r2.dev/a.jpg")).toBe(true);
    expect(isAllowedImageSrc("https://pub-fedcba9876543210.r2.dev/a.jpg")).toBe(false);
  });

  it("re-reads when the value changes and is empty when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_IMAGE_HOSTS", "media.example.com");
    expect(allowedImageHosts()).toEqual(["media.example.com"]);
    vi.stubEnv("NEXT_PUBLIC_IMAGE_HOSTS", "");
    expect(allowedImageHosts()).toEqual([]);
    expect(isAllowedImageSrc("https://media.example.com/a.jpg")).toBe(false);
  });
});

describe("warnUnlistedImageSrc", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a structured warning once per host, with the env fix", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = checkImageSrc("https://pub-aaaaaaaaaaaaaaaa.r2.dev/a.jpg", HOSTS);
    expect(first.allowed).toBe(false);
    if (first.allowed) return;
    warnUnlistedImageSrc("https://pub-aaaaaaaaaaaaaaaa.r2.dev/a.jpg", first);
    warnUnlistedImageSrc("https://pub-aaaaaaaaaaaaaaaa.r2.dev/b.jpg", first);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe("images.unlisted_host");
    expect(warn.mock.calls[0]?.[1]).toMatchObject({
      host: "pub-aaaaaaaaaaaaaaaa.r2.dev",
      reason: "host",
      example: "https://pub-aaaaaaaaaaaaaaaa.r2.dev/a.jpg",
      hint: expect.stringContaining("S3_LEGACY_PUBLIC_HOSTS"),
    });
  });

  it("reports a second host separately and malformed URLs with a row-fix hint", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const other = checkImageSrc("https://pub-bbbbbbbbbbbbbbbb.r2.dev/a.jpg", HOSTS);
    const broken = checkImageSrc("//pub-bbbbbbbbbbbbbbbb.r2.dev/a.jpg", HOSTS);
    if (other.allowed || broken.allowed) throw new Error("expected both to be rejected");
    warnUnlistedImageSrc("https://pub-bbbbbbbbbbbbbbbb.r2.dev/a.jpg", other);
    warnUnlistedImageSrc("//pub-bbbbbbbbbbbbbbbb.r2.dev/a.jpg", broken);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1]?.[1]).toMatchObject({
      reason: "protocol-relative",
      hint: expect.stringContaining("malformed"),
    });
  });
});
