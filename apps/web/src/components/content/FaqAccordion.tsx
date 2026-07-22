"use client";

import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";
import { cx } from "@kakoa/ui";
import { CONTENT_FOCUS_RING } from "@/components/content/ContentPageShell";

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqCategory {
  category: string;
  items: FaqItem[];
}

export interface FaqAccordionProps {
  /** Server-built, policy-grounded dataset (see support/page.tsx). */
  categories: FaqCategory[];
}

/** Chevron that rotates when its accordion row is open — matches PdpDetails. */
function Chevron({ open }: { open: boolean }): ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx(
        "shrink-0 text-espresso transition-transform duration-[var(--duration-base)] ease-brand motion-reduce:transition-none",
        open && "rotate-180",
      )}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** A single collapsible Q/A row — LCC-style: serif title + chevron, hairline. */
function AccordionItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}): ReactNode {
  const panelId = useId();
  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 py-3.5 text-left font-display text-[19px] leading-tight text-ink transition-colors hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-[21px]"
        >
          {question}
          <Chevron open={open} />
        </button>
      </h3>
      {open ? (
        <div
          id={panelId}
          className="animate-[kk-rise_.28s_var(--ease-entrance)] pb-6"
        >
          <p className="max-w-[62ch] font-body text-[15.5px] leading-[1.75] whitespace-pre-line text-ink-soft">
            {answer}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Stable per-item key that survives filtering (category + question text). */
function itemKey(category: string, question: string): string {
  return `${category}::${question}`;
}

/**
 * Client-side Help/FAQ accordion with a live case-insensitive search that
 * filters questions + answers across every category. Reuses the exact PdpDetails
 * AccordionItem interaction (aria-expanded + aria-controls + rotating chevron +
 * border-b border-line + kk-rise reveal). Each row toggles independently.
 */
export function FaqAccordion({ categories }: FaqAccordionProps): ReactNode {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (key: string): void =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const needle = query.trim().toLowerCase();

  const filtered = useMemo<FaqCategory[]>(() => {
    if (needle === "") return categories;
    return categories
      .map((group) => ({
        category: group.category,
        items: group.items.filter(
          (item) =>
            item.q.toLowerCase().includes(needle) ||
            item.a.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, needle]);

  const hasResults = filtered.some((group) => group.items.length > 0);

  return (
    <div>
      <div className="relative">
        <SearchIcon />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help — shipping, melting, refunds…"
          aria-label="Search the help centre"
          className={cx(
            "w-full rounded-[16px] border border-line-soft bg-surface py-3.5 pr-4 pl-11 font-body text-[15.5px] text-ink placeholder:text-ink-muted",
            "transition-colors focus-visible:border-gold",
            CONTENT_FOCUS_RING,
          )}
        />
      </div>

      {hasResults ? (
        <div className="mt-10 flex flex-col gap-11">
          {filtered.map((group) => (
            <section key={group.category} aria-label={group.category}>
              <h2 className="mb-1 font-mono text-[12px] font-semibold tracking-[0.14em] text-espresso uppercase">
                {group.category}
              </h2>
              <div className="border-t border-line">
                {group.items.map((item) => {
                  const key = itemKey(group.category, item.q);
                  return (
                    <AccordionItem
                      key={key}
                      question={item.q}
                      answer={item.a}
                      open={open[key] ?? false}
                      onToggle={() => toggle(key)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-[20px] border border-line-soft bg-cream-2 px-6 py-12 text-center">
          <p className="font-display text-[22px] leading-snug text-ink">
            No answers matched
          </p>
          <p className="mx-auto mt-2 max-w-[42ch] font-body text-[15px] leading-[1.7] text-ink-soft">
            Try another word, or{" "}
            <Link
              href="/contact"
              className={cx(
                "font-semibold text-espresso underline underline-offset-2 hover:text-ink",
                "rounded-sm",
                CONTENT_FOCUS_RING,
              )}
            >
              contact us
            </Link>{" "}
            — we usually reply within a business day.
          </p>
        </div>
      )}
    </div>
  );
}

/** Magnifying-glass affordance inside the search field. */
function SearchIcon(): ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
