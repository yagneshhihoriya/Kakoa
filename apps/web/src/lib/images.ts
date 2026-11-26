/**
 * Which image URLs `next/image` will accept — mirrored from `next.config.ts`.
 *
 * `next/image` optimises a remote URL only when its host is registered under
 * `images.remotePatterns`; any other absolute URL throws while rendering in
 * development ("hostname … is not configured under images") and comes back
 * 400 from `/_next/image` in production. Storefront imagery is stored as
 * absolute URLs (product_images.url, media_assets.url, categories.image_url,
 * the hero settings), so one row pointing at a host the current build did not
 * register — a second bucket, a renamed CDN, a legacy host missing from
 * S3_LEGACY_PUBLIC_HOSTS — must degrade, not take the page down.
 *
 * `next.config.ts` publishes the exact list it registered as
 * NEXT_PUBLIC_IMAGE_HOSTS (comma-separated, inlined at build time into the
 * server and client bundles, so client components see the same list). This
 * module parses it and answers "would next/image accept this src?" ahead of
 * rendering. It never widens the allowlist: an unlisted host stays unlisted,
 * and the caller (`SafeImage`) serves it unoptimised instead of through
 * `/_next/image`.
 */

/** Same shape test `next.config.ts` applies to S3_LEGACY_PUBLIC_HOSTS entries. */
const HOSTNAME_RE = /^[a-z0-9.-]+$/;

/**
 * One host entry as the config normalises it: trimmed, lowercased, a pasted
 * scheme or path stripped. `null` when what is left is not a bare hostname.
 */
export function normaliseImageHost(entry: string): string | null {
  const host = entry
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  return HOSTNAME_RE.test(host) ? host : null;
}

/** Parse a comma-separated host list into unique, lowercase hostnames. */
export function parseImageHosts(raw: string | null | undefined): readonly string[] {
  if (raw == null || raw === "") return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map(normaliseImageHost)
        .filter((h): h is string => h !== null),
    ),
  );
}

let cached: { raw: string | undefined; hosts: readonly string[] } | null = null;

/**
 * The hosts this build registered for `/_next/image`. Empty when
 * NEXT_PUBLIC_IMAGE_HOSTS is unset (unit tests, a runtime that is not Next) —
 * every remote URL then degrades to unoptimised rather than throwing.
 */
export function allowedImageHosts(): readonly string[] {
  // Written out in full: Next inlines `process.env.NEXT_PUBLIC_*` only as a
  // literal member access, which is what makes this work in client bundles.
  const raw = process.env.NEXT_PUBLIC_IMAGE_HOSTS;
  if (cached === null || cached.raw !== raw) {
    cached = { raw, hosts: parseImageHosts(raw) };
  }
  return cached.hosts;
}

export type ImageSrcVerdict =
  | { allowed: true }
  | {
      allowed: false;
      /**
       * `host` — absolute URL on a host outside the allowlist;
       * `protocol` — listed host, but not https (every pattern is https-only);
       * `protocol-relative` — `//host/path`, which next/image refuses outright;
       * `unparseable` — neither a root-relative path nor an absolute URL.
       */
      reason: "host" | "protocol" | "protocol-relative" | "unparseable";
      host: string | null;
    };

/**
 * Would `next/image` accept `src` under this build's allowlist? Mirrors what
 * its loader checks: root-relative paths are same-origin and always fine;
 * `data:`/`blob:` URLs are served as-is by next/image itself; an absolute URL
 * needs https and an exact (case-insensitive) hostname match — any path, query
 * or port, as the registered patterns constrain none of those.
 */
export function checkImageSrc(
  src: string,
  hosts: readonly string[] = allowedImageHosts(),
): ImageSrcVerdict {
  if (src.startsWith("//")) {
    return { allowed: false, reason: "protocol-relative", host: null };
  }
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) {
    return { allowed: true };
  }
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return { allowed: false, reason: "unparseable", host: null };
  }
  const host = url.hostname.toLowerCase();
  if (!hosts.includes(host)) return { allowed: false, reason: "host", host };
  if (url.protocol !== "https:") return { allowed: false, reason: "protocol", host };
  return { allowed: true };
}

/** `true` when `next/image` can optimise `src` — see `checkImageSrc`. */
export function isAllowedImageSrc(src: string, hosts?: readonly string[]): boolean {
  return checkImageSrc(src, hosts).allowed;
}

/**
 * Hosts (or parse failures) this server process has already reported. Kept on
 * `globalThis` rather than in module state: Next evaluates this module once
 * per bundle layer (server components, client-component SSR), and a per-module
 * set would log the same host once per layer.
 */
const WARNED = Symbol.for("images.unlisted_host.warned");
function warnedHosts(): Set<string> {
  const g = globalThis as unknown as Record<symbol, Set<string> | undefined>;
  return (g[WARNED] ??= new Set<string>());
}

/**
 * Server-side, once per host: a database URL is being served unoptimised
 * because `next/image` would reject it, and what to change. Browser renders
 * stay silent — the server log is where an operator looks, and SSR has
 * already reported the same URL there.
 */
export function warnUnlistedImageSrc(
  src: string,
  verdict: Exclude<ImageSrcVerdict, { allowed: true }>,
): void {
  if (typeof window !== "undefined") return;
  const key = `${verdict.reason}:${verdict.host ?? ""}`;
  const warned = warnedHosts();
  if (warned.has(key)) return;
  warned.add(key);
  const hint =
    verdict.reason === "host" || verdict.reason === "protocol"
      ? "Served as a plain <img>, not through /_next/image. To optimise it, add the host to " +
        "S3_LEGACY_PUBLIC_HOSTS (or point S3_PUBLIC_BASE_URL at it) and rebuild."
      : "Served as a plain <img>; the stored URL is malformed — fix the row.";
  console.warn("images.unlisted_host", {
    host: verdict.host,
    reason: verdict.reason,
    example: src,
    allowed: allowedImageHosts(),
    hint,
  });
}
