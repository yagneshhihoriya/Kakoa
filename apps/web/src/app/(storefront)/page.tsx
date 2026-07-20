import type { ReactNode } from "react";
import Link from "next/link";
import type { ProductTone } from "@kakoa/core";
import { PRODUCT_TONES } from "@kakoa/core";
import { EmptyState } from "@kakoa/ui";
import { getCategories, getProducts } from "@/lib/catalog/queries";
import { ChocoPlaceholder } from "@/components/catalog/ChocoPlaceholder";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ChocoScene } from "@/components/home/ChocoScene";
import { HeroShowcase } from "@/components/home/HeroShowcase";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { SectionReveal } from "@/components/home/SectionReveal";

/** ISR — 5-min time fallback; tag-based revalidation purges sooner. */
export const revalidate = 300;

/** Seeded category slugs → placeholder tones (prototype art direction). */
const CATEGORY_TONES: Record<string, ProductTone> = {
  bars: "dark",
  pralines: "milk",
  signature: "ruby",
  gifts: "caramel",
};

function categoryTone(slug: string, index: number): ProductTone {
  return (
    CATEGORY_TONES[slug] ?? PRODUCT_TONES[index % PRODUCT_TONES.length] ?? "dark"
  );
}

/** Value-props trio — copy + icons verbatim from the prototype (`props3`). */
const VALUE_PROPS = [
  {
    icon: "🌱",
    title: "Ethically sourced",
    body: "Direct-trade cacao from four origins, farmers paid above market.",
  },
  {
    icon: "🔥",
    title: "Roasted in-house",
    body: "Every batch roasted, conched and tempered in our own kitchen.",
  },
  {
    icon: "❄️",
    title: "Ships cold & safe",
    body: "Insulated packaging keeps every piece perfect to your door.",
  },
] as const;

/** Editorial marquee — the craft vocabulary, looped as a decorative ribbon. */
const MARQUEE_WORDS = [
  "Single-origin cacao",
  "Bean-to-bar",
  "Roasted in-house",
  "Small-batch",
  "Ethically sourced",
  "Hand-finished",
  "Ships cold & safe",
] as const;

