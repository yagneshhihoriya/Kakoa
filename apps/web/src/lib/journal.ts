/**
 * Journal helpers — brand-neutral ordering, lookup and date formatting over the
 * active pack's `brand.journal` (apps/web/src/brands/<key>/journal.ts). Pure:
 * no DB, no network, no `Date.now()`.
 */
import { brand } from "@/lib/brand";
import type { Article } from "@/brands/contract";

export type { Article, ArticleBlock } from "@/brands/contract";

/** The Journal section exists only when the pack enables it AND has articles. */
export function journalEnabled(): boolean {
  return brand.profile.features.journal && brand.journal.length > 0;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * Format a fixed ISO date (YYYY-MM-DD) as "14 May 2026" — matching the legal
 * pages' date style. Pure and deterministic; returns the raw string if the
 * input is malformed rather than throwing.
 */
export function formatArticleDate(iso: string): string {
  const parts = iso.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const monthName = MONTH_NAMES[month - 1];
  if (
    parts.length !== 3 ||
    !Number.isInteger(year) ||
    !Number.isInteger(day) ||
    monthName === undefined
  ) {
    return iso;
  }
  return `${day} ${monthName} ${year}`;
}

/** All published articles, ordered newest-first by their fixed date. */
export function getJournalArticles(): Article[] {
  return [...brand.journal].sort((a, b) => (a.dateIso < b.dateIso ? 1 : -1));
}

/** Look up a single article by slug, or `undefined` if none matches. */
export function getArticleBySlug(slug: string): Article | undefined {
  return brand.journal.find((article) => article.slug === slug);
}

/** Every article slug — for `generateStaticParams` and the sitemap. */
export function journalSlugs(): string[] {
  return brand.journal.map((article) => article.slug);
}
