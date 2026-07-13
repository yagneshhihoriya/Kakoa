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
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (bucket == null || bucket === "" || region == null || region === "") return null;
  return `${bucket}.s3.${region}.amazonaws.com`;
}

const imageHosts = [cdnHost(), s3BucketHost()].filter(
  (h): h is string => h !== null,
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
