import { parseServerEnv } from "@kakoa/config";
import type { MediaProvider } from "./provider";
import { LocalMediaProvider } from "./local";
import { S3MediaProvider } from "./s3";

/**
 * Resolve the active media storage provider. S3 is selected only when a bucket
 * + region + AWS credentials are all present; otherwise the LocalMediaProvider
 * handles local dev (writes to apps/web/public/uploads). In production without
 * S3 config there is no durable storage — that is a deploy-config error, not a
 * silent fallback (same philosophy as the SMS provider).
 */
let memo: MediaProvider | null = null;

export function getMediaProvider(): MediaProvider {
  if (memo !== null) return memo;

  const env = parseServerEnv();
  const hasS3 =
    env.S3_BUCKET !== undefined &&
    env.S3_REGION !== undefined &&
    env.S3_ACCESS_KEY_ID !== undefined &&
    env.S3_SECRET_ACCESS_KEY !== undefined;

  memo = hasS3
    ? new S3MediaProvider({
        bucket: env.S3_BUCKET!,
        region: env.S3_REGION!,
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
        endpoint: env.S3_ENDPOINT,
        publicBaseUrl: env.S3_PUBLIC_BASE_URL,
      })
    : new LocalMediaProvider();
  return memo;
}

/** Test-only: reset the memoized provider so env changes take effect. */
export function resetMediaProvider(): void {
  memo = null;
}
