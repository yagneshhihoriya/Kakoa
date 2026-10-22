import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Serif_Display, DM_Mono, Poppins } from "next/font/google";
import localFont from "next/font/local";
import {
  BRAND,
  absoluteUrl,
  isProductionEnv,
  serializeJsonLd,
  siteUrl,
} from "@/lib/seo/site";
import { Analytics } from "@/components/analytics/Analytics";
import "./globals.css";

const fontDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

/**
 * Infini (Sandrine Nugue, CNAP 2014) — the UI/body face. Self-hosted because it
 * is not on Google Fonts. Served as the ORIGINAL unmodified OTFs on purpose:
 * Infini is CC BY-ND, which forbids altering the work, so converting to WOFF2
 * (or subsetting) would be a derivative. Costs ~110 KB per cut over WOFF2.
 * Attribution is required — see fonts/LICENSE.txt.
 */
const fontBody = localFont({
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
const fontUi = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-ui",
  display: "swap",
});

const fontMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

const SITE_DESCRIPTION =
  "Small-batch bean-to-bar chocolate, crafted in India. Bars, pralines, and signature collections.";

/**
 * Root metadata. `metadataBase` makes every relative canonical / OG URL a page
 * sets resolve to an absolute one (crawlers reject relative OG images). The
 * title `template` gives inner pages a "Page · KAKOA" suffix while the home
 * page keeps the bare `default`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${BRAND.name} · Small-Batch Chocolate`,
    template: `%s · ${BRAND.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: BRAND.name,
  // Belt-and-braces with robots.txt: a meta X-Robots-Tag noindex on every page
  // for non-production hosts (preview/staging), off the same predicate.
  ...(isProductionEnv() ? {} : { robots: { index: false, follow: false } }),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} · Small-Batch Chocolate`,
    description: SITE_DESCRIPTION,
    url: siteUrl(),
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} · Small-Batch Chocolate`,
    description: SITE_DESCRIPTION,
  },
};

/** Emits <meta name="theme-color"> so the mobile browser address bar takes the cocoa tint. */
export const viewport: Viewport = {
  themeColor: BRAND.themeColor,
};

/**
 * Site-wide Organization JSON-LD (content-blog-seo.md §5). Emitted once from
 * the root so every crawl of any page carries the brand's identity graph.
 * `serializeJsonLd` unicode-escapes `<` so copy can never break out of the tag.
 */
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BRAND.name,
  url: siteUrl(),
  logo: absoluteUrl("/icon"),
  description: SITE_DESCRIPTION,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@kakoa.in",
    areaServed: "IN",
    availableLanguage: ["en", "hi"],
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "IN",
    addressRegion: "Maharashtra",
  },
} as const;

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable} ${fontUi.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- serialized + <-escaped JSON-LD
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(ORGANIZATION_JSON_LD),
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
