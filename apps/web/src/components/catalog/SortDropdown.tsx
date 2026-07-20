"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ProductSort } from "@kakoa/core";
import { PRODUCT_SORTS } from "@kakoa/core";
import { cx } from "@kakoa/ui";

/** Exhaustive — a new contract sort value without a label fails `tsc`. */
const SORT_LABELS = {
  featured: "Featured",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  rating: "Top rated",
} satisfies Record<ProductSort, string>;

/**
 * Custom sort dropdown for the Shop toolbar — prototype collection screen
 * (pill trigger with muted "Sort" prefix, rotating chevron, floating panel
 * with per-option check). Selection pushes the sort into the URL — the
 * server component re-renders the grid; page resets to 1.
 *
 * Closes on outside click and Escape (focus returns to the trigger).
 */
export function SortDropdown({ value }: { value: ProductSort }): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (
        rootRef.current !== null &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (sort: ProductSort): void => {
    setOpen(false);
    const next = new URLSearchParams(searchParams);
    if (sort === "featured") {
      next.delete("sort");
    } else {
      next.set("sort", sort);
    }
    next.delete("page");
    const qs = next.toString();
    router.push(qs === "" ? "/shop" : `/shop?${qs}`);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={cx(
          "relative z-[41] flex min-h-11 min-w-[150px] cursor-pointer items-center gap-[9px] rounded-pill border border-line-soft bg-surface py-[11px] pr-[15px] pl-[17px] font-body text-[13.5px] font-semibold text-ink shadow-soft transition-colors hover:border-espresso/40",
          "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none",
        )}
      >
        <span className="text-[12.5px] font-medium text-ink-muted">Sort</span>
        <span className="flex-1 text-left">{SORT_LABELS[value]}</span>
        <svg
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className={cx(
            "flex-none text-espresso transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Sort products"
          className="absolute top-[calc(100%+8px)] right-0 z-40 min-w-[238px] rounded-[16px] border border-line-soft bg-surface p-[6px] shadow-lift"
        >
          {PRODUCT_SORTS.map((sort) => {
            const active = sort === value;
            return (
              <button
                key={sort}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  pick(sort);
                }}
                className={cx(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] py-[11px] pr-3 pl-[14px] text-left font-body text-[13.5px] font-semibold text-ink transition-colors hover:bg-[#F7EFE2]",
                  "focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                  active && "bg-[#F7EFE2]",
                )}
              >
                <span>{SORT_LABELS[sort]}</span>
                {active ? (
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    className="flex-none text-espresso"
                  >
                    <path d="M5 12l5 5L19 7" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
