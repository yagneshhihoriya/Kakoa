/**
 * S3MediaProvider — production storage on Amazon S3 (or any S3-compatible store
 * via `endpoint`, e.g. Cloudflare R2 / MinIO). Objects are written with a long
 * immutable cache header (keys are content-unique). Public URL is the CDN base
 * when configured, else the standard bucket URL.
 */
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { MediaProvider, MediaUploadInput } from "./provider";

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** S3-compatible endpoint (R2/MinIO). Omit for AWS S3. */
  endpoint?: string | undefined;
  /** CDN / custom domain in front of the bucket. */
  publicBaseUrl?: string | undefined;
}

export class S3MediaProvider implements MediaProvider {
  readonly kind = "s3" as const;
  private readonly client: S3Client;
  private readonly cfg: S3Config;

  constructor(cfg: S3Config) {
    this.cfg = cfg;
    this.client = new S3Client({
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      ...(cfg.endpoint ? { endpoint: cfg.endpoint, forcePathStyle: true } : {}),
    });
  }

  publicUrl(key: string): string {
    if (this.cfg.publicBaseUrl) {
      return `${this.cfg.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    }
    if (this.cfg.endpoint) {
      return `${this.cfg.endpoint.replace(/\/$/, "")}/${this.cfg.bucket}/${key}`;
    }
    return `https://${this.cfg.bucket}.s3.${this.cfg.region}.amazonaws.com/${key}`;
  }

  async upload(input: MediaUploadInput): Promise<{ url: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { url: this.publicUrl(input.key) };
  }

  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
    );
  }
}
