import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { fonts } from "@brand/fonts";
import { assertBrandMatchesEnv, brand } from "@/lib/brand";
import {
  absoluteUrl,
  isProductionEnv,
  serializeJsonLd,
  siteUrl,
} from "@/lib/seo/site";
import { Analytics } from "@/components/analytics/Analytics";
import "./globals.css";
// AFTER globals.css: the pack's unlayered :root override wins over @theme.
import "@brand/theme.css";

const { profile, copy } = brand;

/** Home <title> — inner pages get the `template` suffix instead. */
const SITE_TITLE = `${profile.name} · ${copy.titleTagline}`;

/** BCP-47 "en-IN" → the <html lang> language and the OpenGraph "en_IN" locale. */
const LANG = profile.locale.slice(0, 2);
const OG_LOCALE = profile.locale.replace("-", "_");

/**
 * Root metadata. `metadataBase` makes every relative canonical / OG URL a page
 * sets resolve to an absolute one (crawlers reject relative OG images). The
 * title `template` gives inner pages a "Page · <brand>" suffix while the home
 * page keeps the bare `default`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s · ${profile.name}`,
  },
  description: profile.seo.description,
  applicationName: profile.name,
  // Belt-and-braces with robots.txt: a meta X-Robots-Tag noindex on every page
  // for non-production hosts (preview/staging), off the same predicate.
  ...(isProductionEnv() ? {} : { robots: { index: false, follow: false } }),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: profile.name,
    title: SITE_TITLE,
    description: profile.seo.description,
    url: siteUrl(),
    locale: OG_LOCALE,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: profile.seo.description,
  },
};

/** Emits <meta name="theme-color"> so the mobile browser address bar takes the brand tint. */
export const viewport: Viewport = {
  themeColor: profile.themeColor,
};

/**
 * Site-wide Organization JSON-LD (content-blog-seo.md §5). Emitted once from
 * the root so every crawl of any page carries the brand's identity graph.
 * `serializeJsonLd` unicode-escapes `<` so copy can never break out of the tag.
 */
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: profile.name,
  url: siteUrl(),
  logo: absoluteUrl("/icon"),
  description: profile.seo.description,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: profile.defaults.support_email,
    areaServed: profile.country,
    availableLanguage: [...profile.availableLanguages],
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: profile.country,
    addressRegion: profile.organization.addressRegion,
  },
} as const;

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Fail fast if this build's pack is not the brand the environment names.
  assertBrandMatchesEnv();
  return (
    <html
      lang={LANG}
      className={`${fonts.display.variable} ${fonts.body.variable} ${fonts.mono.variable} ${fonts.ui.variable}`}
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
