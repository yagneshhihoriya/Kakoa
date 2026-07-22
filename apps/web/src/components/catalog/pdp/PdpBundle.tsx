"use client";

import { Fragment, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import type { ProductTone } from "@kakoa/core";
import { formatPaise } from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { useCart } from "@/components/cart/CartProvider";
import { ChocoPlaceholder } from "../ChocoPlaceholder";

/** One frequently-bought-together product beside the main PDP product. */
export interface PdpBundleItem {
  id: string;
  slug: string;
  name: string;
  tone: ProductTone;
  imageUrl: string | null;
  fromPricePaise: number;
  /** Null ⇒ no addable variant; the tile is shown but cannot be included. */
  defaultVariantId: string | null;
}

export interface PdpBundleProps {
  main: {
    id: string;
    name: string;
    tone: ProductTone;
    imageUrl: string | null;
    defaultVariantId: string | null;
    pricePaise: number;
  };
  /** Non-empty FBT list — the page only renders this band when there are items. */
  items: PdpBundleItem[];
}

/** Shared focus-visible ring for the interactive band affordances. */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream-2";

/**
 * A single square product tile: real image when present, else the tone
 * gradient fallback (mirrors ProductCard). Used for the anchor main tile and
 * each FBT tile; the FBT variant layers the include checkbox + PDP link.
 */
function BundleImage({
  tone,
  imageUrl,
  name,
}: {
  tone: ProductTone;
  imageUrl: string | null;
  name: string;
}): ReactNode {
  if (imageUrl !== null) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-[18px] bg-cream-2">
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="120px"
          className="object-cover"
        />
      </div>
    );
  }
  return <ChocoPlaceholder tone={tone} ratio="1 / 1" className="rounded-[18px]!" />;
}

/**
 * Actionable "Frequently bought together" band (Feature C). Renders the whole
 * rounded card: the anchor main tile (always included, not toggleable), a "+"
 * separator, then each FBT tile with an include checkbox (checked by default,
 * unless the item has no addable variant). A live bundle total and a single
 * primary "Add N items · ₹total" pill add the main default variant plus every
 * checked item to the cart, then open the drawer once.
 */
