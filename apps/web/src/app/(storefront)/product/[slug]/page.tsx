import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ProductDetailView } from "@kakoa/core";
import { formatPaise } from "@kakoa/core";
import { StarRating } from "@kakoa/ui";
import { absoluteUrl } from "@/lib/seo/site";
import {
  getCatalogSettings,
  getCategories,
  getCompanyInfo,
  getProductBySlug,
} from "@/lib/catalog/queries";
import { ChocoPlaceholder } from "@/components/catalog/ChocoPlaceholder";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PdpGallery } from "@/components/catalog/pdp/PdpGallery";
import { PdpPurchasePanel } from "@/components/catalog/pdp/PdpPurchasePanel";
import { PdpDetails } from "@/components/catalog/pdp/PdpDetails";
import { PdpReviews } from "@/components/catalog/pdp/PdpReviews";
import { Reveal } from "@/components/catalog/pdp/Reveal";

/** ISR: tag-driven purges (`product:{slug}`) + 5-min time fallback. */
export const revalidate = 300;

/** The 10 Phase-0 seeded slugs (packages/db/src/seed.ts) — prebuilt at deploy. */
const SEEDED_SLUGS = [
  "midnight-72-dark",
  "sea-salt-caramel-bar",
  "roasted-hazelnut-crunch",
  "madagascar-85-single-origin",
  "truffle-noir",
  "pistachio-praline-collection",
  "salted-caramel-pralines",
  "raspberry-ganache-squares",
  "single-origin-tasting-library",
  "kakoa-celebration-hamper",
] as const;

