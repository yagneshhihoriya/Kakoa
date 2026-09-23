import { parseServerEnv } from "@kakoa/config";
import type { MediaProvider } from "./provider";
import { LocalMediaProvider } from "./local";
import { S3MediaProvider } from "./s3";

/** The subset of server env the media provider selection depends on. */
export interface MediaEnv {
  S3_BUCKET?: string | undefined;
  S3_REGION?: string | undefined;
  S3_ACCESS_KEY_ID?: string | undefined;
  S3_SECRET_ACCESS_KEY?: string | undefined;
  /** Custom S3-API endpoint (Cloudflare R2, MinIO). Omit for AWS S3. */
  S3_ENDPOINT?: string | undefined;
  /** Public base URL for objects (CDN / custom domain / R2 public bucket URL). */
  S3_PUBLIC_BASE_URL?: string | undefined;
}

/**
 * Pure selection: S3-compatible storage only when a bucket + region + credentials
 * are all present, otherwise the LocalMediaProvider (local dev → public/uploads).
 * In production without S3 config there is no durable storage — that is a
 * deploy-config error, not a silent fallback (same philosophy as the SMS provider).
 *
 * R2 guard: an S3-API endpoint is NEVER publicly readable (Cloudflare R2's
 * `<account>.r2.cloudflarestorage.com` requires signed requests), so when
 * `S3_ENDPOINT` is set the public base URL is mandatory. Failing fast here
 * beats the alternative — uploads that "succeed" while persisting URLs that
 * 403 for every shopper.
 */
export function resolveMediaProvider(env: MediaEnv): MediaProvider {
  const hasS3 =
    env.S3_BUCKET !== undefined &&
    env.S3_REGION !== undefined &&
    env.S3_ACCESS_KEY_ID !== undefined &&
    env.S3_SECRET_ACCESS_KEY !== undefined;
  if (!hasS3) return new LocalMediaProvider();

  if (env.S3_ENDPOINT !== undefined && env.S3_PUBLIC_BASE_URL === undefined) {
    throw new Error(
      "Media storage misconfigured: S3_PUBLIC_BASE_URL is required when S3_ENDPOINT is set. " +
        "An S3-compatible API endpoint (e.g. Cloudflare R2) is not publicly readable — set " +
        "S3_PUBLIC_BASE_URL to the bucket's public URL (R2: https://pub-<hash>.r2.dev or a " +
        "connected custom domain). See docs/MEDIA-STORAGE-R2.md.",
    );
  }

  return new S3MediaProvider({
    bucket: env.S3_BUCKET!,
    region: env.S3_REGION!,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    endpoint: env.S3_ENDPOINT,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL,
  });
}

let memo: MediaProvider | null = null;

/** Resolve (and memoize) the active media storage provider from the server env. */
export function getMediaProvider(): MediaProvider {
  if (memo !== null) return memo;
  memo = resolveMediaProvider(parseServerEnv());
  return memo;
}

/** Test-only: reset the memoized provider so env changes take effect. */
export function resetMediaProvider(): void {
  memo = null;
}
