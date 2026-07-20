import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ProductDetailView } from "@kakoa/core";
import { formatPaise } from "@kakoa/core";
import { StarRating, cx } from "@kakoa/ui";
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
import { PdpTabs } from "@/components/catalog/pdp/PdpTabs";
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

/** FSSAI square veg/non-veg mark (green = veg, brown = non-veg). */
function VegMark({ isVeg }: { isVeg: boolean }): ReactNode {
  return (
    <span
      role="img"
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
      className={cx(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center border-2 bg-cream",
        isVeg ? "border-success" : "border-cocoa",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "h-2.5 w-2.5 rounded-pill",
          isVeg ? "bg-success" : "bg-cocoa",
        )}
      />
    </span>
  );
}

/** 18px espresso-stroke line icon frame (reference meta card icons). */
function MetaIcon({ children }: { children: ReactNode }): ReactNode {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8a5a34"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
    >
      {children}
    </svg>
  );
}

/**
 * Meta list — reference `#F6EEE1` two-column card: ships-cold, the
 * free-shipping threshold + gift-wrap fee from `store_settings` (notes
 * degrade gracefully when a key is missing), and the COD note.
 */
function PdpMetaList({
  freeShippingThresholdPaise,
  giftWrapFeePaise,
  codEnabled,
}: {
  freeShippingThresholdPaise: number | null;
  giftWrapFeePaise: number | null;
  codEnabled: boolean;
}): ReactNode {
  return (
    <ul
      aria-label="Shipping and payment notes"
      className="mt-6 grid grid-cols-1 gap-x-5 gap-y-3.5 rounded-[18px] border border-line-soft bg-cream-2 px-5 py-4 shadow-soft sm:grid-cols-2"
    >
      <li className="flex items-center gap-2.5 font-body text-[13.5px] text-ink-soft">
        <MetaIcon>
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="m20 16-4-4 4-4" />
          <path d="m4 8 4 4-4 4" />
          <path d="m16 4-4 4-4-4" />
          <path d="m8 20 4-4 4 4" />
        </MetaIcon>
        Ships cold &amp; insulated
      </li>
      <li className="flex items-center gap-2.5 font-body text-[13.5px] text-ink-soft">
        <MetaIcon>
          <rect x="1" y="4" width="14" height="12" rx="1" />
          <path d="M15 8h4l3 3v5h-7z" />
          <circle cx="6" cy="18.5" r="2" />
          <circle cx="18" cy="18.5" r="2" />
        </MetaIcon>
        {freeShippingThresholdPaise !== null
          ? `Free shipping over ${formatPaise(freeShippingThresholdPaise)}`
          : "Pan-India insulated delivery"}
      </li>
      <li className="flex items-center gap-2.5 font-body text-[13.5px] text-ink-soft">
        <MetaIcon>
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </MetaIcon>
        {giftWrapFeePaise !== null
          ? `Gift wrap available · ${formatPaise(giftWrapFeePaise)}`
          : "Gift wrap available"}
      </li>
      {codEnabled ? (
        <li className="flex items-center gap-2.5 font-body text-[13.5px] text-ink-soft">
          <MetaIcon>
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="M6 12h.01" />
            <path d="M18 12h.01" />
          </MetaIcon>
          Cash on Delivery available
        </li>
      ) : null}
    </ul>
  );
}

/** Legal Metrology + FSSAI display block (module spec §1.6). */
function LegalMetrologyBlock({
  product,
  netQuantities,
}: {
  product: ProductDetailView;
  netQuantities: string;
}): ReactNode {
  return (
    <section
      aria-label="Legal Metrology and food safety information"
      className="mt-4 rounded-[18px] border border-line-soft px-5 py-4"
    >
      <div className="flex items-center gap-2.5">
        <VegMark isVeg={product.isVeg} />
        <p className="font-body text-[13px] font-semibold text-ink">
          {product.isVeg ? "Vegetarian" : "Non-vegetarian"} · MRP inclusive of
          all taxes
        </p>
      </div>
      <dl className="mt-3 flex flex-col gap-1.5 font-body text-[13px] text-ink-soft">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-semibold text-ink">Net quantity:</dt>
          <dd>{netQuantities}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-semibold text-ink">FSSAI Lic. No.:</dt>
          <dd>
            {product.fssaiLicense !== ""
              ? product.fssaiLicense
              : "Details temporarily unavailable"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

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

      {/* Gallery + info two-col grid (reference 1.05fr/.95fr, 56px gap) */}
      <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
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

          <h1 className="mb-3.5 font-display text-h1 font-normal text-ink">
            {product.name}
          </h1>

          <div className="mb-5 flex items-center gap-3">
            <StarRating value={product.ratingAvg} />
            <span className="font-body text-sm text-ink-soft">
              {product.ratingCount === 0
                ? "No reviews yet"
                : `${product.ratingAvg.toFixed(1)} · ${product.ratingCount} review${product.ratingCount === 1 ? "" : "s"}`}
            </span>
          </div>

          <p className="mb-6 max-w-[480px] font-body text-lead text-ink-soft">
            {product.blurb}
          </p>

          {/* Tasting notes — reference pill chips */}
          {product.tastingNotes.length > 0 ? (
            <div className="mb-[26px]">
              <h2 className="mb-3 font-mono text-xs font-semibold tracking-[0.14em] text-espresso uppercase">
                Tasting notes
              </h2>
              <ul className="flex flex-wrap gap-2">
                {product.tastingNotes.map((note) => (
                  <li
                    key={note}
                    className="rounded-pill border border-line-soft bg-card px-3.5 py-2 font-body text-[13px] font-medium text-ink-soft shadow-soft"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Product details from the vertical attribute schema (cocoa %, origin…) */}
          {product.pdpAttributes.length > 0 ? (
            <dl className="mb-[26px] grid grid-cols-2 gap-x-6 gap-y-2 max-[420px]:grid-cols-1">
              {product.pdpAttributes.map((attr) => (
                <div key={attr.label} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-1.5">
                  <dt className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                    {attr.label}
                  </dt>
                  <dd className="font-body text-[13.5px] text-ink">
                    {attr.value}{attr.unit !== null ? attr.unit : ""}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {/* Price row + variant chips + live stock + qty/add/wishlist + buy now */}
          <PdpPurchasePanel
            productId={product.id}
            productName={product.name}
            variants={product.variants}
          />

          <PdpMetaList
            freeShippingThresholdPaise={settings.freeShippingThresholdPaise}
            giftWrapFeePaise={settings.giftWrapFeePaise}
            codEnabled={settings.codEnabled}
          />

          <LegalMetrologyBlock product={product} netQuantities={netQuantities} />
        </div>
      </div>

      {/* Tabs — Description / Ingredients & Nutrition / Reviews */}
      <Reveal index={1} className="mt-16">
        <PdpTabs
          description={product.description}
          ingredients={product.ingredients}
          allergens={product.allergens}
          isVeg={product.isVeg}
          nutritionFacts={product.nutritionFacts}
          categoryName={categoryName}
          netQuantities={netQuantities}
          countryOfOrigin={countryOfOrigin}
          shelfLifeDays={product.shelfLifeDays}
          storageInstructions={product.storageInstructions}
          ratingAvg={product.ratingAvg}
          ratingCount={product.ratingCount}
          productId={product.id}
          reviews={product.reviews}
        />
      </Reveal>

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
    </main>
  );
}
