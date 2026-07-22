/**
 * SEO shared building blocks — Module: content-blog-seo.
 *
 * Single source of truth for the site origin, brand constants, and the
 * JSON-LD serializer used across metadata routes (robots/sitemap/manifest),
 * the root layout, the storefront layout, /shop, and the PDP.
 *
 * `NEXT_PUBLIC_SITE_URL` is a required boot env (packages/config); we still
 * degrade to VERCEL_URL / localhost so a metadata route can never throw at
 * request time and 500 a crawler.
 */

/** Brand palette used by manifest + generated icons (cocoa / cream). */
export const BRAND = {
  name: "KAKOA",
  shortName: "KAKOA",
  themeColor: "#2A1D12",
  backgroundColor: "#FBF6EF",
} as const;

/**
 * Absolute site origin without a trailing slash. Prefers the required
 * `NEXT_PUBLIC_SITE_URL`; falls back to Vercel's per-deploy host, then
 * localhost, so preview builds and local dev still resolve.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit != null && explicit !== "") return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel != null && vercel !== "") return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Join a root-relative path onto the site origin as an absolute URL. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** `true` only in the real production environment (APP_ENV === 'production'). */
export function isProductionEnv(): boolean {
  return process.env.APP_ENV === "production";
}

/**
 * Serialize a JSON-LD object for `dangerouslySetInnerHTML`, unicode-escaping
 * every `<` so a `</script>` in catalog copy can never break out of the tag
 * (content-blog-seo.md §6).
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
