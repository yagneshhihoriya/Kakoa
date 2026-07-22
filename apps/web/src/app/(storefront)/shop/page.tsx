import type { Metadata, Route } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ProductListInput, ProductSort } from "@kakoa/core";
import { productListInputSchema } from "@kakoa/core";
import { EmptyState, cx } from "@kakoa/ui";
import { getCategories, getProducts } from "@/lib/catalog/queries";
import { ProductCard } from "@/components/catalog/ProductCard";
import { SortDropdown } from "@/components/catalog/SortDropdown";
import { getDefaultVariantIds } from "./default-variants";

/** Shop grid page size (contract allows 1–48). */
const PAGE_SIZE = 12;

/** Max page buttons in the pagination strip (reference shows a short run). */
const PAGE_WINDOW = 5;

type ShopSearchParams = Record<string, string | string[] | undefined>;

interface ShopPageProps {
  searchParams: Promise<ShopSearchParams>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Parse searchParams through the contract schema (`.strict()`, defaults
 * applied). Malformed params degrade to the default listing rather than
 * erroring — bad URLs are a browse page, not an API surface.
 */
function parseShopParams(params: ShopSearchParams): ProductListInput {
  const raw: Record<string, string> = { pageSize: String(PAGE_SIZE) };
  const category = first(params.category);
  const sort = first(params.sort);
  const page = first(params.page);
  const q = first(params.q);
  if (category !== undefined && category !== "") raw.category = category;
  if (sort !== undefined && sort !== "") raw.sort = sort;
  if (page !== undefined && page !== "") raw.page = page;
  if (q !== undefined && q !== "") raw.q = q;

  const parsed = productListInputSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return productListInputSchema.parse({ pageSize: String(PAGE_SIZE) });
}

/** Build a /shop URL, omitting defaults so canonical URLs stay clean. */
function shopHref(next: {
  category?: string | undefined;
  sort?: ProductSort | undefined;
  page?: number | undefined;
  q?: string | undefined;
}): Route {
  const qs = new URLSearchParams();
  if (next.category !== undefined) qs.set("category", next.category);
  if (next.sort !== undefined && next.sort !== "featured") {
    qs.set("sort", next.sort);
  }
  if (next.page !== undefined && next.page > 1) {
    qs.set("page", String(next.page));
  }
  if (next.q !== undefined && next.q !== "") qs.set("q", next.q);
  const query = qs.toString();
  return (query === "" ? "/shop" : `/shop?${query}`) as Route;
}

/** Filter chip rendered as a link — navigation, not client state. */
function ChipLink({
  href,
  selected,
  children,
}: {
  href: Route;
  selected: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-pill border px-[18px] font-body text-[13px] font-semibold whitespace-nowrap transition-[colors,transform] duration-[var(--duration-fast)] ease-brand",
        "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none",
        selected
          ? "border-ink bg-ink text-cream shadow-soft"
          : "border-line-soft bg-surface text-ink hover:-translate-y-px hover:border-espresso/40 hover:bg-card",
      )}
    >
      {children}
    </Link>
  );
}

