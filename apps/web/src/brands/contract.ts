/**
 * Presentation-pack contract — the React / next-font / CSS / content half of a
 * brand.
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
 * Content lives here as DATA: the pages own layout and behaviour, the pack owns
 * every sentence. Vertical vocabulary (nouns, cold-chain) still comes from the
 * kernel preset; where a sentence needs it, the pack writes it out — the pack
 * knows its own vertical.
 */
import type { ComponentType } from "react";
import type { StaticImageData } from "next/image";
import type { BrandProfile } from "@kakoa/brands";
import type { FaqCategory } from "@/components/content/FaqAccordion";
import type { CompanyInfo } from "@/lib/catalog/queries";

/* ── Fonts / icons / OG ───────────────────────────────────────────────── */

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

/* ── Storefront copy ──────────────────────────────────────────────────── */

/** A link the copy owns (CTA, nav shortcut). `href` is a root-relative route. */
export interface CopyLink {
  readonly label: string;
  readonly href: string;
}

/** Closing CTA band shared by the content pages (ContentClosingCta). */
export interface ClosingCtaCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly primary: CopyLink;
  readonly secondary: CopyLink;
}

/**
 * Thin-stroke line icons the home page can draw. Copy picks one per item so a
 * pack never ships SVG for the trust/gifting bands — only words.
 */
export type TrustIconName = "snowflake" | "flame" | "shield";
export type GiftIconName = "wrap" | "note" | "truck";

export interface TrustSignalCopy {
  readonly icon: TrustIconName;
  readonly title: string;
  readonly body: string;
}

export interface GiftFeatureCopy {
  readonly icon: GiftIconName;
  readonly title: string;
  readonly body: string;
}

export interface ProcessStepCopy {
  readonly step: string;
  readonly title: string;
  readonly body: string;
}

export interface StatCopy {
  readonly value: string;
  readonly label: string;
}

export interface HomeCopy {
  readonly hero: {
    readonly eyebrow: string;
    /** Headline when a hero product is spotlighted (its name) / when none is. */
    readonly headline: (productName: string | null) => string;
    /** Paragraph when the spotlighted product has no blurb / no product. */
    readonly body: string;
    readonly cta: (productName: string | null) => string;
  };
  /** Editorial marquee words; the `✦` separators are the page's. */
  readonly marqueeWords: readonly string[];
  readonly trust: {
    readonly ariaLabel: string;
    readonly signals: readonly TrustSignalCopy[];
  };
  readonly collections: {
    readonly eyebrow: string;
    readonly title: string;
  };
  readonly bestSellers: {
    readonly eyebrow: string;
    readonly title: string;
    readonly viewAll: string;
    readonly emptyTitle: string;
    readonly emptyBody: string;
    readonly emptyCta: CopyLink;
  };
  readonly story: {
    readonly eyebrow: string;
    /** Two display lines, broken by the page. */
    readonly title: readonly [string, string];
    readonly body: string;
    readonly stats: readonly StatCopy[];
    readonly cta: CopyLink;
    /** Alt text of the story photo slot and the small caption on its illustration. */
    readonly photoAlt: string;
    readonly photoLabel: string;
  };
  readonly process: {
    readonly eyebrow: string;
    readonly title: string;
    readonly steps: readonly ProcessStepCopy[];
  };
  readonly gifting: {
    readonly eyebrow: string;
    /** Two display lines, broken by the page on ≥ sm. */
    readonly title: readonly [string, string];
    readonly body: string;
    readonly cta: CopyLink;
    readonly features: readonly GiftFeatureCopy[];
  };
}

/** Token gradient classes for a photo-slot fallback (`from-*` / `to-*`). */
export interface PhotoFallbackCopy {
  readonly label: string;
  readonly alt: string;
  readonly from: string;
  readonly to: string;
}

export interface StoryBandCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: readonly string[];
  readonly photo: PhotoFallbackCopy;
  /** Pull the image right on desktop (odd rows). */
  readonly flip: boolean;
}

