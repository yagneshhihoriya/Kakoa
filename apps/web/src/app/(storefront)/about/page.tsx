import type { ReactNode } from "react";
import type { Metadata } from "next";
import {
  ContentClosingCta,
  Eyebrow,
} from "@/components/content/ContentPageShell";
import { PhotoSlot } from "@/components/home/PhotoSlot";

/**
 * ABOUT / OUR STORY — the emotional-trust page that justifies premium pricing.
 * A rich, homepage-grade editorial layout (NOT the narrow doc shell): a framed
 * hero, alternating image/text craft bands (origin → craft → gifting), a stats
 * row, an unnamed founder-voice pull-quote on a warm cocoa band, and a closing
 * CTA. Server component — no interactivity. All colour comes from `@theme`
 * tokens; every PhotoSlot frame is a positioned box with an explicit aspect.
 */

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "How KAKOA makes single-origin, bean-to-bar chocolate by hand in India — direct-trade cacao from four origins, roasted and tempered in small batches, shipped cold and gifting-ready.",
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

/** Origin → craft → gifting: alternating image/text bands. `flip` pulls the
 * image to the right on desktop (odd rows) while keeping it first in the DOM
 * on mobile for a natural read order. */
const STORY_BANDS = [
  {
    eyebrow: "Where it begins",
    title: "Single-origin cacao, chosen bean by bean.",
    body: [
      "We work directly with growers across four origins, tasting and selecting the beans that carry a real sense of place. It's direct, ethical trade — growers are paid above market, because chocolate this good should be fair the whole way down.",
      "Each origin brings its own signature: bright red-fruit acidity, deep roasted nuttiness, a whisper of spice. We don't blend those voices away. We build the bar around them.",
    ],
    photo: {
      label: "Origin cacao",
      alt: "Single-origin cacao beans from four growing regions",
      from: "from-cocoa",
      to: "to-espresso",
    },
    flip: false,
  },
  {
    eyebrow: "In our kitchen",
    title: "Roasted, conched and tempered by hand.",
    body: [
      "Everything happens in our own small-batch kitchen. We roast every batch low and slow to draw out its origin character, then slow-conch for days until the texture turns to silk on the tongue.",
      "Finally we hand-temper and mould each piece for that clean, glossy snap. No shortcuts, no fillers, no industrial rush — just the same care, batch after batch.",
    ],
    photo: {
      label: "Small-batch kitchen",
      alt: "Chocolate being tempered by hand in the KAKOA kitchen",
      from: "from-espresso",
      to: "to-ink",
    },
    flip: true,
  },
  {
    eyebrow: "To your door",
    title: "Ships cold, arrives gifting-ready.",
    body: [
      "Great chocolate deserves to arrive in perfect condition. We pack every order cold and insulated, temperature-controlled from our kitchen to your door, anywhere in India.",
      "It's wrapped in signature packaging and ready to give — and you can add a handwritten note at checkout, tucked in by hand, so a gift feels like one.",
    ],
    photo: {
      label: "Cold, ready to gift",
      alt: "KAKOA chocolate boxed in signature, gifting-ready packaging",
      from: "from-cocoa-deep",
      to: "to-plum",
    },
    flip: false,
  },
] as const;

/** Provenance stats — mirrors the homepage story-band figures. */
const STATS = [
  { value: "4", label: "Cacao origins" },
  { value: "100%", label: "Roasted in-house" },
  { value: "Small", label: "Batch sizes" },
] as const;

/** AboutPage + Organization JSON-LD — brand-true facts only, no fabricated
 * ratings, awards or named people. */
const ABOUT_JSONLD = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "Our Story · KAKOA",
  description:
    "How KAKOA makes single-origin, bean-to-bar chocolate by hand in India.",
  mainEntity: {
    "@type": "Organization",
    name: "KAKOA",
    description:
      "Single-origin, small-batch, bean-to-bar chocolate made in India. Direct-trade cacao from four origins; roasted, conched and tempered in-house.",
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
          <Eyebrow>Our story</Eyebrow>
          <h1 className="mt-4 font-display text-[36px] leading-[1.05] text-balance text-ink md:text-hero">
            Great chocolate should
            <br className="hidden sm:block" /> taste of{" "}
            <span className="text-espresso italic">somewhere.</span>
          </h1>
          <p className="mt-5 font-body text-lead text-ink-soft">
            We started KAKOA in a tiny kitchen with one conviction: that a bar of
            chocolate could carry the character of the place it came from. Every
            piece is bean-to-bar, made by hand, in small batches — no shortcuts,
            no fillers, nothing to hide.
          </p>
        </div>

        <div className="relative mt-10 aspect-[16/10] overflow-hidden rounded-[26px] shadow-float md:mt-12 md:aspect-[16/9]">
          <PhotoSlot
            alt="Inside the KAKOA small-batch chocolate kitchen"
            sizes="(max-width: 1180px) 100vw, 1180px"
            priority
          >
            <PhotoFallback
              label="Our kitchen"
              from="from-cocoa"
              to="to-ink"
            />
          </PhotoSlot>
        </div>
      </section>

      {/* ==================== ALTERNATING CRAFT BANDS ==================== */}
      {STORY_BANDS.map((band) => (
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
        aria-label="KAKOA by the numbers"
        className="mx-auto max-w-[1180px] px-6 py-4 md:px-8 md:py-6"
      >
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-[22px] border border-line bg-line shadow-soft sm:grid-cols-3">
          {STATS.map((stat) => (
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
              We&rsquo;d rather make a little chocolate we&rsquo;re proud of than
              a lot we&rsquo;re not. Every batch leaves our kitchen the way
              we&rsquo;d want it to arrive at our own table.
            </blockquote>
            <figcaption className="mt-7 font-mono text-[11px] tracking-[0.14em] text-gold-soft uppercase">
              The KAKOA Kitchen
            </figcaption>
          </div>
        </figure>
      </section>

      {/* ========================= CLOSING CTA ========================= */}
      <ContentClosingCta
        eyebrow="Taste the difference"
        title="Chocolate worth slowing down for."
        body="Start with a single-origin bar, or send a box that says it better than words."
        primary={{ label: "Shop the collection", href: "/shop" }}
        secondary={{ label: "Read the Journal", href: "/journal" }}
      />
    </main>
  );
}
