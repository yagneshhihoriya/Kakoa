/**
 * Presentation-pack contract — the React / next-font / CSS half of a brand.
 *
 * Exactly ONE pack under src/brands/<key> is bundled per build, selected by the
 * `@brand` alias in next.config.ts (from BRAND_KEY) and type-checked through
 * the matching tsconfig `paths` entry. Every pack module ends with
 * `satisfies <Type>` so a single typecheck proves each pack is complete.
 *
 * Pure data (identity, market, settings defaults) is NOT here — it is the
 * BrandProfile from @kakoa/brands, re-exported by the pack so client components
 * get it without any env read.
 *
 * Content (storefront copy, FAQ, legal clause variants, journal) joins this
 * contract in the content-extraction increment; `StorefrontCopy` starts with
 * the one string the root layout already needs.
 */
import type { ComponentType } from "react";
import type { StaticImageData } from "next/image";
import type { BrandProfile } from "@kakoa/brands";

/** The `next/font` result shape the root layout consumes (className + CSS var). */
export interface BrandFontFace {
  readonly className: string;
  readonly variable: string;
}

/**
 * Fixed export shape of `@brand/fonts`: the display (headline) face, the body
 * face, the chrome ("ui") face and a mono face, each bound to the CSS variable
 * the tokens reference (--font-display / --font-body / --font-ui / --font-mono).
 */
export interface BrandFonts {
  readonly display: BrandFontFace;
  readonly body: BrandFontFace;
  readonly ui: BrandFontFace;
  readonly mono: BrandFontFace;
}

/** A licence obligation that must be rendered on-site (e.g. a CC BY-ND face). */
export interface FontAttribution {
  /** Short line rendered in the footer legal bar. */
  readonly text: string;
  /** Licence URL the line links to. */
  readonly href: string;
}

/**
 * Generated app icons (favicon / apple-touch / manifest PNGs via lib/seo/icon.tsx).
 * Satori renders these at build time and cannot resolve CSS custom properties,
 * so the pack supplies literal colours here rather than tokens.
 */
export interface BrandIcon {
  /** CSS background for the icon square (gradient or colour). */
  readonly background: string;
  /** Colour of the brand initial. */
  readonly ink: string;
}

/** Default social-share card (app/opengraph-image.tsx). Satori-rendered, literal colours. */
export interface BrandOg {
  readonly alt: string;
  readonly tagline: string;
  /** CSS background for the card (gradient or colour). */
  readonly background: string;
  /** Wordmark colour. */
  readonly ink: string;
  /** Tagline colour. */
  readonly accent: string;
}

/** Storefront copy owned by the brand. Grows in the content-extraction increment. */
export interface StorefrontCopy {
  /** Suffix of the home <title>: "<name> · <titleTagline>". */
  readonly titleTagline: string;
}

/**
 * Transactional-email chrome. Email clients cannot read CSS custom properties,
 * so the pack supplies literal colours (as it does for the Satori renderers);
 * lib/email/templates.ts paints its inline styles from these.
 */
export interface BrandEmailTheme {
  /** Body text + wordmark + button background. */
  readonly ink: string;
  /** Page background behind the card + button text. */
  readonly cream: string;
  /** Secondary text (meta lines, footer). */
  readonly muted: string;
  /** Hairlines between rows / the card border. */
  readonly line: string;
  /** The centred card. */
  readonly card: string;
}

export interface BrandEmail {
  readonly theme: BrandEmailTheme;
  /** Short brand line under the legal footer (e.g. "Handcrafted in small batches"); null omits it. */
  readonly footerTagline: string | null;
}

/** Logo mark — pure SVG coloured via `currentColor`, server-safe. */
export type BrandMark = ComponentType<{ className?: string }>;

/**
 * Static imagery bundled with the pack. `heroPhoto` is the fallback hero when
 * no hero image setting is configured; `null` renders the gradient field.
 */
export interface BrandAssets {
  readonly heroPhoto: {
    /** 2.51:1 crop for the overlay layout (≥ 640px). */
    readonly desktop: StaticImageData;
    /** 1:1 crop for the stacked mobile band. */
    readonly mobile: StaticImageData;
  } | null;
}

/** What `import { brand } from "@brand"` resolves to. */
export interface BrandPack {
  readonly profile: BrandProfile;
  readonly copy: StorefrontCopy;
  readonly og: BrandOg;
  readonly icon: BrandIcon;
  readonly email: BrandEmail;
  readonly fontAttribution: FontAttribution | null;
}