/** Sliding window of page numbers centred on the current page. */
function pageWindow(current: number, totalPages: number): number[] {
  const start = Math.max(
    1,
    Math.min(current - Math.floor(PAGE_WINDOW / 2), totalPages - PAGE_WINDOW + 1),
  );
  const end = Math.min(totalPages, start + PAGE_WINDOW - 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/** Circular 40px pagination cell — reference pagination strip. */
const PAGE_CELL_BASE =
  "grid h-10 w-10 place-items-center rounded-pill font-body text-sm";
const PAGE_CELL_LINK = cx(
  PAGE_CELL_BASE,
  "border border-line-soft bg-surface text-ink shadow-soft transition-colors hover:border-espresso/40 hover:bg-card",
  "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none",
);

export async function generateMetadata({
  searchParams,
}: ShopPageProps): Promise<Metadata> {
  const params = await searchParams;
  const categorySlug = first(params.category);
  if (categorySlug !== undefined && categorySlug !== "") {
    const categories = await getCategories();
    const category = categories.find((c) => c.slug === categorySlug);
    if (category !== undefined) {
      return {
        title: category.name,
        description:
          category.description ??
          `Shop ${category.name} — small-batch bean-to-bar chocolate, crafted in India.`,
        // Canonical without the volatile ?page — page 1 of the (filtered)
        // listing is the indexable URL; deeper pages consolidate to it.
        alternates: {
          canonical: shopHref({ category: categorySlug }) as string,
        },
      };
    }
  }
  return {
    title: "Shop",
    description:
      "Shop small-batch bean-to-bar chocolate — bars, pralines, signature collections, and gifts.",
    alternates: { canonical: "/shop" },
  };
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const input = parseShopParams(params);
  const [categories, { products, total }] = await Promise.all([
    getCategories(),
    getProducts(input),
  ]);
  const defaultVariantIds = await getDefaultVariantIds(
    products.map((product) => product.id),
  );

  const activeCategory = categories.find((c) => c.slug === input.category);
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));

  // Clamp an out-of-range ?page to the last real page instead of rendering a
  // misleading empty state that also drops the pagination strip. Redirect so
  // the URL and canonical stay honest (and crawlers don't index ghost pages).
  // `input.page` is already ≥1 (schema coerces), but guard both ends anyway.
  const clampedPage = Math.min(Math.max(1, input.page), totalPages);
  if (clampedPage !== input.page) {
    redirect(
      shopHref({
        category: input.category,
        sort: input.sort,
        q: input.q,
        page: clampedPage,
      }),
    );
  }

  const rangeStart = total === 0 ? 0 : (input.page - 1) * input.pageSize + 1;
  const rangeEnd = Math.min(total, input.page * input.pageSize);
  const hasFilters =
    input.category !== undefined ||
    input.q !== undefined ||
    input.sort !== "featured" ||
    input.page > 1;
  const pages = pageWindow(input.page, totalPages);

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 pt-7 pb-[72px] md:px-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 font-body text-[13px] font-medium text-ink-muted"
      >
        <Link
          href="/"
          className="transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
        >
          Home
        </Link>
        <span aria-hidden="true">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
        <span className="text-ink" aria-current="page">
          {activeCategory?.name ?? "Collection"}
        </span>
      </nav>

      {/* Page header — eyebrow + serif title + sub, sort dropdown right-aligned */}
      <div className="mb-2 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-3 flex items-center gap-3 font-mono text-eyebrow font-medium text-espresso uppercase">
            <span aria-hidden="true" className="inline-block h-px w-[30px] bg-espresso" />
            {activeCategory !== undefined ? "Collection" : "Shop all"}
          </div>
          <h1 className="mb-3 font-display text-h1 font-normal text-ink">
            {activeCategory?.name ?? "The Collection"}
          </h1>
          <p className="max-w-[52ch] font-body text-lead text-ink-soft">
            {activeCategory?.description ??
              `${total} chocolate${total === 1 ? "" : "s"}, all made by hand this week.`}
          </p>
        </div>
        <SortDropdown value={input.sort} />
      </div>

      {/* Filter chip row */}
      <nav
        aria-label="Filter by collection"
        className="-mx-6 mt-6 px-6 md:mx-0 md:px-0"
      >
        <ul className="flex gap-2 overflow-x-auto pb-1">
          <li>
            <ChipLink
              href={shopHref({ sort: input.sort, q: input.q })}
              selected={input.category === undefined}
            >
              All
            </ChipLink>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <ChipLink
                href={shopHref({
                  category: category.slug,
                  sort: input.sort,
                  q: input.q,
                })}
                selected={input.category === category.slug}
              >
                {category.name}
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Result count */}
      <p
        className="mt-6 mb-4 font-body text-[13px] text-ink-muted"
        aria-live="polite"
      >
        {total === 0
          ? "0 chocolates"
          : `Showing ${rangeStart}–${rangeEnd} of ${total} chocolate${total === 1 ? "" : "s"}`}
        {input.q !== undefined ? ` for “${input.q}”` : ""}
      </p>

      {/* Grid / empty state */}
      {products.length > 0 ? (
        <ul className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
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
          title="No chocolates match"
          description={
            hasFilters
              ? "Try clearing your filters — the good stuff is one tap away."
              : "New chocolates land here soon — check back shortly."
          }
          cta={{ label: "Reset filters", href: "/shop" }}
        />
      )}

      {/* Pagination — circular strip per reference */}
      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-12 flex items-center justify-center gap-2"
        >
          {input.page > 1 ? (
            <Link
              href={shopHref({
                category: input.category,
                sort: input.sort,
                q: input.q,
                page: input.page - 1,
              })}
              rel="prev"
              aria-label="Previous page"
              className={PAGE_CELL_LINK}
            >
              <span aria-hidden="true">‹</span>
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className={cx(
                PAGE_CELL_BASE,
                "border border-line-soft text-ink-muted",
              )}
            >
              ‹
            </span>
          )}

          {pages.map((page) =>
            page === input.page ? (
              <span
                key={page}
                aria-current="page"
                className={cx(PAGE_CELL_BASE, "bg-ink font-bold text-card shadow-soft")}
              >
                {page}
              </span>
            ) : (
              <Link
                key={page}
                href={shopHref({
                  category: input.category,
                  sort: input.sort,
                  q: input.q,
                  page,
                })}
                aria-label={`Page ${page}`}
                className={PAGE_CELL_LINK}
              >
                {page}
              </Link>
            ),
          )}

          {input.page < totalPages ? (
            <Link
              href={shopHref({
                category: input.category,
                sort: input.sort,
                q: input.q,
                page: input.page + 1,
              })}
              rel="next"
              aria-label="Next page"
              className={PAGE_CELL_LINK}
            >
              <span aria-hidden="true">›</span>
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className={cx(
                PAGE_CELL_BASE,
                "border border-line-soft text-ink-muted",
              )}
            >
              ›
            </span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
