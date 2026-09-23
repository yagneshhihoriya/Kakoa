import type { NextConfig } from "next";

/** Host of an optional CDN in front of the media bucket (S3_PUBLIC_BASE_URL). */
function cdnHost(): string | null {
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base == null || base === "") return null;
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
}

/**
 * The EXACT S3 bucket host (bucket.s3.region.amazonaws.com), derived from env.
 * Scoping to this one host (not `**.amazonaws.com`) prevents `/_next/image`
 * from being abused as an open fetch/resize proxy for arbitrary S3 objects.
 */
function s3BucketHost(): string | null {
  // Only meaningful for AWS S3 proper. S3-compatible stores (Cloudflare R2,
  // MinIO) set S3_ENDPOINT and are served from S3_PUBLIC_BASE_URL (cdnHost).
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint != null && endpoint !== "") return null;
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (bucket == null || bucket === "" || region == null || region === "") return null;
  return `${bucket}.s3.${region}.amazonaws.com`;
}

/**
 * Hosts of PREVIOUS media storage (e.g. the old AWS bucket after moving to R2),
 * comma-separated in S3_LEGACY_PUBLIC_HOSTS. Existing media_assets /
 * product_images rows still point at them, so they must remain allowed for
 * `/_next/image`. Exact hostnames only — no wildcards — so the image proxy can't
 * become an open fetch/resize proxy.
 */
function legacyMediaHosts(): string[] {
  const raw = process.env.S3_LEGACY_PUBLIC_HOSTS;
  if (raw == null || raw === "") return [];
  return raw
    .split(",")
    // Lowercase: URL hostnames are case-insensitive and next/image matches the
    // (already lowercased) URL host against the pattern verbatim.
    .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter((h) => /^[a-z0-9.-]+$/.test(h));
}

const imageHosts = Array.from(
  new Set(
    [cdnHost(), s3BucketHost(), ...legacyMediaHosts()].filter(
      (h): h is string => h !== null,
    ),
  ),
);

const nextConfig: NextConfig = {
  typedRoutes: true,
  output: "standalone",
  images: {
    // Only the configured bucket/CDN host + the seed placeholder host. Local dev
    // uploads (/uploads/*) are same-origin and need no entry.
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      ...imageHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
    ],
  },
  transpilePackages: [
    "@kakoa/core",
    "@kakoa/db",
    "@kakoa/ui",
    "@kakoa/config",
    "@platform/kernel",
  ],
};

export default nextConfig;
