"use client";

import { useMemo, useState, type ReactNode } from "react";
import { StarRating, cx } from "@kakoa/ui";
import { ReviewComposer } from "./ReviewComposer";
import type { PdpReview } from "./PdpDetails";

export interface PdpReviewsProps {
  productId: string;
  ratingAvg: number;
  ratingCount: number;
  reviews: PdpReview[];
}

type SortKey = "recent" | "highest" | "lowest" | "oldest";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Most recent" },
  { key: "highest", label: "Highest rated" },
  { key: "lowest", label: "Lowest rated" },
  { key: "oldest", label: "Oldest first" },
];

const RATING_FILTERS: { value: number; label: string }[] = [
  { value: 0, label: "All ratings" },
  { value: 5, label: "5 stars" },
  { value: 4, label: "4 stars" },
  { value: 3, label: "3 stars" },
  { value: 2, label: "2 stars" },
  { value: 1, label: "1 star" },
];

const PAGE_SIZE = 5;

/** A single 5-point star (outer r≈9, pointing up) for the empty-state cluster. */
const STAR_PATH =
  "M0,-9 L2.02,-2.78 L8.56,-2.78 L3.27,1.06 L5.29,7.28 L0,3.44 L-5.29,7.28 L-3.27,1.06 L-8.56,-2.78 L-2.02,-2.78 Z";

/** Solid gold "Write a review" CTA — LCC's accent button, KAKOA gold. */
const WRITE_BTN =
  "rounded-pill bg-gold px-6 py-3 font-body text-[14px] font-bold text-ink shadow-soft " +
  "transition-[transform,background-color] duration-[var(--duration-fast)] ease-brand " +
  "hover:-translate-y-0.5 hover:bg-caramel active:translate-y-0 motion-reduce:transition-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

function formatReviewDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Up to two initials from a display name, for the reviewer avatar. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/* ---- Inline icons (currentColor, aria-hidden) --------------------------- */

function SearchIcon(): ReactNode {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }): ReactNode {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronLeft(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ThumbUp(): ReactNode {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3z" />
      <path d="M7 10l4.2-7a2 2 0 0 1 3.7 1.3L14 10h5a2 2 0 0 1 2 2.3l-1.2 6.5A2 2 0 0 1 16.8 21H7" />
    </svg>
  );
}

function CheckSeal(): ReactNode {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.4 1.8 3 .1 1 2.8 2.4 1.7-.9 2.9.9 2.9-2.4 1.7-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.2 15.6l.9-2.9-.9-2.9 2.4-1.7 1-2.8 3-.1L12 2z" />
      <path d="M10.6 14.6l-2-2 1.1-1.1.9.9 3-3 1.1 1.1-4.1 4.1z" fill="var(--color-cream)" />
    </svg>
  );
}

/* ---- Sub-components ----------------------------------------------------- */

/** Short gold section rule (LCC's accent divider above/below the block). */
function GoldRule(): ReactNode {
  return <span aria-hidden="true" className="mx-auto block h-[3px] w-9 rounded-pill bg-gold" />;
}

/** A styled <select> wrapped with a chevron (native arrow hidden). */
function SelectField({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-pill border border-line-soft bg-surface py-2 pl-4 pr-9 font-body text-[13px] font-medium text-ink shadow-soft outline-none transition-colors hover:border-line focus-visible:ring-2 focus-visible:ring-gold"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}

/**
 * Rating distribution bar (5★ → 1★). Bars are computed from the loaded review
 * window; the raw count is shown only when that window is the full set
 * (`showCount`) so the numbers never contradict the headline total.
 */
function DistroBar({
  star,
  count,
  total,
  showCount,
}: {
  star: number;
  count: number;
  total: number;
  showCount: boolean;
}): ReactNode {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 font-body text-[12.5px] text-ink-muted">
      <span className="flex w-8 items-center gap-1 tabular-nums">
        {star}
        <span aria-hidden="true" className="text-gold">★</span>
      </span>
      <span className="h-[7px] flex-1 overflow-hidden rounded-pill bg-line">
        <span className="block h-full rounded-pill bg-gold transition-[width] duration-[var(--duration-base)] ease-brand" style={{ width: `${pct}%` }} />
      </span>
      {showCount ? <span className="w-6 text-right tabular-nums">{count}</span> : null}
    </div>
  );
}

/** Verified-buyer pill — every KAKOA review is purchase-verified. */
function VerifiedBadge(): ReactNode {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-success/12 px-2 py-0.5 font-body text-[11px] font-semibold text-pistachio-deep">
      <CheckSeal />
      Verified Buyer
    </span>
  );
}