/** Bean-to-bar process — the provenance narrative, four movements. */
const PROCESS = [
  {
    step: "01",
    title: "Source",
    body: "Direct-trade cacao from growers across four origins, chosen bean by bean.",
  },
  {
    step: "02",
    title: "Roast",
    body: "Every batch roasted in-house, low and slow, to draw out its origin character.",
  },
  {
    step: "03",
    title: "Conch",
    body: "Slow-conched for days until the texture turns to silk on the tongue.",
  },
  {
    step: "04",
    title: "Temper",
    body: "Hand-tempered and molded for that clean, glossy snap in every piece.",
  },
] as const;

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
  const [categories, { products: featured }] = await Promise.all([
    getCategories(),
    getProducts({ sort: "featured", page: 1, pageSize: 4 }),
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

  // Floating hero chip — prototype spotlights the ruby "new this season"
  // product; fall back to the top featured item.
  const heroProduct =
    featured.find((product) => product.tone === "ruby") ?? featured[0] ?? null;

  return (
    <main>
      <SectionReveal />

      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        {/* Warm, layered backdrop — never a flat cream slab. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--color-cream)_0%,var(--color-cream-2)_100%)]" />
          <div className="absolute -top-[12%] right-[-6%] h-[62%] w-[52%] rounded-pill bg-[#EAC7A2] opacity-40 blur-[90px]" />
          <div className="absolute bottom-[-14%] left-[-8%] h-[46%] w-[40%] rounded-pill bg-[#C7D0A6] opacity-30 blur-[80px]" />
        </div>

        <div className="mx-auto grid max-w-[1240px] items-center gap-9 px-5 pt-12 pb-14 sm:px-8 sm:pt-14 sm:pb-16 lg:min-h-[80vh] lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:pt-16">
          <div>
            <div className="mb-6">
              <Eyebrow>Small-batch · Single origin</Eyebrow>
            </div>
            <h1 className="mb-6 font-display text-hero font-normal text-balance">
              Chocolate worth
              <br />
              slowing down
              <br />
              <span className="text-espresso italic">for.</span>
            </h1>
            <p className="mb-8 max-w-[460px] font-body text-lead text-ink-soft">
              Ethically sourced cacao, roasted in-house and finished by hand.
              Tasting notes you can actually taste — no shortcuts, no fillers.
            </p>
            <div className="mb-9 flex flex-wrap gap-3.5">
              <Link href="/shop" className={PRIMARY_CTA}>
                Shop the collection
              </Link>
              <Link href="/about" className={SECONDARY_CTA}>
                Our story
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-[22px] font-body text-[13.5px] text-ink-soft">
              <div className="flex items-center gap-[7px]">
                <span aria-hidden="true" className="text-gold">
                  ✦
                </span>
                <span>
                  <strong className="font-bold text-ink">Small-batch</strong> ·
                  bean-to-bar
                </span>
              </div>
              <span aria-hidden="true" className="h-4 w-px bg-line" />
              <span className="inline-flex items-center gap-[7px]">
                <svg
                  aria-hidden="true"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#7C8A4E"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 20A7 7 0 0 1 4 13C4 8 8 4 13 3c2 8-2 14-2 17z" />
                  <path d="M11 20c0-5 2.5-9 6.5-12" />
                </svg>
                Ethically sourced cacao
              </span>
            </div>
          </div>
          <HeroShowcase product={heroProduct} />
        </div>
      </section>

      {/* ===================== EDITORIAL MARQUEE ===================== */}
      <section
        aria-hidden="true"
        className="overflow-hidden border-y border-line bg-cream-2 py-[15px]"
      >
        <div className="kk-marquee">
          {[...MARQUEE_WORDS, ...MARQUEE_WORDS, ...MARQUEE_WORDS].map(
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

      {/* ======================== COLLECTIONS ======================== */}
      {categories.length > 0 ? (
        <section
          aria-labelledby="home-collections"
          className="mx-auto max-w-[1240px] px-5 sm:px-8 py-14 lg:py-[72px]"
        >
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2.5">
                <Eyebrow>Shop by collection</Eyebrow>
              </div>
              <h2
                id="home-collections"
                className="font-display text-h2 font-normal"
              >
                Find your flavour
              </h2>
            </div>
            <Link
              href="/shop"
              className={`hidden items-center gap-1.5 rounded-sm font-body text-[14.5px] font-bold text-ink transition-[gap] hover:gap-2.5 sm:flex ${FOCUS_RING}`}
            >
              All chocolate <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-[18px]">
            {categories.map((category, index) => (
              <li key={category.id}>
                <Link
                  href={`/shop?category=${category.slug}`}
                  className={`group relative block overflow-hidden rounded-[20px] shadow-card transition-[transform,box-shadow] duration-[var(--duration-base)] ease-brand hover:-translate-y-1 hover:shadow-lift motion-reduce:transform-none ${FOCUS_RING}`}
                >
                  <div className="overflow-hidden">
                    <div className="transition-transform duration-[700ms] ease-brand group-hover:scale-[1.06] motion-reduce:group-hover:scale-100">
                      <ChocoPlaceholder
                        tone={categoryTone(category.slug, index)}
                        ratio="4 / 5"
                        className="rounded-none!"
                      />
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
                        {categoryCounts[index] ?? 0} pieces
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
              <Eyebrow>Loved by many</Eyebrow>
            </div>
            <h2
              id="home-featured"
              className="font-display text-h2 font-normal"
            >
              Best sellers
            </h2>
          </div>
          <Link
            href="/shop"
            className={`flex items-center gap-1.5 rounded-sm font-body text-[14.5px] font-bold text-ink transition-[gap] hover:gap-2.5 ${FOCUS_RING}`}
          >
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>
        {featured.length > 0 ? (
          <ul className="grid grid-cols-2 gap-4 sm:gap-[22px] lg:grid-cols-4">
            {featured.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} className="h-full" />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="The first batch is still tempering"
            description="New chocolates land here soon — check back shortly."
            cta={{ label: "Browse the shop", href: "/shop" }}
          />
        )}
      </section>

      {/* ========================= VALUE PROPS ======================== */}
      <section aria-label="Why KAKOA" className="border-y border-line bg-cream-2">
        <ul className="mx-auto grid max-w-[1240px] gap-9 px-5 py-12 sm:px-8 md:grid-cols-3">
          {VALUE_PROPS.map((prop) => (
            <li key={prop.title} className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="grid h-[48px] w-[48px] flex-none place-items-center rounded-lg bg-ink text-xl text-gold-soft shadow-soft"
              >
                {prop.icon}
              </span>
              <div>
                <h3 className="mb-1 font-body text-base font-semibold text-ink">
                  {prop.title}
                </h3>
                <p className="font-body text-sm leading-[1.55] text-ink-soft">
                  {prop.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ========================== STORY BAND ========================= */}
      <section
        aria-labelledby="home-story"
        className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[.95fr_1.05fr] lg:gap-16 lg:py-[88px]"
      >
        <div className="relative aspect-[5/4] overflow-hidden rounded-[26px] shadow-float">
          <ChocoScene kind="story" label="Small-batch kitchen" />
        </div>
        <div>
          <div className="mb-4">
            <Eyebrow>Our story</Eyebrow>
          </div>
          <h2
            id="home-story"
            className="mb-5 font-display text-h1 font-normal"
          >
            From bean to bar,
            <br />
            in our own hands.
          </h2>
          <p className="mb-7 max-w-[480px] font-body text-lead text-ink-soft">
            We started KAKOA in a tiny kitchen with one conviction: great
            chocolate should taste of somewhere. Today we work directly with
            growers across four origins, and still roast every batch ourselves.
          </p>
          <dl className="mb-8 flex flex-wrap gap-x-12 gap-y-5">
            {[
              { value: "4", label: "Cacao origins" },
              { value: "100%", label: "Roasted in-house" },
              { value: "Small", label: "Batch sizes" },
            ].map((stat) => (
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
          <Link href="/about" className={SECONDARY_CTA}>
            Read our story
          </Link>
        </div>
      </section>

      {/* ========================= PROCESS STRIP ======================= */}
      <section className="relative overflow-hidden bg-ink text-cream kk-grain">
        <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8 py-16 lg:py-[88px]">
          <div className="mb-10 max-w-[560px]">
            <div className="mb-3">
              <Eyebrow tone="gold">The craft</Eyebrow>
            </div>
            <h2 className="font-display text-h1 font-normal text-cream">
              Four movements, from bean to bar.
            </h2>
          </div>
          <ol className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map((movement) => (
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

      {/* ========================= CLUB CTA ========================== */}
      <section
        aria-labelledby="home-club"
        className="mx-auto my-16 max-w-[1240px] px-5 sm:px-8 lg:my-[88px]"
      >
        <div className="relative grid items-center gap-8 overflow-hidden rounded-[24px] p-6 text-cream shadow-float sm:rounded-[28px] sm:p-14 lg:grid-cols-[1.1fr_.9fr] kk-grain bg-[linear-gradient(135deg,var(--color-cocoa),var(--color-cocoa-deep))]">
          <div
            aria-hidden="true"
            className="absolute -top-12 right-[100px] h-44 w-44 rounded-pill bg-gold-soft/15 blur-[8px]"
          />
          <div className="relative">
            <div className="mb-4">
              <Eyebrow tone="gold">The Chocolate Club</Eyebrow>
            </div>
            <h2
              id="home-club"
              className="mb-4 font-display text-h2 font-normal text-balance text-cream lg:text-h1"
            >
              A new tasting box, every month.
            </h2>
            <p className="max-w-[400px] font-body text-[15.5px] leading-[1.6] text-[#E4D3BC]">
              Curated seasonal selections, members-only releases, and free
              shipping. Pause or cancel anytime.
            </p>
          </div>
          <div className="relative">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </main>
  );
}
