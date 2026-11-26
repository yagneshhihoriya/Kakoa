import type { BrandIcon, BrandOg } from "../contract";

/**
 * Satori-rendered imagery (next/og) cannot read CSS custom properties, so the
 * card and icon colours are literal here rather than tokens from theme.css.
 */

/** Default social-share card: cocoa gradient, cream wordmark, caramel tagline. */
export const og = {
  alt: "KAKOA — Small-Batch Chocolate",
  tagline: "Small-batch bean-to-bar chocolate",
  background: "linear-gradient(135deg, #2A1D12 0%, #4A2E1C 100%)",
  ink: "#FBF6EF",
  accent: "#E8C9A0",
} satisfies BrandOg;

/** App icon: the brand initial in cream on an ink → dark-cocoa gradient square. */
export const icon = {
  background: "linear-gradient(145deg, #2A1D12 0%, #4A331F 100%)",
  ink: "#FBF6EF",
} satisfies BrandIcon;
