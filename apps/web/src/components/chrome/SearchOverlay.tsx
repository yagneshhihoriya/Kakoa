"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  formatPaise,
  type ProductCardView,
  type SearchHitView,
} from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { ChocoPlaceholder } from "@/components/catalog/ChocoPlaceholder";
import { useOverlay } from "./useOverlay";

const DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;
/** Exit-animation duration (must outlast the .24s CSS animation below). */
const CLOSE_MS = 260;

/** Static idle-state chips (prototype `searchPopular`). */
const POPULAR_SEARCHES = [
  "Dark chocolate",
  "Gift box",
  "Truffles",
  "Single origin",
  "Sea salt",
] as const;

/** Contract §2.1 envelope, narrowed to what this island reads. */
type Envelope<T> = { ok: true; data: T } | { ok: false };

const EYEBROW_CLASSES =
  "mb-3.5 font-mono text-xs font-medium uppercase tracking-[.16em] text-ink-muted";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

/** Stable DOM id for the result option at `index` (aria-activedescendant target). */
function optionId(index: number): string {
  return `kk-search-hit-${index}`;
}

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-width search sheet (prototype SEARCH OVERLAY): scrim + top slide-down
 * panel, serif jumbo input, idle state (popular chips + trending grid),
 * debounced (200ms) results list against GET /api/catalog/search, and a
 * no-results state. Client island — the rest of the page stays RSC.
 *
 * Dismissal is symmetric: the close button / scrim / Escape run through
 * `requestClose`, which plays a reverse slide-up + scrim fade before the public
 * `onClose` fires (instant under prefers-reduced-motion). Result hits are
 * keyboard-navigable (Arrow/Enter) with a listbox/aria-activedescendant model.
 */
