import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ClosingCta, Eyebrow } from "@/components/content/ContentPageShell";
import { PhotoSlot } from "@/components/home/PhotoSlot";
import { brand } from "@/lib/brand";

/** Every sentence here is the brand pack's; the page owns the layout. */
const { about } = brand.copy;
const BRAND_NAME = brand.profile.name;

/**
 * ABOUT / OUR STORY — the emotional-trust page that justifies premium pricing.
 * A rich, homepage-grade editorial layout (NOT the narrow doc shell): a framed
 * hero, alternating image/text craft bands, a stats row, an unnamed
 * founder-voice pull-quote on a warm band, and a closing CTA. Server component
 * — no interactivity. All colour comes from `@theme` tokens; every PhotoSlot
 * frame is a positioned box with an explicit aspect.
 */

export const metadata: Metadata = {
  title: "Our Story",
  description: about.metaDescription,
  alternates: { canonical: "/about" },
};

/** Art-directed placeholder: a token gradient wash + a small mono label, sized
 * to fill the caller's positioned frame. Real photography drops in later by
 * passing a `src` to `PhotoSlot` — no markup change here. */
function PhotoFallback({
  label,
  from,
  to,
}: {
  label: string;
  from: string;
  to: string;
}): ReactNode {
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${from} ${to}`}>
      <span className="absolute bottom-4 left-4 font-mono text-[11px] font-medium tracking-[0.12em] text-cream/85 uppercase">
        {label}
      </span>
    </div>
  );
}

/** AboutPage + Organization JSON-LD — brand-true facts only, no fabricated
 * ratings, awards or named people. */
const ABOUT_JSONLD = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: `Our Story · ${BRAND_NAME}`,
  description: about.jsonLd.pageDescription,
  mainEntity: {
    "@type": "Organization",
    name: BRAND_NAME,
    description: about.jsonLd.organizationDescription,
    foundingLocation: { "@type": "Place", name: "India" },
  },
} as const;

export default function AboutPage(): ReactNode {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ABOUT_JSONLD) }}
      />

      {/* ============================ HERO ============================ */}
      <section className="mx-auto w-full max-w-[1180px] px-6 pt-12 pb-14 md:px-8 md:pt-16 md:pb-16">
        <div className="max-w-[62ch]">
          <Eyebrow>{about.hero.eyebrow}</Eyebrow>
          <h1 className="mt-4 font-display text-[36px] leading-[1.05] text-balance text-ink md:text-hero">
            {about.hero.headlineLead[0]}
            <br className="hidden sm:block" /> {about.hero.headlineLead[1]}{" "}
            <span className="text-espresso italic">{about.hero.headlineEmphasis}</span>
          </h1>
          <p className="mt-5 font-body text-lead text-ink-soft">{about.hero.body}</p>
        </div>

        <div className="relative mt-10 aspect-[16/10] overflow-hidden rounded-[26px] shadow-float md:mt-12 md:aspect-[16/9]">
          <PhotoSlot
            alt={about.hero.photo.alt}
            sizes="(max-width: 1180px) 100vw, 1180px"
            priority
          >
            <PhotoFallback
              label={about.hero.photo.label}
              from={about.hero.photo.from}
              to={about.hero.photo.to}
            />
          </PhotoSlot>
        </div>
      </section>

      {/* ==================== ALTERNATING CRAFT BANDS ==================== */}
      {about.bands.map((band) => (
        <section
          key={band.eyebrow}
          className="mx-auto grid max-w-[1180px] items-center gap-9 px-6 py-12 md:px-8 md:gap-14 lg:grid-cols-2 lg:py-16"
        >
          <div
            className={`relative aspect-[5/4] overflow-hidden rounded-[24px] shadow-soft ${
              band.flip ? "lg:order-2" : ""
            }`}
          >
            <PhotoSlot
              alt={band.photo.alt}
              sizes="(max-width: 1024px) 100vw, 50vw"
            >
              <PhotoFallback
                label={band.photo.label}
                from={band.photo.from}
                to={band.photo.to}
              />
            </PhotoSlot>
          </div>
          <div className={band.flip ? "lg:order-1" : ""}>
            <Eyebrow>{band.eyebrow}</Eyebrow>
            <h2 className="mt-4 font-display text-h2 leading-[1.1] text-balance text-ink">
              {band.title}
            </h2>
            {band.body.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-4 max-w-[56ch] font-body text-[15.5px] leading-[1.65] text-ink-soft"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}

      {/* ========================== STATS ROW ========================== */}
      <section
        aria-label={about.stats.ariaLabel}
        className="mx-auto max-w-[1180px] px-6 py-4 md:px-8 md:py-6"
      >
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-[22px] border border-line bg-line shadow-soft sm:grid-cols-3">
          {about.stats.items.map((stat) => (
            <div key={stat.label} className="bg-cream-2 px-7 py-8 text-center">
              <dt className="font-display text-[40px] leading-none text-ink">
                {stat.value}
              </dt>
              <dd className="mt-2.5 font-mono text-[11px] tracking-[0.12em] text-ink-muted uppercase">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ====================== FOUNDER PULL-QUOTE ====================== */}
      <section className="mx-auto max-w-[1180px] px-6 py-12 md:px-8 md:py-16">
        <figure className="relative overflow-hidden rounded-[28px] bg-ink px-7 py-14 text-cream kk-grain sm:px-12 md:px-16 md:py-20">
          <div
            aria-hidden="true"
            className="absolute -top-[30%] right-[-8%] h-[60%] w-[42%] rounded-pill bg-gold-soft opacity-20 blur-[80px]"
          />
          <div className="relative mx-auto max-w-[46ch] text-center">
            <span
              aria-hidden="true"
              className="font-display text-[64px] leading-none text-gold-soft"
            >
              &ldquo;
            </span>
            <blockquote className="mt-2 font-display text-[26px] leading-[1.32] text-balance text-cream italic md:text-[32px]">
              {about.quote.text}
            </blockquote>
            <figcaption className="mt-7 font-mono text-[11px] tracking-[0.14em] text-gold-soft uppercase">
              {about.quote.attribution}
            </figcaption>
          </div>
        </figure>
      </section>

      {/* ========================= CLOSING CTA ========================= */}
      <ClosingCta copy={about.closing} />
    </main>
  );
}
