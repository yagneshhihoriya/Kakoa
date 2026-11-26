import type { ReactNode } from "react";
import type { Route } from "next";
import { SafeImage } from "@/components/media/SafeImage";
import { CraftIcon } from "@/components/home/CraftIcon";
import Link from "next/link";
import type { ProductCardView } from "@kakoa/core";
import { EmptyState } from "@kakoa/ui";
import { assets } from "@brand/assets";
import { illustrations } from "@brand/illustrations";
import type { GiftIconName, TrustIconName } from "@/brands/contract";
import { brand, SWATCH_KEYS, toTone, vocabulary } from "@/lib/brand";
import {
  defaultStorefrontSettings,
  getCategories,
  getProductBySlug,
  getProducts,
  getStorefrontSettings,
} from "@/lib/catalog/queries";
import { getDefaultVariantIds } from "./shop/default-variants";
import { ProductPlaceholder } from "@/components/catalog/ProductPlaceholder";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PhotoSlot } from "@/components/home/PhotoSlot";
import { SectionReveal } from "@/components/home/SectionReveal";

/** Every sentence on this page is the brand pack's; the page owns layout + icons. */
const { home } = brand.copy;
/** The pack's story-band visual (the photo-slot fallback). */
const StoryIllustration = illustrations.Story;

/** ISR — 5-min time fallback; tag-based revalidation purges sooner. */
export const revalidate = 300;

/**
 * Collection tiles without an image (`categories.image_url`) fall back to the
 * preset's swatches by position — the chocolate palette is ordered so the
 * seeded collections keep their prototype tones.
 */
function categorySwatch(index: number): string {
  return toTone(SWATCH_KEYS[index % Math.max(1, SWATCH_KEYS.length)]);
}