/** Reviewer avatar (initials on a warm disc). */
function Avatar({ name }: { name: string }): ReactNode {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-card font-body text-[14px] font-semibold text-espresso ring-1 ring-line-soft"
    >
      {initialsOf(name)}
    </span>
  );
}

/** "Was this review helpful?" — presentation-only vote (session-local). */
function HelpfulRow({
  vote,
  onVote,
}: {
  vote: "up" | "down" | undefined;
  onVote: (v: "up" | "down") => void;
}): ReactNode {
  const btn =
    "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 font-body text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 font-body text-[12.5px] text-ink-muted">
      <span>Was this review helpful?</span>
      <button
        type="button"
        aria-label="Yes, this review was helpful"
        aria-pressed={vote === "up"}
        onClick={() => onVote("up")}
        className={cx(btn, vote === "up" ? "border-gold bg-gold/10 text-ink" : "border-line-soft text-ink-soft hover:border-line")}
      >
        <ThumbUp />
        {vote === "up" ? 1 : 0}
      </button>
      <button
        type="button"
        aria-label="No, this review was not helpful"
        aria-pressed={vote === "down"}
        onClick={() => onVote("down")}
        className={cx(btn, vote === "down" ? "border-gold bg-gold/10 text-ink" : "border-line-soft text-ink-soft hover:border-line")}
      >
        <span className="rotate-180">
          <ThumbUp />
        </span>
        {vote === "down" ? 1 : 0}
      </button>
    </div>
  );
}

/** One review card — reviewer column + content column (stacks on mobile). */
function ReviewCard({
  review,
  vote,
  onVote,
}: {
  review: PdpReview;
  vote: "up" | "down" | undefined;
  onVote: (v: "up" | "down") => void;
}): ReactNode {
  return (
    <li className="border-b border-line-soft py-7 first:pt-6">
      <div className="grid gap-4 md:grid-cols-[176px_1fr] md:gap-8">
        {/* Reviewer */}
        <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-2.5">
          <Avatar name={review.author} />
          <div className="min-w-0">
            <p className="truncate font-body text-[14px] font-semibold text-ink">{review.author}</p>
            <span className="mt-1 inline-block">
              <VerifiedBadge />
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <StarRating value={review.rating} size="sm" />
              {review.title !== null && review.title !== "" ? (
                <p className="mt-1.5 font-body text-[15.5px] font-semibold leading-snug text-ink break-words">{review.title}</p>
              ) : null}
            </div>
            <time className="shrink-0 font-body text-[12.5px] text-ink-muted">{formatReviewDate(review.dateIso)}</time>
          </div>
          <p className="mt-2 whitespace-pre-line break-words font-body text-[14.5px] leading-[1.75] text-ink-soft">{review.body}</p>
          <HelpfulRow vote={vote} onVote={onVote} />
        </div>
      </div>
    </li>
  );
}

/** Numbered pagination with prev/next chevrons (LCC style). */
function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}): ReactNode {
  if (pageCount <= 1) return null;
  const nums = Array.from({ length: pageCount }, (_, i) => i + 1);
  const arrow =
    "flex h-9 w-9 items-center justify-center rounded-pill border border-line-soft text-ink-soft transition-colors hover:border-line disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
  return (
    <nav className="mt-9 flex items-center justify-center gap-1.5" aria-label="Reviews pagination">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page" className={arrow}>
        <ChevronLeft />
      </button>
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPage(n)}
          aria-current={n === page ? "page" : undefined}
          className={cx(
            "flex h-9 min-w-9 items-center justify-center rounded-pill px-3 font-body text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
            n === page ? "border border-ink font-bold text-ink" : "text-ink-soft hover:bg-card",
          )}
        >
          {n}
        </button>
      ))}
      <button type="button" onClick={() => onPage(page + 1)} disabled={page === pageCount} aria-label="Next page" className={cx(arrow, "rotate-180")}>
        <ChevronLeft />
      </button>
    </nav>
  );
}

