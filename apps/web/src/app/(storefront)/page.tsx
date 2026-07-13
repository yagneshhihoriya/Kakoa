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

/** Shared focus treatment for bespoke (non-`Button`) interactive elements. */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

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

      {/* HERO */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-16 px-8 pt-16 pb-[76px] lg:min-h-[74vh] lg:grid-cols-[1.06fr_.94fr]">
        <div>
          <div className="mb-[26px] flex items-center gap-[13px] font-mono text-xs font-medium tracking-[0.24em] text-espresso uppercase">
            <span
              aria-hidden="true"
              className="inline-block h-px w-[30px] bg-espresso"
            />
            Small-batch · Single origin
          </div>
          <h1 className="mb-[26px] font-display text-5xl leading-[0.97] font-normal tracking-[-0.018em] text-balance sm:text-7xl lg:text-[86px]">
            Chocolate worth
            <br />
            slowing down
            <br />
            <span className="text-espresso italic">for.</span>
          </h1>
          <p className="mb-8 max-w-[440px] text-[17px] leading-[1.6] text-[#5C4B3A]">
            Ethically sourced cacao, roasted in-house and finished by hand.
            Tasting notes you can actually taste — no shortcuts, no fillers.
          </p>
          <div className="mb-8 flex flex-wrap gap-3.5">
            <Link
              href="/shop"
              className={`rounded-pill bg-ink px-[30px] py-4 font-body text-[15.5px] font-bold text-card shadow-[0_10px_26px_rgba(42,29,18,.22)] transition-[background-color,transform] hover:-translate-y-px hover:bg-[#3f2c1b] motion-reduce:transform-none ${FOCUS_RING}`}
            >
              Shop the collection
            </Link>
            <Link
              href="/about"
              className={`rounded-pill border-[1.5px] border-[rgba(42,29,18,.24)] px-[30px] py-4 font-body text-[15.5px] font-bold text-ink transition-colors hover:border-ink hover:bg-card ${FOCUS_RING}`}
            >
              Our story
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-[22px] text-[13.5px] text-[#6B5A49]">
            <div className="flex items-center gap-[7px]">
              <span aria-hidden="true" className="text-gold">✦</span>
              <span>
                <strong className="font-bold text-ink">Small-batch</strong> ·
                bean-to-bar
              </span>
            </div>
            <span aria-hidden="true" className="h-4 w-px bg-[#DCC9AE]" />
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
      </section>

      {/* CATEGORY STRIP */}
      {categories.length > 0 ? (
        <section
          aria-label="Shop by collection"
          className="mx-auto max-w-[1240px] px-8 pt-7 pb-5"
        >
          <ul className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
            {categories.map((category, index) => (
              <li key={category.id}>
                <Link
                  href={`/shop?category=${category.slug}`}
                  className={`group relative block overflow-hidden rounded-[18px] transition-transform duration-200 hover:-translate-y-[3px] motion-reduce:transform-none ${FOCUS_RING}`}
                >
                  <ChocoPlaceholder
                    tone={categoryTone(category.slug, index)}
                    ratio="1 / 1"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,10,4,.6),transparent_58%)]"
                  />
                  <div className="absolute bottom-3.5 left-4 text-cream">
                    <div className="font-display text-[22px] font-normal">
                      {category.name}
                    </div>
                    <div className="font-mono text-xs font-medium tracking-[0.1em] opacity-85">
                      {categoryCounts[index] ?? 0} pieces
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* BEST SELLERS */}
      <section
        aria-labelledby="home-featured"
        className="mx-auto max-w-[1240px] px-8 py-11"
      >
        <div className="mb-[26px] flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 font-mono text-xs font-medium tracking-[0.2em] text-espresso uppercase">
              Loved by many
            </div>
            <h2
              id="home-featured"
              className="font-display text-[40px] leading-none font-normal"
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
          <ul className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
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

      {/* VALUE PROPS */}
      <section aria-label="Why Kakao" className="bg-card">
        <ul className="mx-auto grid max-w-[1240px] gap-9 px-8 py-10 md:grid-cols-3">
          {VALUE_PROPS.map((prop) => (
            <li key={prop.title} className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="grid h-[46px] w-[46px] flex-none place-items-center rounded-md bg-ink text-xl text-[#e8c9a0]"
              >
                {prop.icon}
              </span>
              <div>
                <h3 className="mb-1 font-body text-base font-semibold text-ink">
                  {prop.title}
                </h3>
                <p className="text-sm leading-[1.5] text-[#5C4B3A]">
                  {prop.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* STORY BAND */}
      <section
        aria-labelledby="home-story"
        className="mx-auto grid max-w-[1240px] items-center gap-14 px-8 py-16 lg:grid-cols-[.95fr_1.05fr]"
      >
        <div className="relative aspect-[5/4] overflow-hidden rounded-[24px] shadow-[0_24px_60px_rgba(42,29,18,.2)]">
          <ChocoScene kind="story" />
        </div>
        <div>
          <div className="mb-4 font-mono text-xs font-medium tracking-[0.2em] text-espresso uppercase">
            Our story
          </div>
          <h2
            id="home-story"
            className="mb-5 font-display text-4xl leading-[1.06] font-normal sm:text-[44px]"
          >
            From bean to bar,
            <br />
            in our own hands.
          </h2>
          <p className="mb-[26px] max-w-[460px] text-base leading-[1.65] text-[#5C4B3A]">
            We started Kakao in a tiny kitchen with one conviction: great
            chocolate should taste of somewhere. Today we work directly with
            growers across four origins, and still roast every batch ourselves.
          </p>
          <Link
            href="/about"
            className={`inline-block rounded-pill border-[1.5px] border-[rgba(42,29,18,.24)] px-7 py-3.5 font-body text-[15px] font-bold text-ink transition-colors hover:border-ink hover:bg-card ${FOCUS_RING}`}
          >
            Read our story
          </Link>
        </div>
      </section>

      {/* SUBSCRIPTION CTA */}
      <section
        aria-labelledby="home-club"
        className="mx-auto mb-16 max-w-[1240px] px-8"
      >
        <div
          className="relative grid items-center gap-10 overflow-hidden rounded-[28px] p-8 text-card sm:p-14 lg:grid-cols-[1.1fr_.9fr]"
          style={{ background: "linear-gradient(135deg,#4a2e1c,#2c150a)" }}
        >
          <div
            aria-hidden="true"
            className="absolute -top-10 right-[120px] h-40 w-40 rounded-pill bg-[rgba(233,199,176,.16)]"
          />
          <div className="relative">
            <div className="mb-3.5 font-mono text-xs font-medium tracking-[0.2em] text-[#e8c9a0] uppercase">
              The Chocolate Club
            </div>
            <h2
              id="home-club"
              className="mb-3.5 font-display text-4xl leading-[1.05] font-normal sm:text-[40px]"
            >
              A new tasting box,
              <br />
              every month.
            </h2>
            <p className="max-w-[400px] text-[15.5px] leading-[1.6] text-[#E4D3BC]">
              Curated seasonal selections, members-only releases, and free
              shipping. Pause or cancel anytime.
            </p>
          </div>
          <NewsletterForm />
        </div>
      </section>
    </main>
  );
}
