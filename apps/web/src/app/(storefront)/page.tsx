import type { ReactNode } from "react";
import type { Route } from "next";
import Image from "next/image";
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

/** Premium pill CTAs — reused across the home hero and story bands. */
const PRIMARY_CTA = `rounded-pill bg-ink px-[30px] py-4 font-body text-[15.5px] font-bold text-cream shadow-lift transition-[transform,background-color] duration-[var(--duration-base)] ease-brand hover:-translate-y-0.5 hover:bg-ink-hover motion-reduce:transform-none ${FOCUS_RING}`;
const SECONDARY_CTA = `rounded-pill border-[1.5px] border-ink/25 px-[30px] py-4 font-body text-[15.5px] font-bold text-ink transition-colors duration-[var(--duration-base)] hover:border-ink hover:bg-card ${FOCUS_RING}`;

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
  const heroName = heroProduct?.name ?? null;

  return (
    <main>
      <SectionReveal />

      {/* ============================ HERO ============================ */}
      <section
        className="relative isolate overflow-hidden bg-field text-field-ink md:flex md:aspect-[1989/791] md:items-center"
        style={{ fontFamily: "var(--font-ui)" }}
      >

        {/* Full-bleed visual field (their geometry: one cover image, text
            overlaid at 3% left across 50% width). Real photography drops into
            the first layer; the field gradient stands in until it exists. */}
        <div
          aria-hidden="true"
          className="relative aspect-square w-full sm:aspect-[1989/791] md:absolute md:inset-0 md:-z-10 md:aspect-auto"
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

        <div className="w-full px-[3%] py-12 md:py-0 lg:py-20">
          <div className="w-full md:max-w-[65%] lg:max-w-[50%]">
            <div className="mb-6">
              <Eyebrow tone="gold">{home.hero.eyebrow}</Eyebrow>
            </div>
            <h1 className="mb-5 text-[24px] leading-[1.2] font-medium text-balance text-field-ink md:text-[34px] md:leading-[1.15]">
              {home.hero.headline(heroName)}
            </h1>
            <p className="mb-8 max-w-[52ch] text-[14px] leading-[21px] font-light tracking-[0.7px] text-field-ink/85">
              {heroProduct?.blurb ?? home.hero.body}
            </p>
            <div className="mb-9 flex flex-wrap gap-3.5">
              <Link
                href={heroProduct !== null ? `/product/${heroProduct.slug}` : "/shop"}
                className={`rounded-none border border-field-ink bg-field-ink px-5 py-3 text-[14px] tracking-[1.4px] text-field uppercase no-underline transition-colors hover:bg-transparent hover:text-field-ink ${FOCUS_RING}`}
              >
                {home.hero.cta(heroName)}
              </Link>
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
      <section
        aria-label={home.trust.ariaLabel}
        className="mx-auto max-w-[1240px] px-5 pt-14 sm:px-8 lg:pt-[72px]"
      >
        <ul className="grid gap-px overflow-hidden rounded-[22px] border border-line bg-line shadow-soft sm:grid-cols-3">
          {home.trust.signals.map((signal) => (
            <li
              key={signal.title}
              className="flex items-start gap-3.5 bg-cream-2 px-6 py-6 sm:px-7 sm:py-7"
            >
              <span
                aria-hidden="true"
                className="mt-px grid h-11 w-11 flex-none place-items-center rounded-[14px] border border-line-soft bg-cream text-espresso"
              >
                <TrustIcon name={signal.icon} />
              </span>
              <div className="max-w-[34ch]">
                <h3 className="font-body text-[15px] font-semibold text-ink">
                  {signal.title}
                </h3>
                <p className="mt-1 font-body text-[13.5px] leading-[1.55] text-ink-soft">
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
          className="mx-auto max-w-[1240px] px-5 sm:px-8 py-14 lg:py-[72px]"
        >
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2.5">
                <Eyebrow>{home.collections.eyebrow}</Eyebrow>
              </div>
              <h2
                id="home-collections"
                className="font-display text-h2 font-normal"
              >
                {home.collections.title}
              </h2>
            </div>
            <Link
              href="/shop"
              className={`hidden items-center gap-1.5 rounded-sm font-body text-[14.5px] font-bold text-ink transition-[gap] hover:gap-2.5 sm:flex ${FOCUS_RING}`}
            >
              All {vocabulary.noun.collective} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-[18px]">
            {collections.map(({ category, count }, index) => (
              <li key={category.id}>
                <Link
                  href={`/shop?category=${category.slug}`}
                  className={`group relative block overflow-hidden rounded-[20px] shadow-card transition-[transform,box-shadow] duration-[var(--duration-base)] ease-brand hover:-translate-y-1 hover:shadow-lift motion-reduce:transform-none ${FOCUS_RING}`}
                >
                  <div className="overflow-hidden">
                    <div className="transition-transform duration-[700ms] ease-brand group-hover:scale-[1.06] motion-reduce:group-hover:scale-100">
                      {category.imageUrl !== null ? (
                        <div className="relative aspect-[4/5] w-full overflow-hidden">
                          <Image
                            src={category.imageUrl}
                            alt=""
                            fill
                            sizes="(max-width: 1024px) 50vw, 25vw"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <ProductPlaceholder
                          tone={categorySwatch(index)}
                          ratio="4 / 5"
                          className="rounded-none!"
                        />
                      )}
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,10,4,.72),rgba(20,10,4,.05)_54%)]"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                    <div className="text-cream">
                      <div className="font-display text-[22px] leading-tight font-normal">
                        {category.name}
                      </div>
                      <div className="font-mono text-[11px] font-medium tracking-[0.1em] opacity-85">
                        {count} {count === 1 ? vocabulary.unitNoun.one : vocabulary.unitNoun.many}
                      </div>
                    </div>
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 flex-none translate-y-1 place-items-center rounded-pill bg-cream/90 text-ink opacity-0 transition-[opacity,transform] duration-[var(--duration-base)] ease-brand group-hover:translate-y-0 group-hover:opacity-100"
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
        className="mx-auto max-w-[1240px] px-5 sm:px-8 py-14 lg:py-[72px]"
      >
        <div className="mb-8 flex items-end justify-between gap-4">
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
            className={`flex items-center gap-1.5 rounded-sm font-body text-[14.5px] font-bold text-ink transition-[gap] hover:gap-2.5 ${FOCUS_RING}`}
          >
            {home.bestSellers.viewAll} <span aria-hidden="true">→</span>
          </Link>
        </div>
        {featured.length > 0 ? (
          <ul className="grid grid-cols-2 gap-4 sm:gap-[22px] lg:grid-cols-4">
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

      {/* ========================== STORY BAND ========================= */}
      <section
        aria-labelledby="home-story"
        className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[.95fr_1.05fr] lg:gap-16 lg:py-[88px]"
      >
        <div className="relative aspect-[5/4] overflow-hidden rounded-[26px] shadow-float">
          {/* photo-ready: pass a `src` to swap in real kitchen photography. */}
          <PhotoSlot alt={home.story.photoAlt} sizes="(max-width: 1024px) 100vw, 48vw">
            <StoryIllustration label={home.story.photoLabel} />
          </PhotoSlot>
        </div>
        <div>
          <div className="mb-4">
            <Eyebrow>{home.story.eyebrow}</Eyebrow>
          </div>
          <h2
            id="home-story"
            className="mb-5 font-display text-h1 font-normal leading-[1.06]"
          >
            {home.story.title[0]}
            <br />
            {home.story.title[1]}
          </h2>
          <p className="mb-7 max-w-[62ch] font-body text-lead text-ink-soft">
            {home.story.body}
          </p>
          <dl className="mb-8 flex flex-wrap gap-x-12 gap-y-5">
            {home.story.stats.map((stat) => (
              <div key={stat.label}>
                <dt className="font-display text-[32px] leading-none text-ink">
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
      </section>

      {/* ========================= PROCESS STRIP ======================= */}
      <section className="relative overflow-hidden bg-ink text-cream kk-grain">
        <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8 py-16 lg:py-[88px]">
          <div className="mb-10 max-w-[62ch]">
            <div className="mb-3">
              <Eyebrow tone="gold">{home.process.eyebrow}</Eyebrow>
            </div>
            <h2 className="font-display text-h1 font-normal leading-[1.06] text-balance text-cream">
              {home.process.title}
            </h2>
          </div>
          <ol className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {home.process.steps.map((movement) => (
              <li
                key={movement.step}
                className="border-t border-[rgba(233,199,176,.22)] pt-5"
              >
                <div className="mb-4 font-mono text-[13px] font-medium tracking-[0.14em] text-gold-soft">
                  {movement.step}
                </div>
                <h3 className="mb-2 font-display text-[24px] font-normal text-cream">
                  {movement.title}
                </h3>
                <p className="font-body text-[14px] leading-[1.6] text-[#D8C7B0]">
                  {movement.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ========================== GIFTING ========================== */}
      {brand.profile.features.gifting ? (
      <section
        aria-labelledby="home-gifting"
        className="mx-auto max-w-[1240px] px-5 sm:px-8 py-14 lg:py-[72px]"
      >
        <div className="relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-card to-cream-2 shadow-soft">
          <div
            aria-hidden="true"
            className="absolute -top-[28%] -right-[10%] h-[62%] w-[42%] rounded-pill bg-gold-soft opacity-30 blur-[80px]"
          />
          <div className="relative grid gap-10 p-8 sm:p-11 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-14 lg:p-14">
            <div>
              <div className="mb-3.5">
                <Eyebrow>{home.gifting.eyebrow}</Eyebrow>
              </div>
              <h2
                id="home-gifting"
                className="font-display text-h2 font-normal leading-[1.08] text-balance"
              >
                {home.gifting.title[0]}
                <br className="hidden sm:block" /> {home.gifting.title[1]}
              </h2>
              <p className="mt-4 max-w-[46ch] font-body text-lead text-ink-soft">
                {home.gifting.body}
              </p>
              <Link
                href={home.gifting.cta.href as Route}
                className={`mt-8 inline-block ${PRIMARY_CTA}`}
              >
                {home.gifting.cta.label}
              </Link>
            </div>
            <ul className="grid gap-3.5">
              {home.gifting.features.map((feature) => (
                <li
                  key={feature.title}
                  className="flex items-start gap-4 rounded-[16px] border border-line-soft bg-cream/70 px-5 py-4"
                >
                  <span
                    aria-hidden="true"
                    className="mt-px grid h-10 w-10 flex-none place-items-center rounded-[12px] border border-line bg-cream text-espresso"
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
          </div>
        </div>
      </section>
      ) : null}

    </main>
  );
}