/** Empty state — LCC "We're looking for stars!" with the first-review CTA. */
function EmptyState({ productId }: { productId: string }): ReactNode {
  return (
    <div className="flex flex-col items-center px-4 pb-2 pt-5 text-center">
      <svg width="78" height="64" viewBox="0 0 80 66" fill="none" aria-hidden="true" className="text-gold">
        {/* motion trails */}
        <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.4">
          <path d="M12 44 26 30" />
          <path d="M9 33 18 24" />
          <path d="M21 52 32 41" />
        </g>
        {/* three shooting stars, brightest to faintest */}
        <g fill="currentColor">
          <g transform="translate(31,25)">
            <path d={STAR_PATH} />
          </g>
          <g transform="translate(54,15) scale(0.78)">
            <path d={STAR_PATH} />
          </g>
          <g transform="translate(49,44) scale(0.6)">
            <path d={STAR_PATH} />
          </g>
        </g>
      </svg>
      <p className="mt-5 font-display text-[26px] leading-tight text-ink sm:text-[30px]">We&apos;re looking for stars!</p>
      <p className="mt-2 font-body text-[15px] text-ink-soft">Let us know what you think.</p>
      <div className="mt-6">
        <ReviewComposer productId={productId} triggerLabel="Be the first to write a review!" triggerClassName={WRITE_BTN} />
      </div>
      <div className="mt-7">
        <GoldRule />
      </div>
    </div>
  );
}

/**
 * PDP reviews — the full section at the very bottom of the product page, built
 * to match Lake Champlain Chocolates: a two-state experience anchored at
 * `#reviews` (the star summary under the title smooth-scrolls here). With
 * reviews → average + distribution + "Write a review" CTA, search / rating /
 * sort toolbar, review cards, and numbered pagination. Without reviews → an
 * elegant "We're looking for stars!" empty state. Presentation only — the
 * loaded review data, eligibility, and submission APIs are unchanged.
 */