export function generateStaticParams(): { slug: string }[] {
  return SEEDED_SLUGS.map((slug) => ({ slug }));
}

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (product === null) {
    return { title: "Product not found" };
  }
  const ogImage =
    product.imageUrl !== null
      ? product.imageUrl.startsWith("http")
        ? product.imageUrl
        : absoluteUrl(product.imageUrl)
      : null;
  return {
    title: product.name,
    description: product.blurb,
    alternates: { canonical: `/product/${slug}` },
    openGraph: {
      title: `${product.name} · Kakao`,
      description: product.blurb,
      type: "website",
      siteName: "Kakao",
      url: `/product/${slug}`,
      ...(ogImage !== null ? { images: [{ url: ogImage, alt: product.name }] } : {}),
    },
    ...(ogImage !== null
      ? { twitter: { card: "summary_large_image", images: [ogImage] } }
      : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Product JSON-LD (docs/modules/content-blog-seo.md rules)            */
/* ------------------------------------------------------------------ */

/**
 * `offers.price` must be `"499.00"` (content-blog-seo.md edge case #4):
 * derived from the single `formatPaise()` render path, with the currency
 * symbol and Indian grouping stripped — never float math.
 */
function jsonLdPrice(paise: number): string {
  return formatPaise(paise).replace(/[₹,]/g, "");
}

/** Every `<` unicode-escaped so `</script>` in catalog strings can't break out. */
function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildProductJsonLd(product: ProductDetailView, slug: string): string {
  const defaultVariant =
    product.variants.find((v) => v.isDefault) ?? product.variants[0];
  // Emit Product + BreadcrumbList in one @graph so a single script tag carries
  // both (content-blog-seo.md §5): the breadcrumb mirrors the visual
  // Home / Shop / {name} trail below.
  return serializeJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: product.blurb,
        ...(defaultVariant !== undefined ? { sku: defaultVariant.sku } : {}),
        brand: { "@type": "Brand", name: "Kakao" },
        offers: {
          "@type": "Offer",
          priceCurrency: "INR",
          price: jsonLdPrice(
            defaultVariant?.pricePaise ?? product.fromPricePaise,
          ),
          availability: product.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
        },
        // aggregateRating is emitted only once ≥1 approved review exists
        // (content-blog-seo.md edge case #3).
        ...(product.ratingCount > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: product.ratingAvg.toFixed(1),
                reviewCount: product.ratingCount,
              },
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Shop", item: absoluteUrl("/shop") },
          {
            "@type": "ListItem",
            position: 3,
            name: product.name,
            item: absoluteUrl(`/product/${slug}`),
          },
        ],
      },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Server-rendered blocks                                              */
/* ------------------------------------------------------------------ */

/** Shared focus treatment for bespoke (non-`Button`) interactive elements. */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [product, settings, categories] = await Promise.all([
    getProductBySlug(slug),
    getCatalogSettings().catch(() => ({
      freeShippingThresholdPaise: null,
      giftWrapFeePaise: null,
      codEnabled: false,
    })),
    getCategories().catch(() => []),
  ]);
  if (product === null) notFound();

  const company = await getCompanyInfo().catch(() => null);
  const countryOfOrigin = company?.countryOfOrigin ?? "India";

  const categoryName =
    categories.find((c) => c.slug === product.categorySlug)?.name ??
    product.categorySlug;

  /** Legal Metrology net-quantity line — every active variant. */
  const netQuantities = product.variants
    .map((v) => `${v.weightGrams} g (${v.name})`)
    .join(" · ");

  /** "What you'll get" — admin copy (attributes.whatYoullGet) or a graceful default. */
  const whatYoullGet =
    product.whatYoullGet ??
    "Freshly made in small batches and packed ready to enjoy or gift. Every order ships cold and insulated so it arrives in perfect condition.";

  /** FBT bundle math — default-variant price + the smallest size of each. */
  const defaultVariant =
    product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const activePricePaise = defaultVariant?.pricePaise ?? product.fromPricePaise;
  const bundleTotalPaise = product.frequentlyBoughtTogether.reduce(
    (sum, item) => sum + item.fromPricePaise,
    activePricePaise,
  );

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 pt-7 pb-[72px] md:px-8">
      <script
        type="application/ld+json"
        // Serialized with every `<` unicode-escaped (content-blog-seo.md §6) — safe.
        dangerouslySetInnerHTML={{ __html: buildProductJsonLd(product, slug) }}
      />

      {/* Breadcrumb — reference `Home / Collection / {name}` */}
      <nav
        aria-label="Breadcrumb"
        className="mb-[26px] font-body text-[13px] font-medium text-ink-muted"
      >
        <ol className="flex flex-wrap items-center">
          <li>
            <Link
              href="/"
              className="rounded-sm transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
            >
              Home
            </Link>
          </li>
          <li aria-hidden="true">
            <span>&nbsp;&nbsp;/&nbsp;&nbsp;</span>
          </li>
          <li>
            <Link
              href="/shop"
              className="rounded-sm transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
            >
              Collection
            </Link>
          </li>
          <li aria-hidden="true">
            <span>&nbsp;&nbsp;/&nbsp;&nbsp;</span>
          </li>
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      {/* Gallery + info two-col grid (reference 1.05fr/.95fr, 56px gap).
          `grid-cols-1` (= minmax(0,1fr)) keeps the single mobile column from
          blowing out to max-content when a child has wide min-content. */}
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
        <div className="lg:sticky lg:top-[98px]">
          <PdpGallery
            tone={product.tone}
            name={product.name}
            images={product.images.map((i) => ({ url: i.url, alt: i.alt }))}
          />
        </div>

        <div>
          {/* Eyebrow — category (+ badge tag when present) */}
          <div className="mb-3 flex items-center gap-3 font-mono text-eyebrow font-medium text-espresso uppercase">
            <span aria-hidden="true" className="inline-block h-px w-[26px] bg-espresso" />
            {categoryName}
            {product.badge !== null ? ` · ${product.badge}` : ""}
          </div>

          <h1 className="mb-3 font-display text-h1 font-normal text-ink">
            {product.name}
          </h1>

          {/* Rating summary — smooth-scrolls to the reviews section (LCC). */}
          <a
            href="#reviews"
            aria-label="Read the reviews"
            className="group mb-6 inline-flex w-fit items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <StarRating value={product.ratingAvg} size="sm" />
            <span className="font-body text-[13px] text-ink-soft underline-offset-2 transition-colors group-hover:text-ink group-hover:underline">
              {product.ratingCount === 0
                ? "No reviews yet — write one"
                : `${product.ratingAvg.toFixed(1)} · ${product.ratingCount} review${product.ratingCount === 1 ? "" : "s"}`}
            </span>
          </a>

          {/* Price row + variant chips + live stock + qty/add/wishlist */}
          <PdpPurchasePanel
            productId={product.id}
            productName={product.name}
            variants={product.variants}
          />

          {/* Details — LCC-style accordions, in the info column below Add to bag:
              Product Description / What You'll Get / Ingredients & nutrition / Shipping */}
          <PdpDetails
            description={product.description}
            whatYoullGet={whatYoullGet}
            shippingInfo={product.shippingInfo}
            freeShippingThresholdPaise={settings.freeShippingThresholdPaise}
            giftWrapFeePaise={settings.giftWrapFeePaise}
            codEnabled={settings.codEnabled}
            ingredients={product.ingredients}
            allergens={product.allergens}
            nutritionFacts={product.nutritionFacts}
            isVeg={product.isVeg}
            netQuantities={netQuantities}
            countryOfOrigin={countryOfOrigin}
            shelfLifeDays={product.shelfLifeDays}
            storageInstructions={product.storageInstructions}
            fssaiLicense={product.fssaiLicense}
          />
        </div>
      </div>

      {/* Frequently bought together — reference `#F6EEE1` band. Degrades to
          omission when the co-occurrence query returned []. */}
      {product.frequentlyBoughtTogether.length > 0 ? (
        <Reveal index={2} className="mt-16">
          <section
            aria-labelledby="pdp-fbt"
            className="rounded-[24px] border border-line-soft bg-cream-2 p-6 shadow-card sm:p-9"
          >
            <h2
              id="pdp-fbt"
              className="mb-6 font-display text-h2 font-normal text-ink"
            >
              Frequently bought together
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              {/* This product — anchor tile, not a link. */}
              <div className="w-[120px]">
                <div className="mb-2 overflow-hidden rounded-[18px]">
                  <ChocoPlaceholder tone={product.tone} ratio="1 / 1" />
                </div>
                <p className="font-body text-[13px] font-semibold text-ink">
                  {product.name}
                </p>
                <p className="font-body text-[13px] font-bold text-espresso">
                  {formatPaise(activePricePaise)}
                </p>
              </div>

              {product.frequentlyBoughtTogether.map((item) => (
                <Fragment key={item.id}>
                  <span
                    aria-hidden="true"
                    className="font-body text-2xl text-ink-muted"
                  >
                    +
                  </span>
                  <Link
                    href={`/product/${item.slug}`}
                    className={`group w-[120px] rounded-[18px] ${FOCUS_RING}`}
                  >
                    <span className="mb-2 block overflow-hidden rounded-[18px]">
                      <ChocoPlaceholder tone={item.tone} ratio="1 / 1" />
                    </span>
                    <span className="block font-body text-[13px] font-semibold text-ink group-hover:underline">
                      {item.name}
                    </span>
                    <span className="block font-body text-[13px] font-bold text-espresso">
                      {formatPaise(item.fromPricePaise)}
                    </span>
                  </Link>
                </Fragment>
              ))}

              <div className="ml-auto text-right">
                <p className="mb-0.5 font-body text-[13px] text-ink-soft">
                  Bundle total
                </p>
                <p className="font-body text-2xl font-bold text-ink">
                  {formatPaise(bundleTotalPaise)}
                </p>
              </div>
            </div>
          </section>
        </Reveal>
      ) : null}

      {/* Related — reference 4-grid; omitted entirely when degraded to []. */}
      {product.related.length > 0 ? (
        <Reveal index={3} className="mt-16">
          <section aria-labelledby="pdp-related">
            <h2
              id="pdp-related"
              className="mb-6 font-display text-h2 font-normal text-ink"
            >
              You may also like
            </h2>
            <ul className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
              {product.related.map((card) => (
                <li key={card.id}>
                  <ProductCard product={card} className="h-full" />
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      ) : null}

      {/* Reviews — full section at the very bottom (id="reviews"); the rating
          summary under the title smooth-scrolls here. */}
      <PdpReviews
        productId={product.id}
        ratingAvg={product.ratingAvg}
        ratingCount={product.ratingCount}
        reviews={product.reviews}
      />
    </main>
  );
}
