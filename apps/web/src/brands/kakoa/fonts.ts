import { DM_Serif_Display, DM_Mono, Poppins } from "next/font/google";
import localFont from "next/font/local";
import type { BrandFonts } from "../contract";

/**
 * KAKOA type system. `next/font` calls MUST be static module-scope calls (the
 * loader rewrites them at build time), which is why fonts live in the pack and
 * not in a runtime lookup.
 */

const display = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

/**
 * Infini (Sandrine Nugue, CNAP 2014) — the UI/body face. Self-hosted because it
 * is not on Google Fonts. Served as the ORIGINAL unmodified OTFs on purpose:
 * Infini is CC BY-ND, which forbids altering the work, so converting to WOFF2
 * (or subsetting) would be a derivative. Costs ~110 KB per cut over WOFF2.
 * Attribution is required — see fonts/LICENSE.txt; the footer renders
 * `brand.fontAttribution` (index.ts) to satisfy it.
 */
const body = localFont({
  src: [
    { path: "./fonts/infini-romain.otf", weight: "400", style: "normal" },
    { path: "./fonts/infini-italique.otf", weight: "400", style: "italic" },
    { path: "./fonts/infini-gras.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

/**
 * Poppins — the site "chrome" face, used by the header and footer, which are
 * styled to match the Valrhona reference. Deliberately NOT the body face; page
 * content stays on Infini via --font-body.
 */
const ui = Poppins({
  subsets: ["latin"],
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