export function PdpReviews({ productId, ratingAvg, ratingCount, reviews }: PdpReviewsProps): ReactNode {
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});

  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]; // index 0 = 1★ … 4 = 5★
    for (const r of reviews) {
      const i = Math.min(5, Math.max(1, r.rating)) - 1;
      buckets[i] = (buckets[i] ?? 0) + 1;
    }
    return buckets;
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((r) => {
      if (ratingFilter > 0 && r.rating !== ratingFilter) return false;
      if (q !== "") {
        const hay = `${r.title ?? ""} ${r.body} ${r.author}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reviews, query, ratingFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const byDateDesc = (a: PdpReview, b: PdpReview): number => (a.dateIso < b.dateIso ? 1 : -1);
    if (sort === "highest") list.sort((a, b) => b.rating - a.rating || byDateDesc(a, b));
    else if (sort === "lowest") list.sort((a, b) => a.rating - b.rating || byDateDesc(a, b));
    else if (sort === "oldest") list.sort((a, b) => (a.dateIso < b.dateIso ? -1 : 1));
    else list.sort(byDateDesc);
    return list;
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const isFiltered = query.trim() !== "" || ratingFilter > 0;

  const resetPage = (): void => setPage(1);
  const clearFilters = (): void => {
    setQuery("");
    setRatingFilter(0);
    setPage(1);
  };
  const vote = (id: string, v: "up" | "down"): void =>
    setVotes((prev) => (prev[id] === v ? (() => { const n = { ...prev }; delete n[id]; return n; })() : { ...prev, [id]: v }));

  const hasReviews = reviews.length > 0;
  // The list is capped server-side (≤24). When the loaded window is the whole
  // set, per-star counts + the "showing all" line are exact; otherwise show
  // proportional bars (no counts) and an honest "N of total" line.
  const distributionComplete = reviews.length === ratingCount;

  return (
    <section
      id="reviews"
      aria-label="Customer reviews"
      className={cx(
        "mx-auto max-w-[1180px] scroll-mt-28 px-5 sm:px-8",
        hasReviews ? "mt-12 pt-10 lg:mt-16" : "mt-4 pt-4 lg:mt-6",
      )}
    >
      <div className={cx("flex flex-col items-center gap-3 text-center", hasReviews ? "mb-8" : "mb-1")}>
        <GoldRule />
        <h2 className="font-display text-h2 font-normal text-ink">See What Customers Are Saying</h2>
      </div>

      {!hasReviews ? (
        <EmptyState productId={productId} />
      ) : (
        <>
          {/* Summary: average · distribution · write CTA */}
          <div className="grid gap-8 border-b border-line pb-9 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-12">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center gap-3 md:justify-start">
                <span className="font-display text-[52px] leading-none text-ink">{ratingAvg.toFixed(1)}</span>
                <StarRating value={ratingAvg} size="lg" />
              </div>
              <p className="mt-2 font-body text-[13px] text-ink-muted">
                {ratingCount} Review{ratingCount === 1 ? "" : "s"}
              </p>
            </div>

            <div className="mx-auto flex w-full max-w-[360px] flex-col gap-2 md:mx-0">
              {[5, 4, 3, 2, 1].map((star) => (
                <DistroBar
                  key={star}
                  star={star}
                  count={distribution[star - 1] ?? 0}
                  total={reviews.length}
                  showCount={distributionComplete}
                />
              ))}
            </div>

            <div className="flex justify-center md:justify-end">
              <ReviewComposer productId={productId} triggerLabel="Write A Review" triggerClassName={WRITE_BTN} />
            </div>
          </div>

          {/* Toolbar: search + rating filter · sort */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    resetPage();
                  }}
                  placeholder="Search reviews"
                  aria-label="Search reviews"
                  className="w-[190px] rounded-pill border border-line-soft bg-surface py-2 pl-9 pr-4 font-body text-[13px] text-ink shadow-soft outline-none transition-colors placeholder:text-ink-muted hover:border-line focus-visible:ring-2 focus-visible:ring-gold"
                />
              </div>
              <SelectField
                ariaLabel="Filter by rating"
                value={String(ratingFilter)}
                onChange={(v) => {
                  setRatingFilter(Number(v));
                  resetPage();
                }}
              >
                {RATING_FILTERS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <label className="flex items-center gap-2 font-body text-[13px] text-ink-muted">
              <span>Sort by</span>
              <SelectField ariaLabel="Sort reviews" value={sort} onChange={(v) => setSort(v as SortKey)}>
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>

          {/* Results line */}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
            <p className="font-body text-[13px] text-ink-muted">
              {isFiltered
                ? `We found ${sorted.length} matching review${sorted.length === 1 ? "" : "s"}`
                : reviews.length < ratingCount
                  ? `Showing ${reviews.length} of ${ratingCount} reviews`
                  : `Showing all ${reviews.length} review${reviews.length === 1 ? "" : "s"}`}
            </p>
            {isFiltered ? (
              <button
                type="button"
                onClick={clearFilters}
                className="font-body text-[13px] font-semibold text-espresso underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {/* List */}
          {sorted.length > 0 ? (
            <ul>
              {pageItems.map((r) => (
                <ReviewCard key={r.id} review={r} vote={votes[r.id]} onVote={(v) => vote(r.id, v)} />
              ))}
            </ul>
          ) : (
            <p className="py-12 text-center font-body text-[14.5px] text-ink-soft">
              No reviews match your filters.{" "}
              <button type="button" onClick={clearFilters} className="font-semibold text-espresso underline-offset-2 hover:underline">
                Clear filters
              </button>
            </p>
          )}

          <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </section>
  );
}
