import { DM_Mono, Fraunces, Hind_Vadodara, Mukta_Vaani } from "next/font/google";
import type { BrandFonts } from "../contract";

/**
 * Khakhra House type system. `next/font` calls MUST be static module-scope
 * calls (the loader rewrites them at build time), which is why fonts live in
 * the pack and not in a runtime lookup.
 *
 * The body and chrome faces are chosen for Gujarati glyph coverage (the brand
 * supports en / gu / hi): Mukta Vaani and Hind Vadodara both ship the
 * `gujarati` subset alongside `latin`. The display face is a warm, soft serif
 * for Latin headlines only. All four are Google Fonts (OFL), so no attribution
 * line is owed — `brand.fontAttribution` is null.
 */

/** Fraunces — variable optical-size serif; the headline / wordmark face. */
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

/** Mukta Vaani — the body face, Gujarati + Latin. */
const body = Mukta_Vaani({
  subsets: ["gujarati", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

/**
 * Hind Vadodara — the site "chrome" face (header, footer, hero overlay),
 * Gujarati + Latin, light-to-medium weights like the chrome face it replaces.
 */
const ui = Hind_Vadodara({
  subsets: ["gujarati", "latin"],
  weight: ["300", "400", "500"],
  variable: "--font-ui",
  display: "swap",
});

const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const fonts = { display, body, ui, mono } satisfies BrandFonts;