export interface AboutCopy {
  readonly metaDescription: string;
  readonly hero: {
    readonly eyebrow: string;
    /** Headline lead + the italic emphasis word(s), broken by the page. */
    readonly headlineLead: readonly [string, string];
    readonly headlineEmphasis: string;
    readonly body: string;
    readonly photo: PhotoFallbackCopy;
  };
  readonly bands: readonly StoryBandCopy[];
  readonly stats: {
    readonly ariaLabel: string;
    readonly items: readonly StatCopy[];
  };
  /** AboutPage + Organization JSON-LD descriptions (brand-true facts only). */
  readonly jsonLd: {
    readonly pageDescription: string;
    readonly organizationDescription: string;
  };
  readonly quote: {
    readonly text: string;
    readonly attribution: string;
  };
  readonly closing: ClosingCtaCopy;
}

export interface SupportCopy {
  readonly metaDescription: string;
  readonly lede: string;
  /** Placeholder of the FAQ search box. */
  readonly searchPlaceholder: string;
  readonly closing: ClosingCtaCopy;
}

export interface JournalCopy {
  readonly index: {
    readonly title: string;
    readonly metaDescription: string;
    readonly lede: string;
    readonly closing: ClosingCtaCopy;
    readonly empty: {
      readonly eyebrow: string;
      readonly title: string;
      readonly body: string;
      readonly cta: CopyLink;
    };
  };
  readonly article: {
    readonly closing: ClosingCtaCopy;
    /** Organization name in BlogPosting `author` (never a fabricated person). */
    readonly authorName: string;
    /** "Written by …" sign-off under the article body. */
    readonly byline: string;
  };
}

export interface ShopCopy {
  readonly metaDescription: string;
  /** Meta description of a category listing without its own description. */
  readonly categoryMetaDescription: (categoryName: string) => string;
}

export interface ErrorCopy {
  readonly title: string;
  readonly body: string;
}

export interface NotFoundCopy {
  readonly headline: string;
  readonly body: string;
  readonly primary: CopyLink;
  readonly secondary: CopyLink;
}

export interface CartCopy {
  readonly metaDescription: string;
  readonly emptyTitle: string;
  readonly emptyBody: string;
}

export interface FooterCopy {
  readonly tagline: string;
  readonly blurb: string;
  /** Newsletter column heading ("The KAKOA Club"). */
  readonly clubHeading: string;
  /** "© <year> <copyrightHolder>. All rights reserved." */
  readonly copyrightHolder: string;
}

export interface NewsletterCopy {
  /** Label above the input (card variant); `offer` is the configured incentive. */
  readonly label: (offer: string) => string;
  readonly success: (offer: string) => string;
  readonly toastSuccess: string;
  readonly finePrint: string;
}

/** A notification template's editable default copy (lib/admin/notification-catalog.ts). */
export interface NotificationCopy {
  readonly subject?: string;
  readonly body: string;
}

/**
 * Default copy per `<key>.<channel>` notification template. The subject suffix
 * and SMS prefix are added by the catalog; `{{placeholders}}` must stay within
 * the catalog's allowed list.
 */
export interface NotificationsCopy {
  readonly "order_confirmed.email": NotificationCopy;
  readonly "order_cancelled.email": NotificationCopy;
  readonly "order_shipped.email": NotificationCopy;
  readonly "order_shipped.sms": NotificationCopy;
  readonly "order_out_for_delivery.email": NotificationCopy;
  readonly "order_out_for_delivery.sms": NotificationCopy;
  readonly "order_delivered.email": NotificationCopy;
  readonly "order_delivered.sms": NotificationCopy;
}

/** Storefront copy owned by the brand. */
export interface StorefrontCopy {
  /** Suffix of the home <title>: "<name> · <titleTagline>". */
  readonly titleTagline: string;
  /** Small uppercase line under the wordmark on the GST invoice. */
  readonly invoiceTagline: string;
  readonly home: HomeCopy;
  readonly about: AboutCopy;
  readonly support: SupportCopy;
  readonly journal: JournalCopy;
  readonly shop: ShopCopy;
  readonly errors: {
    readonly storefront: ErrorCopy;
    readonly shop: ErrorCopy;
  };
  readonly notFound: NotFoundCopy;
  readonly cart: CartCopy;
  readonly footer: FooterCopy;
  readonly newsletter: NewsletterCopy;
  readonly notifications: NotificationsCopy;
}

