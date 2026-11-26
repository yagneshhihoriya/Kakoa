import type { BrandIcon, BrandOg } from "../contract";

/**
 * Satori-rendered imagery (next/og) cannot read CSS custom properties, so the
 * card and icon colours are literal here rather than tokens from theme.css.
 */

/** Default social-share card: terracotta gradient, cream wordmark, turmeric tagline. */
export const og = {
  alt: "Khakhra House — Hand-Roasted Khakhra",
  tagline: "Hand-roasted khakhra, packed crisp",
  background: "linear-gradient(135deg, #8C3B1C 0%, #B4532A 100%)",
  ink: "#FFF3DC",
  accent: "#F3D9A3",
} satisfies BrandOg;

/** App icon: the brand initial in cream on a terracotta → deep-field gradient square. */
export const icon = {
  background: "linear-gradient(145deg, #8C3B1C 0%, #4F1F0D 100%)",
  ink: "#FFF3DC",
} satisfies BrandIcon;