export function PdpBundle({ main, items }: PdpBundleProps): ReactNode {
  const { addItem, openDrawer } = useCart();
  const [isPending, startTransition] = useTransition();

  // Items with an addable variant are checkable; null-variant items start
  // unchecked and can never be toggled on.
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of items) {
      initial[item.id] = item.defaultVariantId !== null;
    }
    return initial;
  });

  const toggle = (id: string): void => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const checkedItems = useMemo(
    () =>
      items.filter(
        (item) => item.defaultVariantId !== null && checked[item.id] === true,
      ),
    [items, checked],
  );

  const bundleTotalPaise =
    main.pricePaise +
    checkedItems.reduce((sum, item) => sum + item.fromPricePaise, 0);
  const bundleCount = 1 + checkedItems.length;

  const mainAddable = main.defaultVariantId !== null;

  const handleAdd = (): void => {
    if (!mainAddable) return;
    startTransition(async () => {
      // Add the main variant first, then each checked item — each suppresses
      // the drawer so it opens exactly once after all succeed. Null variants
      // are already excluded from `checkedItems`, but guard defensively.
      const mainVariantId = main.defaultVariantId;
      if (mainVariantId === null) return;
      const mainResult = await addItem(
        {
          variantId: mainVariantId,
          qty: 1,
          unitPricePaise: main.pricePaise,
        },
        { openDrawer: false },
      );
      let anyOk = mainResult.ok;

      for (const item of checkedItems) {
        const variantId = item.defaultVariantId;
        if (variantId === null) continue;
        const result = await addItem(
          {
            variantId,
            qty: 1,
            unitPricePaise: item.fromPricePaise,
          },
          { openDrawer: false },
        );
        anyOk = anyOk || result.ok;
      }

      if (anyOk) openDrawer();
    });
  };

  return (
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

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        {/* Tiles row — main anchor tile then each FBT tile with a "+" join. */}
        <div className="flex flex-wrap items-start gap-4">
          {/* Main product — always included, not toggleable. */}
          <div className="w-[120px]">
            <div className="mb-2">
              <BundleImage
                tone={main.tone}
                imageUrl={main.imageUrl}
                name={main.name}
              />
            </div>
            <p className="font-body text-[13px] font-semibold text-ink">
              {main.name}
            </p>
            <p className="font-body text-[13px] font-bold text-espresso">
              {formatPaise(main.pricePaise)}
            </p>
            <p className="mt-1 font-mono text-[10.5px] tracking-[0.08em] text-ink-muted uppercase">
              This item
            </p>
          </div>

          {items.map((item) => {
            const addable = item.defaultVariantId !== null;
            const isChecked = addable && checked[item.id] === true;
            return (
              <Fragment key={item.id}>
                <span
                  aria-hidden="true"
                  className="self-center pt-6 font-body text-2xl text-ink-muted"
                >
                  +
                </span>
                <div className="w-[120px]">
                  <div className="mb-2">
                    <BundleImage
                      tone={item.tone}
                      imageUrl={item.imageUrl}
                      name={item.name}
                    />
                  </div>
                  <p className="font-body text-[13px] font-semibold text-ink">
                    <Link
                      href={`/product/${item.slug}` as Route}
                      className={cx(
                        "rounded-[4px] transition-colors hover:text-espresso",
                        FOCUS_RING,
                      )}
                    >
                      {item.name}
                    </Link>
                  </p>
                  <p className="font-body text-[13px] font-bold text-espresso">
                    {formatPaise(item.fromPricePaise)}
                  </p>
                  {addable ? (
                    <label className="mt-2 flex cursor-pointer items-center gap-2 font-body text-[12.5px] text-ink-soft">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          toggle(item.id);
                        }}
                        aria-label={`Include ${item.name}`}
                        className={cx(
                          "h-4 w-4 shrink-0 cursor-pointer rounded-[4px] border border-line accent-ink",
                          FOCUS_RING,
                        )}
                      />
                      <span>Include</span>
                    </label>
                  ) : (
                    <label className="mt-2 flex items-center gap-2 font-body text-[12.5px] text-ink-muted">
                      <input
                        type="checkbox"
                        checked={false}
                        disabled
                        aria-label={`Include ${item.name}`}
                        className="h-4 w-4 shrink-0 cursor-not-allowed rounded-[4px] border border-line-soft opacity-50"
                      />
                      <span>Unavailable</span>
                    </label>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>

        {/* Bundle total + add-all pill. */}
        <div className="flex shrink-0 flex-col gap-3 lg:w-[240px] lg:items-end">
          <div className="lg:text-right">
            <p className="font-mono text-[11px] tracking-[0.12em] text-ink-muted uppercase">
              Bundle total
            </p>
            <p
              aria-live="polite"
              className="font-body text-[26px] leading-none font-bold text-ink"
            >
              {formatPaise(bundleTotalPaise)}
            </p>
          </div>
          <button
            type="button"
            aria-busy={isPending}
            disabled={!mainAddable || isPending}
            onClick={handleAdd}
            className={cx(
              "flex h-[52px] w-full items-center justify-center rounded-pill bg-ink px-6 lg:w-auto",
              "font-body text-[15px] font-bold whitespace-nowrap text-card",
              "shadow-lift transition-[transform,background-color] duration-[var(--duration-base)] ease-brand hover:-translate-y-0.5 hover:bg-cocoa motion-reduce:transform-none motion-reduce:transition-none",
              "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream-2 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
            )}
          >
            {isPending
              ? "Adding…"
              : !mainAddable
                ? "Unavailable"
                : `Add ${bundleCount} ${bundleCount === 1 ? "item" : "items"} · ${formatPaise(bundleTotalPaise)}`}
          </button>
        </div>
      </div>
    </section>
  );
}