/* ── FAQ / legal / journal ────────────────────────────────────────────── */

/**
 * Builds the Help-centre FAQ from live company settings — the same signature
 * the support page always had, so contact details, fees and SLAs interpolate
 * from store_settings while every sentence is the brand's.
 */
export type FaqBuilder = (company: CompanyInfo) => FaqCategory[];

/**
 * Vertical-specific clause variants of the shared legal documents. Everything
 * else in Privacy / Terms / Refund / Shipping is identical across brands and
 * stays in the page.
 */
export interface LegalVariants {
  /** Terms §6 — the nature of the food products sold (before the FSSAI suffix). */
  readonly foodProducts: {
    readonly heading: string;
    readonly body: string;
  };
  /** Refund §2 — the returns heading and the damage trigger bullet. */
  readonly returns: {
    readonly heading: string;
    readonly damagedTrigger: string;
  };
  /** Shipping §5 — how parcels are packed and handled. */
  readonly handling: {
    readonly heading: string;
    readonly body: string;
  };
}

/** A single rendered block of article prose. Rendered as nodes — never HTML. */
export type ArticleBlock =
  | { readonly type: "p"; readonly text: string }
  | { readonly type: "h2"; readonly text: string }
  | { readonly type: "ul"; readonly items: readonly string[] };

export interface Article {
  /** Kebab-case URL slug. */
  readonly slug: string;
  readonly title: string;
  /** ~20-word summary used on cards and as the meta description. */
  readonly excerpt: string;
  readonly category: string;
  /** Fixed ISO date (YYYY-MM-DD) — never computed at runtime. */
  readonly dateIso: string;
  readonly readMinutes: number;
  /** Token-only Tailwind gradient class for the cover placeholder. */
  readonly coverTone: string;
  readonly body: readonly ArticleBlock[];
}

/** The brand's published Journal; empty + `features.journal: false` hides the section. */
export type BrandJournal = readonly Article[];

/* ── Email ────────────────────────────────────────────────────────────── */

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
  /** Brand accent — the invoice wordmark, accent bar and grand total (screen + PDF). */
  readonly accent: string;
}

/**
 * Ledes of the transactional emails. `brand` is the trade name and `unit` the
 * vertical's unit noun ("piece", "pack") so a pack can write "every piece".
 */
export interface BrandEmailCopy {
  readonly confirmation: {
    readonly paidLede: string;
    readonly codLede: string;
  };
  readonly fulfilment: {
    readonly shippedLede: (brand: string) => string;
    readonly outForDeliveryLede: (brand: string) => string;
    readonly deliveredLede: (brand: string, unit: string) => string;
  };
}

export interface BrandEmail {
  readonly theme: BrandEmailTheme;
  /** Short brand line under the legal footer (e.g. "Handcrafted in small batches"); null omits it. */
  readonly footerTagline: string | null;
  readonly copy: BrandEmailCopy;
}

/* ── Components / assets ──────────────────────────────────────────────── */

/** Logo mark — pure SVG coloured via `currentColor`, server-safe. */
export type BrandMark = ComponentType<{ className?: string }>;

/**
 * Decorative illustrations the pack draws (server-safe, `aria-hidden`). Each
 * fills its nearest positioned parent; callers own aspect, radius and clip.
 */
export interface BrandIllustrations {
  /** Home story-band visual (the photo-slot fallback). */
  readonly Story: ComponentType<{ label?: string }>;
  /** The 404 page's hero graphic. */
  readonly NotFound: ComponentType;
}

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
  readonly faq: FaqBuilder;
  readonly legal: LegalVariants;
  readonly journal: BrandJournal;
  readonly og: BrandOg;
  readonly icon: BrandIcon;
  readonly email: BrandEmail;
  readonly fontAttribution: FontAttribution | null;
}
