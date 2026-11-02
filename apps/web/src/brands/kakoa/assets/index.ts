import type { BrandAssets } from "../../contract";
import desktop from "./hero.jpg";
import mobile from "./hero-mobile.jpg";

/**
 * Hero photography — two art-directed crops, pre-compressed to ~300 KB each.
 * Static imports hash the files into /_next/static/media so they are cached
 * immutably and only ship in the build that bundles this pack.
 */
export const assets = {
  heroPhoto: { desktop, mobile },
} satisfies BrandAssets;
