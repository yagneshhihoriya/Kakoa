"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { EmptyState, cx } from "@kakoa/ui";

const TABS = [
  { id: "description", label: "Description" },
  { id: "ingredients", label: "Ingredients & Allergens" },
  { id: "reviews", label: "Reviews" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export interface PdpTabsProps {
  /** Admin-authored copy — rendered as text nodes only (XSS rule, spec §6). */
  description: string;
  ingredients: string;
  allergens: string;
}

/**
 * PDP tabs — Description / Ingredients & Allergens / Reviews (empty state
 * until the Reviews module lands). Roving-focus tablist per WAI-ARIA.
 */
export function PdpTabs({
  description,
  ingredients,
  allergens,
}: PdpTabsProps): ReactNode {
  const [active, setActive] = useState<TabId>("description");
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === active);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    if (next !== undefined) {
      setActive(next.id);
      tabRefs.current.get(next.id)?.focus();
    }
  };

  return (
    <section aria-label="Product details">
      <div
        role="tablist"
        aria-label="Product information"
        onKeyDown={handleKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(node) => {
              if (node !== null) tabRefs.current.set(tab.id, node);
            }}
            type="button"
            role="tab"
            id={`pdp-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`pdp-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => {
              setActive(tab.id);
            }}
            className={cx(
              "-mb-px inline-flex min-h-11 items-center border-b-2 px-4 font-body text-sm font-medium whitespace-nowrap transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
              active === tab.id
                ? "border-ink text-ink"
                : "border-transparent text-espresso hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="pdp-panel-description"
        aria-labelledby="pdp-tab-description"
        hidden={active !== "description"}
        className="py-6"
      >
        <p className="max-w-prose font-body text-base leading-relaxed text-ink">
          {description}
        </p>
      </div>

      <div
        role="tabpanel"
        id="pdp-panel-ingredients"
        aria-labelledby="pdp-tab-ingredients"
        hidden={active !== "ingredients"}
        className="flex flex-col gap-4 py-6"
      >
        <div>
          <h3 className="mb-1 font-mono text-xs tracking-[0.14em] text-espresso uppercase">
            Ingredients
          </h3>
          <p className="max-w-prose font-body text-base leading-relaxed text-ink">
            {ingredients}
          </p>
        </div>
        <div>
          <h3 className="mb-1 font-mono text-xs tracking-[0.14em] text-espresso uppercase">
            Allergen statement
          </h3>
          <p className="max-w-prose font-body text-base leading-relaxed text-ink">
            {allergens}
          </p>
        </div>
      </div>

      <div
        role="tabpanel"
        id="pdp-panel-reviews"
        aria-labelledby="pdp-tab-reviews"
        hidden={active !== "reviews"}
        className="py-6"
      >
        <EmptyState
          title="No reviews yet"
          description="Reviews open after the first deliveries — verified buyers only."
          cta={{ label: "Explore the collection", href: "/shop" }}
        />
      </div>
    </section>
  );
}