/** Thin-stroke line icons for the trust band — decorative, brand-neutral. */
function TrustIcon({ name }: { name: TrustIconName }): ReactNode {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "snowflake") {
    return (
      <svg {...common}>
        <path d="M12 2v20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3" />
        <path d="M3.6 7l16.8 10M3.6 7l4.1.4M3.6 7l.4-4.1M20.4 17l-4.1-.4M20.4 17l-.4 4.1" />
        <path d="M20.4 7L3.6 17M20.4 7l-4.1.4M20.4 7l.4-4.1M3.6 17l4.1-.4M3.6 17l-.4 4.1" />
      </svg>
    );
  }
  if (name === "flame") {
    return (
      <svg {...common}>
        <path d="M11 20A7 7 0 0 1 4 13C4 8 8 4 13 3c2 8-2 14-2 17z" />
        <path d="M11 20c0-5 2.5-9 6.5-12" />
      </svg>
    );
  }
  if (name === "box") {
    return (
      <svg {...common}>
        <path d="M3 8l9-4 9 4v9l-9 4-9-4V8z" />
        <path d="M3 8l9 4 9-4M12 12v9" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** Thin-stroke line icons for the gifting band — decorative, brand-neutral. */
function GiftIcon({ name }: { name: GiftIconName }): ReactNode {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "wrap") {
    return (
      <svg {...common}>
        <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" />
        <path d="M2 7h20v5H2zM12 21V7M12 7S9.5 3 7.5 4.2 8.5 7 12 7zM12 7s2.5-4 4.5-2.8S15.5 7 12 7z" />
      </svg>
    );
  }
  if (name === "note") {
    return (
      <svg {...common}>
        <path d="M4 20l1-4 11-11 3 3-11 11-4 1z" />
        <path d="M13.5 6.5l3 3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

/** Shared focus treatment for bespoke (non-`Button`) interactive elements. */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** Premium pill CTAs — the gifting section's "Shop gift packs" and the story band's outline. */
const PRIMARY_CTA = `rounded-pill bg-ink px-[30px] py-4 font-body text-[15.5px] font-bold text-cream shadow-lift transition-[transform,background-color] duration-[var(--duration-base)] ease-brand hover:-translate-y-0.5 hover:bg-ink-hover motion-reduce:transform-none ${FOCUS_RING}`;
const SECONDARY_CTA = `rounded-pill border-[1.5px] border-ink/25 px-[30px] py-4 font-body text-[15.5px] font-bold text-ink transition-colors duration-[var(--duration-base)] hover:border-ink hover:bg-cream ${FOCUS_RING}`;
/**
 * One seam everywhere. A cream section owns only the space ABOVE itself
 * (72px desktop / 56px phone) — never a bottom padding, so neighbours cannot
 * stack into 144–160px voids. A full-bleed tinted band takes the same seam
 * as a margin above its colour edge and a one-step-smaller inset inside it,
 * so its padding reads as material rather than emptiness. The last cream
 * section before the footer also carries one bottom seam.
 */
const SECTION = "mx-auto max-w-[1240px] px-5 pt-14 sm:px-8 lg:pt-[72px]";
const BAND = "mt-14 lg:mt-[72px]";
const BAND_INNER = "mx-auto max-w-[1240px] px-5 py-12 sm:px-8 lg:py-16";
/** Section header row: eyebrow + title on the left, the section's next step on the right. */
const SECTION_HEAD = "mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 lg:mb-8";
const HEAD_LINK = `flex items-center gap-1.5 rounded-sm font-body text-[14.5px] font-bold transition-[gap] hover:gap-2.5 ${FOCUS_RING}`;

/** DM-Mono eyebrow with a growing rule — the section signature. */
function Eyebrow({
  children,
  tone = "espresso",
}: {
  children: ReactNode;
  tone?: "espresso" | "gold";
}): ReactNode {
  const color = tone === "gold" ? "text-gold-soft" : "text-espresso";
  const rule = tone === "gold" ? "bg-gold-soft/70" : "bg-espresso";
  return (
    <div
      className={`flex items-center gap-[13px] font-mono text-eyebrow font-medium uppercase ${color}`}
    >
      <span aria-hidden="true" className={`inline-block h-px w-[30px] ${rule}`} />
      {children}
    </div>
  );
}

export default async function HomePage() {
  const [categories, { products: featured }, storefront] = await Promise.all([
    getCategories(),
    getProducts({ sort: "featured", page: 1, pageSize: 4 }),
    getStorefrontSettings().catch(defaultStorefrontSettings),
  ]);

  // Per-category product counts for the category strip ("N pieces") — cheap
  // pageSize-1 hits against the same cached list query (no schema changes).
  const categoryCounts = await Promise.all(
    categories.map(async (category) => {
      const { total } = await getProducts({
        category: category.slug,
        sort: "featured",
        page: 1,
        pageSize: 1,
      });
      return total;
    }),
  );

  // Only advertise collections that actually hold products — an empty tile
  // linking to an empty shop filter is a dead end (never advertise empty rooms).
  const collections = categories
    .map((category, index) => ({ category, count: categoryCounts[index] ?? 0 }))
    .filter((entry) => entry.count > 0);

  // Hero spotlight — the product the owner picked in Settings
  // (storefront.home_hero_product_slug), else the top featured item.
  const heroSlug = storefront.homeHeroProductSlug;
  const heroProduct: ProductCardView | null =
    (heroSlug !== null
      ? (featured.find((product) => product.slug === heroSlug) ??
        (await getProductBySlug(heroSlug).catch(() => null)))
      : null) ??
    featured[0] ??
    null;

  // Default variant per featured product so the card's "Add to Cart" is a real
  // one-tap add (and fires the mobile added-to-bag sheet) instead of a PDP link.
  const defaultVariantIds = await getDefaultVariantIds(
    featured.map((product) => product.id),
  );

  /**
   * Hero photography — two art-directed crops: a 2.51:1 frame for the overlay
   * layout and a 1:1 frame for the stacked mobile band. The owner's uploads
   * (storefront.hero_image_url / _mobile_url) win; otherwise the crops bundled
   * with the brand pack; a pack without photography degrades to the gradient
   * field below. One configured URL serves both crops.
   */
  const configuredHero = storefront.heroImageUrl ?? storefront.heroImageMobileUrl;
  const heroPhoto =
    configuredHero !== null
      ? {
          desktop: storefront.heroImageUrl ?? configuredHero,
          mobile: storefront.heroImageMobileUrl ?? configuredHero,
        }
      : assets.heroPhoto !== null
        ? { desktop: assets.heroPhoto.desktop.src, mobile: assets.heroPhoto.mobile.src }
        : null;
  /** A `static` hero (the pack's call) ignores the spotlight product's name, blurb and link. */
  const staticHero = home.hero.mode === "static";
  const heroName = staticHero ? null : (heroProduct?.name ?? null);

  return (
    <main>
      <SectionReveal />

      {/* ============================ HERO ============================ */}
      <section
        className="relative isolate overflow-hidden bg-field text-field-ink md:flex md:min-h-[calc(100vw*791/1989)] md:items-center"
        style={{ fontFamily: "var(--font-ui)" }}
      >

        {/* Full-bleed visual field (their geometry: one cover image, text
            overlaid at 3% left across 50% width). Real photography drops into
            the first layer; the field gradient stands in until it exists. */}
        <div
          aria-hidden="true"
          className="relative aspect-[4/3] w-full sm:aspect-[1989/791] md:absolute md:inset-0 md:-z-10 md:aspect-auto"
        >
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_74%_38%,var(--color-field-light)_0%,var(--color-field)_46%,var(--color-field-deep)_100%)]" />
          {heroPhoto !== null ? (
            /* <picture> rather than next/image: the two crops are art direction,
               not resolution switching, and <source media> downloads exactly one
               — two next/image elements would both fetch (~600 KB wasted on phones).
               Files are pre-compressed to ~300 KB each, so we give up little.
               No scrim: the photo's own left field measures 7.3:1 against the
               cream copy (AA body text needs 4.5). */
            <picture>
              <source media="(min-width: 640px)" srcSet={heroPhoto.desktop} />
              <img
                src={heroPhoto.mobile}
                alt=""
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </picture>
          ) : null}
        </div>

        <div className="w-full px-5 pt-9 pb-10 md:px-[3%] md:py-10 lg:py-16">
          <div className="w-full md:max-w-[58%] lg:max-w-[50%]">
            <div className="mb-6">
              <Eyebrow tone="gold">
                {/* Three claims on wide screens; the third wraps a 375px line,
                    so phones show two. Layout only — the copy is unchanged. */}
                {home.hero.eyebrow.split(" • ").map((claim, index) => (
                  <span key={claim} className={index >= 2 ? "max-sm:hidden" : undefined}>
                    {index > 0 ? <span aria-hidden="true"> • </span> : null}
                    {claim}
                  </span>
                ))}
              </Eyebrow>
            </div>
            <h1 className="mb-5 text-[24px] leading-[1.2] font-medium text-balance whitespace-pre-line text-field-ink md:text-[28px] md:leading-[1.15] lg:text-[34px]">
              {home.hero.headline(heroName)}
            </h1>
            <p className="mb-8 max-w-[52ch] text-[14px] leading-[21px] font-light tracking-[0.7px] text-field-ink/85">
              {staticHero ? home.hero.body : (heroProduct?.blurb ?? home.hero.body)}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={heroProduct !== null && !staticHero ? `/product/${heroProduct.slug}` : "/shop"}
                className={`rounded-none border border-field-ink bg-field-ink px-5 py-3 text-[14px] tracking-[1.4px] text-field uppercase no-underline transition-colors hover:bg-transparent hover:text-field-ink ${FOCUS_RING}`}
              >
                {home.hero.cta(heroName)}
              </Link>
              {home.hero.secondaryCta !== undefined ? (
                <a
                  href={home.hero.secondaryCta.href}
                  className={`rounded-none border border-field-ink bg-transparent px-5 py-3 text-[14px] tracking-[1.4px] text-field-ink uppercase no-underline transition-colors hover:bg-field-ink hover:text-field ${FOCUS_RING}`}
                >
                  {home.hero.secondaryCta.label}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== EDITORIAL MARQUEE ===================== */}
      <section
        aria-hidden="true"
        className="overflow-hidden border-y border-line bg-cream-2 py-[15px]"
      >
        <div className="kk-marquee">
          {[...home.marqueeWords, ...home.marqueeWords, ...home.marqueeWords].map(
            (word, index) => (
              <span
                key={index}
                className="inline-flex items-center font-mono text-[12.5px] font-medium tracking-[0.18em] text-espresso uppercase"
              >
                {word}
                <span className="mx-6 text-gold">✦</span>
              </span>
            ),
          )}
        </div>
      </section>

      {/* ==================== TRUST / REASSURANCE ==================== */}
      {/* Phones: a slim three-up strip (icon over a short title) so the
          products stay within the first two screens; the body sentence is
          tablet-and-up, where the three cards sit side by side. */}
      <section
        aria-label={home.trust.ariaLabel}
        className="mx-auto max-w-[1240px] px-5 pt-10 sm:px-8 sm:pt-14 lg:pt-[72px]"
      >
        <ul className="grid grid-cols-3 gap-px overflow-hidden rounded-[18px] border border-line bg-line shadow-soft sm:rounded-[22px]">
          {home.trust.signals.map((signal) => (
            <li
              key={signal.title}
              className="flex flex-col items-center gap-2 bg-cream-2 px-2 py-4 text-center sm:flex-row sm:items-start sm:gap-3.5 sm:px-7 sm:py-7 sm:text-left"
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-9 flex-none place-items-center rounded-[12px] border border-line-soft bg-cream text-espresso sm:mt-px sm:h-11 sm:w-11 sm:rounded-[14px]"
              >
                <TrustIcon name={signal.icon} />
              </span>
              <div className="max-w-[34ch]">
                <h3 className="font-body text-[12px] leading-[1.3] font-semibold text-ink sm:text-[15px] sm:leading-normal">
                  {signal.title}
                </h3>
                <p className="mt-1 font-body text-[13.5px] leading-[1.55] text-ink-soft max-sm:hidden">
                  {signal.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ======================== COLLECTIONS ======================== */}
      {collections.length > 0 ? (
        <section
          aria-labelledby="home-collections"
          className={SECTION}
        >
          <div className={SECTION_HEAD}>
            <div>
              <div className="mb-2.5">
                <Eyebrow>{home.collections.eyebrow}</Eyebrow>
              </div>
              <h2
                id="home-collections"
                className="scroll-mt-24 font-display text-h2 font-normal"
              >
                {home.collections.title}
              </h2>
            </div>
            <Link
              href="/shop"
              className={`${HEAD_LINK} text-ink`}
            >
              All {vocabulary.noun.collective} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-[18px]">
            {collections.map(({ category, count }, index) => (
              <li key={category.id}>
                <Link
                  href={`/shop?category=${category.slug}`}
                  className={`group relative block overflow-hidden rounded-[20px] shadow-card transition-[transform,box-shadow] duration-[var(--duration-base)] ease-brand hover:-translate-y-1 hover:shadow-lift motion-reduce:transform-none ${FOCUS_RING}`}
                >
                  <div className="overflow-hidden">
                    <div className="transition-transform duration-[700ms] ease-brand group-hover:scale-[1.06] motion-reduce:group-hover:scale-100">
                      {/* Portrait on phones (two-up), square at four-up so the
                          four tiles stop reading as a second product wall. */}
                      <div className="relative aspect-[4/5] w-full overflow-hidden lg:aspect-square">
                        {category.imageUrl !== null ? (
                          <SafeImage
                            src={category.imageUrl}
                            alt=""
                            fill
                            sizes="(max-width: 1024px) 50vw, 25vw"
                            className="object-cover"
                          />
                        ) : (
                          <ProductPlaceholder
                            tone={categorySwatch(index)}
                            ratio="4 / 5"
                            className="absolute inset-0 h-full w-full rounded-none!"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,10,4,.72),rgba(20,10,4,.05)_54%)]"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5 sm:p-4">
                    <div className="text-cream">
                      <div className="font-display text-[19px] leading-tight font-normal sm:text-[22px]">
                        {category.name}
                      </div>
                      <div className="font-mono text-[11px] font-medium tracking-[0.1em] opacity-85">
                        {count} {count === 1 ? vocabulary.unitNoun.one : vocabulary.unitNoun.many}
                      </div>
                    </div>
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 flex-none translate-y-1 place-items-center rounded-pill bg-cream/90 text-ink opacity-0 transition-[opacity,transform] duration-[var(--duration-base)] ease-brand group-hover:translate-y-0 group-hover:opacity-100 max-sm:hidden"
                    >
                      →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ======================== BEST SELLERS ======================== */}
      <section
        aria-labelledby="home-featured"
        className={SECTION}
      >
        <div className={SECTION_HEAD}>
          <div>
            <div className="mb-2.5">
              <Eyebrow>{home.bestSellers.eyebrow}</Eyebrow>
            </div>
            <h2
              id="home-featured"
              className="font-display text-h2 font-normal"
            >
              {home.bestSellers.title}
            </h2>
          </div>
          <Link
            href="/shop"
            className={`${HEAD_LINK} text-ink`}
          >
            {home.bestSellers.viewAll} <span aria-hidden="true">→</span>
          </Link>
        </div>
        {featured.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-[22px] lg:grid-cols-4">
            {featured.map((product) => (
              <li key={product.id}>
                <ProductCard
                  product={product}
                  defaultVariantId={defaultVariantIds[product.id] ?? null}
                  className="h-full"
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={home.bestSellers.emptyTitle}
            description={home.bestSellers.emptyBody}
            cta={{ label: home.bestSellers.emptyCta.label, href: home.bestSellers.emptyCta.href }}
          />
        )}
      </section>

      {/* ================= CRAFT BAND — story + four steps ================= */}
      {/* One full-bleed pale-wheat band: the kitchen photograph and "Rolled
          thin, roasted slow." first, then the four steps as a sub-head with
          the section's next step beside it, ending on the card row. The band
          takes the page seam as its top margin and a smaller inset inside its
          colour, so the two most related stories on the page sit together
          instead of 160px apart. */}
      <section
        aria-labelledby="home-story"
        className={`${BAND} border-y border-line bg-card`}
      >
        <div className={BAND_INNER}>
          <div className="grid items-center gap-8 lg:grid-cols-[.95fr_1.05fr] lg:gap-16">
            <div className="relative aspect-[5/4] overflow-hidden rounded-[26px] bg-cream shadow-float">
              {/* The pack's kitchen photograph when it has one; otherwise its
                  Story illustration. */}
              <PhotoSlot
                src={assets.storyPhoto?.src ?? null}
                alt={home.story.photoAlt}
                sizes="(max-width: 1024px) 100vw, 48vw"
              >
                <StoryIllustration label={home.story.photoLabel} />
              </PhotoSlot>
            </div>
            <div>
              <div className="mb-2.5">
                <Eyebrow>{home.story.eyebrow}</Eyebrow>
              </div>
              <h2
                id="home-story"
                className="mb-4 font-display text-h2 font-normal"
              >
                {home.story.title[0]}
                <br />
                {home.story.title[1]}
              </h2>
              <p className="mb-6 max-w-[58ch] font-body text-lead text-ink-soft">
                {home.story.body}
              </p>
              <dl className="mb-7 grid grid-cols-3 gap-x-4 sm:flex sm:flex-wrap sm:gap-x-12 sm:gap-y-5">
                {home.story.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="font-display text-[28px] leading-none text-ink sm:text-[32px]">
                      {stat.value}
                    </dt>
                    <dd className="mt-1.5 font-mono text-[11px] tracking-[0.12em] text-ink-muted uppercase">
                      {stat.label}
                    </dd>
                  </div>
                ))}
              </dl>
              <Link href={home.story.cta.href as Route} className={SECONDARY_CTA}>
                {home.story.cta.label}
              </Link>
            </div>
          </div>

          {/* The four steps: sub-head row (title + lede left, next step right),
              then the numbered rail and the cards. Phones get a snap rail so
              the steps stay about a screen tall. */}
          <div className="mt-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 lg:mt-14">
            <div className="max-w-[52ch]">
              <div className="mb-2.5">
                <Eyebrow>{home.process.eyebrow}</Eyebrow>
              </div>
              <h3
                id="home-process"
                className="scroll-mt-24 font-display text-h3 font-normal text-ink"
              >
                {home.process.title}
              </h3>
              {home.process.lede ? (
                <p className="mt-2 font-body text-[15px] leading-[1.6] text-ink-soft max-sm:hidden">
                  {home.process.lede}
                </p>
              ) : null}
            </div>
            {home.process.cta ? (
              <Link
                href={home.process.cta.href as Route}
                className={`${HEAD_LINK} text-espresso`}
              >
                {home.process.cta.label} <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
          <ol className="-mx-5 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:mt-8 lg:grid-cols-4 lg:gap-5">
            {home.process.steps.map((movement, index) => {
              const isLast = index === home.process.steps.length - 1;
              // The rail runs card to card. It must stop at the end of each
              // row: the last card always, and the second card on the two-up
              // tablet grid (where it comes back at four-up).
              const railClass = isLast
                ? "hidden"
                : index % 2 === 1
                  ? "sm:hidden lg:block"
                  : "";
              // Every second card takes the terracotta tone so the row
              // alternates cream / terracotta like the hero's two fields.
              const accent = index % 2 === 1;
              const art = assets.processArt?.[movement.step] ?? null;
              return (
                <li
                  key={movement.step}
                  className="relative flex min-w-[74%] snap-start flex-col sm:min-w-0"
                >
                  <div className="relative mb-3.5 flex items-center">
                    <span
                      aria-hidden="true"
                      className={`absolute top-1/2 right-[-12px] left-8 h-0 border-t-2 border-dotted border-espresso/30 sm:right-[-24px] lg:right-[-20px] ${railClass}`}
                    />
                    <span className="relative grid h-7 w-7 place-items-center rounded-full bg-gold-soft font-mono text-[11px] font-medium tracking-[0.08em] text-espresso">
                      {movement.step}
                    </span>
                  </div>
                  <div
                    className={`flex flex-1 flex-col rounded-[20px] border p-5 shadow-soft sm:p-6 ${
                      accent
                        ? "border-espresso/40 bg-espresso text-cream"
                        : "border-line bg-cream"
                    }`}
                  >
                    {movement.photo ? (
                      <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-[14px] bg-cream">
                        <SafeImage
                          src={movement.photo.src}
                          alt={movement.photo.alt}
                          fill
                          sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 78vw"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="mb-3 flex items-start justify-end">
                        {/* The illustration carries the card; the line icon
                            is the fallback for a pack without art. */}
                        {art ? (
                          <SafeImage
                            src={art.src}
                            alt=""
                            width={art.width}
                            height={art.height}
                            sizes="200px"
                            className="-mt-2 -mr-2 h-auto w-[58%] max-w-[200px]"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className={`mr-auto grid h-11 w-11 flex-none place-items-center rounded-[14px] border ${
                              accent
                                ? "border-cream/25 bg-cream/15 text-cream"
                                : "border-line-soft bg-cream text-espresso"
                            }`}
                          >
                            <CraftIcon name={movement.icon} />
                          </span>
                        )}
                      </div>
                    )}
                    <h3
                      className={`mb-2 font-display text-[22px] leading-tight font-normal sm:text-[24px] ${accent ? "text-cream" : "text-ink"}`}
                    >
                      {movement.title}
                    </h3>
                    <p
                      className={`font-body text-[14px] leading-[1.6] ${accent ? "text-cream/85" : "text-ink-soft"}`}
                    >
                      {movement.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ========================== GIFTING ========================== */}
      {/* On the page cream, in the trust strip's card language, with the one
          bottom seam the page needs before the terracotta footer. */}
      {brand.profile.features.gifting ? (
      <section
        aria-labelledby="home-gifting"
        className={`${SECTION} pb-14 lg:pb-[72px]`}
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:grid-rows-[auto_auto] lg:items-center lg:gap-x-14 lg:gap-y-0">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <div className="mb-2.5">
              <Eyebrow>{home.gifting.eyebrow}</Eyebrow>
            </div>
            <h2
              id="home-gifting"
              className="font-display text-h2 font-normal text-balance"
            >
              {home.gifting.title[0]}
              <br className="hidden sm:block" /> {home.gifting.title[1]}
            </h2>
            <p className="mt-4 max-w-[46ch] font-body text-lead text-ink-soft">
              {home.gifting.body}
            </p>
          </div>
          <ul className="grid gap-3 lg:col-start-2 lg:row-span-2 lg:self-center">
            {home.gifting.features.map((feature) => (
              <li
                key={feature.title}
                className="flex items-start gap-4 rounded-[16px] border border-line bg-cream-2 px-5 py-4 shadow-soft"
              >
                <span
                  aria-hidden="true"
                  className="mt-px grid h-10 w-10 flex-none place-items-center rounded-[12px] border border-line-soft bg-cream text-espresso"
                >
                  <GiftIcon name={feature.icon} />
                </span>
                <div>
                  <h3 className="font-body text-[15px] font-semibold text-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-1 font-body text-[13.5px] leading-[1.55] text-ink-soft">
                    {feature.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="lg:col-start-1 lg:row-start-2 lg:mt-8 lg:self-start">
            <Link
              href={home.gifting.cta.href as Route}
              className={`inline-block max-sm:w-full max-sm:text-center ${PRIMARY_CTA}`}
            >
              {home.gifting.cta.label}
            </Link>
          </div>
        </div>
      </section>
      ) : null}

    </main>
  );
}
