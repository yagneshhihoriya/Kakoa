import type { MetadataRoute } from "next";
import { routeEnabled } from "@/lib/brand";
import { getPublishedProductSlugs } from "@/lib/catalog/queries";
import { getJournalArticles } from "@/lib/journal";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * XML sitemap — the indexable static routes (feature-gated ones only when the
 * brand enables them), every Journal article, plus every published PDP (same
 * visibility predicate as the storefront grid: active product with ≥ 1 active
 * variant). Absolute URLs off `NEXT_PUBLIC_SITE_URL`.
 *
 * Transactional / auth surfaces (cart, checkout, account, order) are
 * deliberately absent — they are `disallow`ed in robots.ts too.
 */

/** `now` captured once so every static route shares one lastModified. */
const NOW = new Date();

interface StaticRoute {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}

/** `/journal` and `/locator` appear only when `brand.profile.features` turns them on. */
const STATIC_ROUTES: StaticRoute[] = (
  [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/shop", changeFrequency: "daily", priority: 0.9 },
    { path: "/about", changeFrequency: "monthly", priority: 0.5 },
    { path: "/journal", changeFrequency: "weekly", priority: 0.6 },
    { path: "/support", changeFrequency: "monthly", priority: 0.5 },
    { path: "/locator", changeFrequency: "monthly", priority: 0.4 },
    { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/legal/terms", changeFrequency: "yearly", priority: 0.3 },
    { path: "/legal/shipping", changeFrequency: "yearly", priority: 0.3 },
    { path: "/legal/refund", changeFrequency: "yearly", priority: 0.3 },
  ] satisfies StaticRoute[]
).filter((route) => routeEnabled(route.path));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Degrade to static routes only if the DB is unreachable — never 500 a crawl.
  const productSlugs = await getPublishedProductSlugs().catch(() => []);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: NOW,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const journalEntries: MetadataRoute.Sitemap = routeEnabled("/journal")
    ? getJournalArticles().map((article) => ({
        url: absoluteUrl(`/journal/${article.slug}`),
        lastModified: new Date(article.dateIso),
        changeFrequency: "monthly",
        priority: 0.5,
      }))
    : [];

  const productEntries: MetadataRoute.Sitemap = productSlugs.map((product) => ({
    url: absoluteUrl(`/product/${product.slug}`),
    lastModified: product.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...journalEntries, ...productEntries];
}
