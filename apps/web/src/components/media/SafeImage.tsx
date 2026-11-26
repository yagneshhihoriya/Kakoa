import type { ReactNode } from "react";
import Image, { type ImageProps } from "next/image";
import { checkImageSrc, warnUnlistedImageSrc } from "@/lib/images";

export type SafeImageProps = Omit<ImageProps, "src" | "unoptimized"> & {
  /** Absolute URL or root-relative path as stored in the database. */
  src: string;
};

/**
 * `next/image` for URLs that come out of the database rather than the
 * codebase — product_images.url, media_assets.url, categories.image_url, the
 * hero settings. Same props as `next/image` minus `unoptimized`, which this
 * component owns.
 *
 * A URL on a host `next.config.ts` did not register makes `next/image` throw
 * while rendering in development and 400 from `/_next/image` in production —
 * one stray row (an image uploaded to another bucket, a legacy host missing
 * from S3_LEGACY_PUBLIC_HOSTS) blanks the whole page. Here the src is checked
 * first against the list the config published (NEXT_PUBLIC_IMAGE_HOSTS): a
 * listed host renders the normal optimised image; anything else degrades to
 * the same element with `unoptimized`, i.e. a plain <img> the browser loads
 * straight from that host, and logs one server-side warning per host naming
 * the env var to fix. The shopper still sees the photo in the same frame;
 * only resizing and format negotiation are lost until the host is registered.
 *
 * The allowlist itself is untouched — `/_next/image` still proxies only the
 * exact hosts the config names.
 */
export function SafeImage({ src, ...rest }: SafeImageProps): ReactNode {
  const verdict = checkImageSrc(src);
  if (verdict.allowed) return <Image src={src} {...rest} />;
  warnUnlistedImageSrc(src, verdict);
  return <Image src={src} {...rest} unoptimized />;
}
