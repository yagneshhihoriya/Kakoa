import type { MetadataRoute } from "next";
import { absoluteUrl, isProductionEnv } from "@/lib/seo/site";

/**
 * robots.txt — allow full crawl in production; block everything on
 * preview/staging (APP_ENV !== 'production') so non-prod hosts never index.
 * The root layout also sets `robots: noindex` off the same predicate as a
 * belt-and-braces X-Robots-Tag equivalent.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProductionEnv()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private / transactional surfaces stay out of the index.
        disallow: ["/api/", "/account", "/checkout", "/cart", "/order"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
