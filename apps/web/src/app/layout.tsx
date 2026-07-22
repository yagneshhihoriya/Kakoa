import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Serif_Display, Hanken_Grotesk, DM_Mono } from "next/font/google";
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

const fontBody = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
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
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
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
