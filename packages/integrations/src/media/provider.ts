/**
 * MediaProvider — storage abstraction for the admin Media Library, mirroring the
 * SmsProvider/ShippingProvider pattern. The data layer generates a stable `key`
 * (e.g. `media/<uuid>.jpg`), the provider stores the bytes and returns a public
 * URL. S3 (or S3-compatible) in production; a local-disk provider for dev until
 * bucket credentials are configured.
 */
export interface MediaUploadInput {
  /** Storage key/path, caller-generated so the DB row and object share it. */
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface MediaProvider {
  readonly kind: "local" | "s3";
  /** Store the bytes at `key`; returns the public URL to persist. */
  upload(input: MediaUploadInput): Promise<{ url: string }>;
  /** Best-effort delete by key. */
  remove(key: string): Promise<void>;
  /** Deterministic public URL for a key (no I/O). */
  publicUrl(key: string): string;
}
