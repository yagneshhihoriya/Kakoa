import type { BrandAssets } from "../../contract";
import desktop from "./hero.jpg";
import mobile from "./hero-mobile.jpg";
import story from "./story.jpg";
import knead from "./process-knead.png";
import roll from "./process-roll.png";
import roast from "./process-roast.png";
import pack from "./process-pack.png";

/**
 * Hero fallback — two art-directed crops of an original illustration (a
 * roasted stack on the terracotta field, drawn for this pack; no stock
 * photography), ~50–70 KB each. Static imports hash the files into
 * /_next/static/media so they are cached immutably and only ship in the build
 * that bundles this pack. The owner's uploaded hero (storefront.hero_image_url)
 * replaces them without a rebuild.
 */
export const assets: BrandAssets = {
  heroPhoto: { desktop, mobile },
  /** Pressing a round on the tava — generated for this pack, 5:4, ~190 KB. */
  storyPhoto: story,
  /**
   * Spot illustrations for the craft cards — one generated sheet cut into
   * four 480×320 transparent PNGs (~40–50 KB each), keyed by step.
   */
  processArt: { "01": knead, "02": roll, "03": roast, "04": pack },
};
