import type { Route } from "next";
import type { CategoryView } from "@kakoa/core";

/**
 * Category links the chrome derives from the catalogue (Header mobile
 * drill-down, MegaMenu, Footer "Shop" column). Server components load
 * `getCategories()` and hand this slim, serialisable shape to the client
 * islands — never the hardcoded collection list the chrome used to carry.
 */
export interface NavCategory {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
}

export function toNavCategories(categories: readonly CategoryView[]): NavCategory[] {
  return categories.map(({ slug, name, description }) => ({ slug, name, description }));
}

/** The shop listing filtered to one category — the same URL the shop page builds. */
export function categoryHref(slug: string): Route {
  return `/shop?category=${encodeURIComponent(slug)}` as Route;
}