export function SearchOverlay({ open, onClose }: SearchOverlayProps): ReactNode {
  const [query, setQuery] = useState("");
  /** `null` = idle (no completed fetch for the current query). */
  const [results, setResults] = useState<SearchHitView[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [trending, setTrending] = useState<ProductCardView[]>([]);
  /** Highlighted result for keyboard nav; -1 = none (Enter → goToShop). */
  const [activeIndex, setActiveIndex] = useState(-1);
  /** Drives the exit animation; the panel unmounts once it settles. */
  const [closing, setClosing] = useState(false);
  const trendingRequested = useRef(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // Latest `onClose` without re-binding closures baked into timers/callbacks.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closingRef = useRef(false);
  closingRef.current = closing;
  const closeTimer = useRef<number | null>(null);

  /** Fire the real `onClose` once and tear down the exit timer. */
  const finishClose = useCallback((): void => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    closingRef.current = false;
    setClosing(false);
    onCloseRef.current();
  }, []);

  /**
   * Public-facing close: plays the reverse animation, then calls `onClose`.
   * Under prefers-reduced-motion it closes instantly (no `closing` state, so
   * the neutralised exit animation never has to fire an `animationend`).
   */
  const requestClose = useCallback((): void => {
    if (closingRef.current) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onCloseRef.current();
      return;
    }
    closingRef.current = true;
    setClosing(true);
    // Fallback in case `animationend` is missed (e.g. tab backgrounded).
    closeTimer.current = window.setTimeout(finishClose, CLOSE_MS);
  }, [finishClose]);

  // Scroll-lock / Escape / focus-trap / focus-restore — Escape routes through
  // `requestClose` so keyboard dismissal animates like the pointer paths.
  useOverlay(open, requestClose, panelRef, inputRef);

  // Reset transient UI whenever the sheet (re)opens.
  useEffect(() => {
    if (!open) return;
    closingRef.current = false;
    setClosing(false);
    setActiveIndex(-1);
    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [open]);

  // A fresh query invalidates any highlighted hit.
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `#${optionId(activeIndex)}`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  /** Enter / "view all" → funnel the query into the full /shop?q= results. */
  function goToShop(): void {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return;
    onClose();
    router.push(`/shop?q=${encodeURIComponent(q)}` as Route);
  }

  /** Open a specific hit (keyboard Enter parity with the pointer Link path). */
  function openHit(hit: SearchHitView): void {
    onClose();
    router.push(`/product/${hit.slug}` as Route);
  }

  // Trending strip — fetched once, on first open (top catalog products).
  useEffect(() => {
    if (!open || trendingRequested.current) return;
    trendingRequested.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/catalog/products?pageSize=3", {
          signal: controller.signal,
        });
        const body = (await res.json()) as Envelope<{
          products: ProductCardView[];
        }>;
        if (body.ok) setTrending(body.data.products.slice(0, 3));
      } catch {
        /* trending is decorative — fail silent */
      }
    })();
    return () => {
      controller.abort();
    };
  }, [open]);

  // Debounced search — 200ms, aborts stale requests.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/catalog/search?q=${encodeURIComponent(q)}&limit=8`,
            { signal: controller.signal },
          );
          const body = (await res.json()) as Envelope<{
            results: SearchHitView[];
          }>;
          setResults(body.ok ? body.data.results : []);
          setSearching(false);
        } catch {
          if (!controller.signal.aborted) {
            setResults([]);
            setSearching(false);
          }
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  if (!open) return null;

  const trimmed = query.trim();
  const idle = trimmed.length < MIN_QUERY_LENGTH;
  const shownResults = idle ? [] : (results ?? []);
  const hasResults = shownResults.length > 0;
  const noResults = !idle && !searching && results !== null && results.length === 0;

  function handleInputKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ): void {
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = shownResults[activeIndex];
      if (hit !== undefined) {
        openHit(hit);
      } else {
        goToShop();
      }
      return;
    }
    if (!hasResults) return;
    const count = shownResults.length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % count);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
    }
  }

  const activeDescendant =
    hasResults && activeIndex >= 0 && activeIndex < shownResults.length
      ? optionId(activeIndex)
      : undefined;

  const scrimClass = closing
    ? "animate-[kk-overlay_.24s_ease_forwards_reverse] motion-reduce:animate-none"
    : "animate-[kk-overlay_.25s_ease] motion-reduce:animate-none";
  const panelClass = closing
    ? "animate-[kk-sheetdown_.24s_cubic-bezier(.4,0,1,1)_forwards_reverse] motion-reduce:animate-none"
    : "animate-[kk-sheetdown_.32s_cubic-bezier(.2,.7,.3,1)] motion-reduce:animate-none";

  return (
    <>
      <div
        aria-hidden="true"
        onClick={requestClose}
        className={cx("fixed inset-0 z-[70] bg-ink/[.42]", scrimClass)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search products"
        tabIndex={-1}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) finishClose();
        }}
        className={cx(
          "fixed inset-x-0 top-0 z-[71] flex max-h-[90vh] flex-col bg-cream shadow-[0_24px_60px_rgba(42,29,18,.26)] focus-visible:outline-none",
          panelClass,
        )}
      >
        <div className="mx-auto w-full max-w-[900px] px-8 pt-6 pb-1.5 max-[680px]:px-[18px]">
          <div className="flex items-center gap-3.5 border-b-2 border-ink pb-3.5">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-espresso)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.2-3.2" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              onKeyDown={handleInputKeyDown}
              enterKeyHint="search"
              placeholder="Search chocolates, gifts, collections…"
              aria-label="Search chocolates, gifts, collections"
              role="combobox"
              aria-expanded={hasResults}
              aria-controls={hasResults ? "kk-search-results" : undefined}
              aria-activedescendant={activeDescendant}
              className="min-w-0 flex-1 border-none bg-transparent font-display text-[clamp(20px,3.4vw,28px)] text-ink outline-none placeholder:text-ink/40"
            />
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close search"
              className={cx(
                "h-[38px] w-[38px] flex-none rounded-pill bg-cream-2 text-[17px] text-ink transition-colors hover:bg-line",
                FOCUS_RING,
              )}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[900px] overflow-auto px-8 pt-[18px] pb-8 max-[680px]:px-[18px]">
          {idle ? (
            <>
              <div className={EYEBROW_CLASSES}>Popular searches</div>
              <div className="mb-7 flex flex-wrap gap-2.5">
                {POPULAR_SEARCHES.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setQuery(label);
                    }}
                    className={cx(
                      "rounded-pill border border-line bg-card px-[18px] py-2.5 font-body text-sm font-semibold text-ink transition-colors hover:bg-line",
                      FOCUS_RING,
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {trending.length > 0 ? (
                <>
                  <div className={EYEBROW_CLASSES}>Trending now</div>
                  <div className="grid grid-cols-3 gap-3.5 max-[680px]:grid-cols-2">
                    {trending.map((product) => (
                      <Link
                        key={product.id}
                        href={`/product/${product.slug}`}
                        onClick={onClose}
                        className={cx(
                          "flex items-center gap-3 rounded-[14px] border border-line-soft bg-surface p-2.5 no-underline transition-colors hover:border-espresso",
                          FOCUS_RING,
                        )}
                      >
                        <div className="relative w-12 flex-none overflow-hidden rounded-[9px]">
                          <ChocoPlaceholder tone={product.tone} ratio="6 / 7" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-body text-sm font-semibold text-ink">
                            {product.name}
                          </div>
                          <div className="font-body text-[13px] font-semibold text-espresso">
                            {formatPaise(product.fromPricePaise)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {hasResults ? (
            <>
              <div aria-live="polite" className={EYEBROW_CLASSES}>
                {searching
                  ? "Searching…"
                  : `${shownResults.length} result${shownResults.length === 1 ? "" : "s"} for “${trimmed}”`}
              </div>
              <div
                ref={listRef}
                id="kk-search-results"
                role="listbox"
                aria-label={`Search results for ${trimmed}`}
                className="flex flex-col gap-2"
              >
                {shownResults.map((hit, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <Link
                      key={hit.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={isActive}
                      href={`/product/${hit.slug}`}
                      onClick={onClose}
                      onMouseEnter={() => {
                        setActiveIndex(index);
                      }}
                      className={cx(
                        "flex items-center gap-4 rounded-[14px] border px-3.5 py-3 no-underline transition-colors hover:border-espresso",
                        isActive
                          ? "border-espresso bg-cream-2"
                          : "border-line-soft bg-surface",
                        FOCUS_RING,
                      )}
                    >
                      <div className="relative w-[52px] flex-none overflow-hidden rounded-[10px]">
                        <ChocoPlaceholder tone={hit.tone} ratio="13 / 15" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-body text-base font-semibold text-ink">
                          {hit.name}
                        </div>
                        <div className="truncate text-[13px] text-ink-soft">
                          {hit.blurb}
                        </div>
                      </div>
                      <div className="flex-none text-right">
                        <div className="font-body text-[15px] font-semibold text-ink">
                          {formatPaise(hit.fromPricePaise)}
                        </div>
                        <div className="font-mono text-xs font-medium text-ink-muted">
                          {hit.categorySlug}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={goToShop}
                className={cx(
                  "mt-3 flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-line-soft bg-card px-4 py-3 font-body text-[14px] font-semibold text-ink transition-colors hover:bg-line",
                  FOCUS_RING,
                )}
              >
                View all results for “{trimmed}” <span aria-hidden="true">→</span>
              </button>
            </>
          ) : null}

          {!idle && !hasResults && !noResults ? (
            <div aria-live="polite" className={EYEBROW_CLASSES}>
              Searching…
            </div>
          ) : null}

          {noResults ? (
            <div className="px-5 py-12 text-center">
              <div className="mb-2 font-display text-2xl text-ink">
                No matches for “{trimmed}”
              </div>
              <div className="mb-[22px] text-[14.5px] text-ink-soft">
                Try a different word, or browse the full collection.
              </div>
              <Link
                href="/shop"
                onClick={onClose}
                className={cx(
                  "inline-block rounded-pill bg-ink px-[26px] py-[13px] font-body text-[14.5px] font-semibold text-card no-underline transition-colors hover:bg-ink-hover",
                  FOCUS_RING,
                )}
              >
                Browse all chocolate
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
