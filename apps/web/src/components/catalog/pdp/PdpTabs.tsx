"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { StarRating, cx } from "@kakoa/ui";

type TabId = "description" | "ingredients" | "reviews";

export interface PdpTabsProps {
  /** Admin-authored copy — rendered as text nodes only (XSS rule, spec §6). */
  description: string;
  ingredients: string;
  allergens: string;
  isVeg: boolean;
  /** Nullable per contract — the nutrition card is omitted when absent. */
  nutritionFacts: Record<string, string> | null;
  /** "At a glance" card data. */
  categoryName: string;
  netQuantities: string;
  shelfLifeDays: number | null;
  storageInstructions: string | null;
  ratingAvg: number;
  ratingCount: number;
}

/** Prototype key/value row — 14px, hairline #E6D6BE divider. */
function GlanceRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}): ReactNode {
  return (
    <div
      className={cx(
        "flex items-baseline justify-between gap-4 font-body text-sm",
        !last && "border-b border-[#E6D6BE] pb-2.5",
      )}
    >
      <span className="text-[#6B5A49]">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

/**
 * PDP tabs, prototype styling — Description / Ingredients & Nutrition /
 * Reviews (N): 32px tab gap, 2px ink underline on the active tab, and
 * two-column panels (copy left, `#F6EEE1` "At a glance"/nutrition card
 * right). Roving-focus tablist per WAI-ARIA.
 */
export function PdpTabs({
  description,
  ingredients,
  allergens,
  isVeg,
  nutritionFacts,
  categoryName,
  netQuantities,
  shelfLifeDays,
  storageInstructions,
  ratingAvg,
  ratingCount,
}: PdpTabsProps): ReactNode {
  const TABS = [
    { id: "description", label: "Description" },
    { id: "ingredients", label: "Ingredients & Nutrition" },
    { id: "reviews", label: `Reviews (${ratingCount})` },
  ] as const satisfies readonly { id: TabId; label: string }[];

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

  const nutritionEntries =
    nutritionFacts !== null ? Object.entries(nutritionFacts) : [];

  return (
    <section aria-label="Product details" className="border-t border-line pt-2">
      <div
        role="tablist"
        aria-label="Product information"
        onKeyDown={handleKeyDown}
        className="mb-8 flex gap-8 overflow-x-auto border-b border-line"
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
              "-mb-px inline-flex min-h-11 items-center border-b-2 px-0.5 py-4 font-body text-[15px] font-semibold whitespace-nowrap transition-colors",
              "focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
              active === tab.id
                ? "border-ink text-ink"
                : "border-transparent text-[#8a7a68] hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description — copy left, "At a glance" card right. */}
      <div
        role="tabpanel"
        id="pdp-panel-description"
        aria-labelledby="pdp-tab-description"
        hidden={active !== "description"}
      >
        <div className="grid max-w-[1000px] gap-8 md:grid-cols-[1.3fr_1fr] md:gap-12">
          <p className="font-body text-base leading-[1.75] whitespace-pre-line text-[#4C3B2A]">
            {description}
          </p>
          <div className="h-fit rounded-[18px] bg-[#F6EEE1] p-5">
            <h3 className="mb-4 font-mono text-[13px] font-semibold tracking-[0.12em] text-espresso uppercase">
              At a glance
            </h3>
            <div className="flex flex-col gap-3">
              <GlanceRow label="Collection" value={categoryName} />
              <GlanceRow label="Net quantity" value={netQuantities} />
              {shelfLifeDays !== null ? (
                <GlanceRow
                  label="Shelf life"
                  value={`${shelfLifeDays} days`}
                  last={storageInstructions === null}
                />
              ) : null}
              {storageInstructions !== null ? (
                <GlanceRow label="Storage" value={storageInstructions} last />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Ingredients & Nutrition. */}
      <div
        role="tabpanel"
        id="pdp-panel-ingredients"
        aria-labelledby="pdp-tab-ingredients"
        hidden={active !== "ingredients"}
      >
        <div className="grid max-w-[1000px] gap-8 md:grid-cols-[1.3fr_1fr] md:gap-12">
          <div>
            <h3 className="mb-3 font-body text-base font-semibold text-ink">
              Ingredients
            </h3>
            <p className="mb-6 font-body text-[15px] leading-[1.7] text-[#4C3B2A]">
              {ingredients}
            </p>
            <h3 className="mb-3 font-body text-base font-semibold text-ink">
              Allergens
            </h3>
            <p className="mb-6 font-body text-[15px] leading-[1.7] text-[#4C3B2A]">
              {allergens}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-pill bg-card px-3.5 py-2 font-body text-[12.5px] font-medium text-[#6B4A2E]">
                {isVeg ? "100% vegetarian" : "Non-vegetarian"}
              </span>
              <span className="rounded-pill bg-card px-3.5 py-2 font-body text-[12.5px] font-medium text-[#6B4A2E]">
                No palm oil
              </span>
              <span className="rounded-pill bg-card px-3.5 py-2 font-body text-[12.5px] font-medium text-[#6B4A2E]">
                No preservatives
              </span>
            </div>
          </div>
          {nutritionEntries.length > 0 ? (
            <div className="h-fit rounded-[18px] bg-[#F6EEE1] p-6">
              <h3 className="mb-4 font-mono text-[13px] font-semibold tracking-[0.12em] text-espresso uppercase">
                Nutrition · per 30 g
              </h3>
              <div className="flex flex-col gap-3">
                {nutritionEntries.map(([key, value], index) => (
                  <GlanceRow
                    key={key}
                    label={key}
                    value={value}
                    last={index === nutritionEntries.length - 1}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Reviews — rating summary left, list/empty state right (prototype). */}
      <div
        role="tabpanel"
        id="pdp-panel-reviews"
        aria-labelledby="pdp-tab-reviews"
        hidden={active !== "reviews"}
      >
        <div className="grid max-w-[1000px] gap-8 md:grid-cols-[280px_1fr] md:gap-12">
          <div>
            <p className="font-display text-[56px] leading-none text-ink">
              {ratingCount > 0 ? ratingAvg.toFixed(1) : "—"}
            </p>
            <StarRating value={ratingAvg} size="lg" className="my-2" />
            <p className="font-body text-sm text-[#6B5A49]">
              {ratingCount > 0
                ? `Based on ${ratingCount} review${ratingCount === 1 ? "" : "s"}`
                : "No reviews yet"}
            </p>
            <button
              type="button"
              disabled
              title="Reviews open after the first deliveries"
              className="mt-5 rounded-pill bg-ink px-[22px] py-3 font-body text-sm font-bold text-card disabled:cursor-not-allowed disabled:opacity-60"
            >
              Write a review
            </button>
          </div>
          <p className="max-w-prose font-body text-[15px] leading-[1.7] text-[#4C3B2A]">
            Reviews open after the first deliveries — verified buyers only, so
            every word comes from someone who has actually tasted the batch.
          </p>
        </div>
      </div>
    </section>
  );
}
