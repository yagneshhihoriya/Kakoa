import { describe, expect, it } from "vitest";
import {
  LocalMediaProvider,
  S3MediaProvider,
  resolveMediaProvider,
} from "@kakoa/integrations";

/**
 * Media provider selection + public-URL derivation. Pure: `resolveMediaProvider`
 * takes an explicit env object (no process.env stubbing) and `S3MediaProvider`
 * performs no I/O until `upload`/`remove` are called.
 */

const creds = {
  S3_BUCKET: "kakoa-media",
  S3_ACCESS_KEY_ID: "test-access-key",
  S3_SECRET_ACCESS_KEY: "test-secret",
};

describe("S3MediaProvider.publicUrl", () => {
  it("AWS S3 (no endpoint) → virtual-hosted bucket URL", () => {
    const p = new S3MediaProvider({
      bucket: "kakoa-media",
      region: "ap-south-1",
      accessKeyId: "k",
      secretAccessKey: "s",
    });
    expect(p.publicUrl("media/a.jpg")).toBe(
      "https://kakoa-media.s3.ap-south-1.amazonaws.com/media/a.jpg",
    );
  });

  it("publicBaseUrl wins over the endpoint and a trailing slash is trimmed (R2 public bucket / custom domain)", () => {
    const p = new S3MediaProvider({
      bucket: "kakoa-media",
      region: "auto",
      accessKeyId: "k",
      secretAccessKey: "s",
      endpoint: "https://0123456789abcdef.r2.cloudflarestorage.com",
      publicBaseUrl: "https://pub-0123456789abcdef.r2.dev/",
    });
    expect(p.publicUrl("media/a.jpg")).toBe("https://pub-0123456789abcdef.r2.dev/media/a.jpg");
  });

  it("endpoint without publicBaseUrl falls back to path-style on the API endpoint (never public on R2)", () => {
    const p = new S3MediaProvider({
      bucket: "kakoa-media",
      region: "auto",
      accessKeyId: "k",
      secretAccessKey: "s",
      endpoint: "https://0123456789abcdef.r2.cloudflarestorage.com",
    });
    expect(p.publicUrl("media/a.jpg")).toBe(
      "https://0123456789abcdef.r2.cloudflarestorage.com/kakoa-media/media/a.jpg",
    );
  });
});

describe("resolveMediaProvider", () => {
  it("no S3 config → LocalMediaProvider (dev fallback)", () => {
    expect(resolveMediaProvider({})).toBeInstanceOf(LocalMediaProvider);
  });

  it("partial S3 config (missing region) → LocalMediaProvider, never a half-configured S3 client", () => {
    expect(resolveMediaProvider(creds)).toBeInstanceOf(LocalMediaProvider);
  });

  it("AWS S3 config → S3MediaProvider with the AWS bucket URL", () => {
    const p = resolveMediaProvider({ ...creds, S3_REGION: "ap-south-1" });
    expect(p).toBeInstanceOf(S3MediaProvider);
    expect(p.publicUrl("media/a.jpg")).toBe(
      "https://kakoa-media.s3.ap-south-1.amazonaws.com/media/a.jpg",
    );
  });

  it("R2: S3_ENDPOINT set WITHOUT S3_PUBLIC_BASE_URL → fails fast with a config error", () => {
    expect(() =>
      resolveMediaProvider({
        ...creds,
        S3_REGION: "auto",
        S3_ENDPOINT: "https://0123456789abcdef.r2.cloudflarestorage.com",
      }),
    ).toThrow(/S3_PUBLIC_BASE_URL is required when S3_ENDPOINT is set/);
  });

  it("R2: endpoint + public base URL → S3MediaProvider whose URLs are the public bucket URL", () => {
    const p = resolveMediaProvider({
      ...creds,
      S3_REGION: "auto",
      S3_ENDPOINT: "https://0123456789abcdef.r2.cloudflarestorage.com",
      S3_PUBLIC_BASE_URL: "https://pub-0123456789abcdef.r2.dev",
    });
    expect(p).toBeInstanceOf(S3MediaProvider);
    expect(p.kind).toBe("s3");
    expect(p.publicUrl("media/a.jpg")).toBe("https://pub-0123456789abcdef.r2.dev/media/a.jpg");
  });
});
