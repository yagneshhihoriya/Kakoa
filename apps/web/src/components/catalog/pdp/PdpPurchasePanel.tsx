"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { ApiResult, ProductVariantView } from "@kakoa/core";
import { formatPaise } from "@kakoa/core";
import { Chip, cx } from "@kakoa/ui";
import { QtyStepper } from "@kakoa/ui/client";
import { useCart } from "@/components/cart/CartProvider";
import { useAddedToBag } from "@/components/cart/AddedToBagSheet";
import { WishlistHeartButton } from "@/components/auth/WishlistHeartButton";

/** Contract default cart range cap (PROJECT_PLAN §2.3 merge cap is 20). */
const MAX_QTY = 20;

/** MOBILE breakpoint mirror — matches Tailwind `<sm` (< 640px). */
function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 639px)").matches
  );
}

type StockMap = Record<string, { inStock: boolean; stockLow: boolean }>;

/**
 * Live stock never comes from the ISR payload (module spec edge case #1):
 * 'loading' until the uncached POST /api/stock resolves; 'failed' keeps the
 * CTA enabled (fail-open for UX — checkout re-verifies, fail-closed for money).
 */
type LiveStock = "loading" | "failed" | StockMap;

export interface PdpPurchasePanelProps {
  /** Product id for the auth-gated wishlist heart. */
  productId: string;
  productName: string;
  /** Active variants, position order, exactly one `isDefault`. */
  variants: ProductVariantView[];
}

/**
 * PDP purchase island, prototype composition: price row (bold 30px price +
 * compare-at + per-gram note), variant Chip group, live-stock line, then the
 * qty pill stepper + full-width "Add to bag · ₹…" pill + wishlist icon
 * button row, and the caramel "Buy it now" pill below.
 *
 * Add-to-bag posts to the Cart module's `addToCart` Server Action and opens
 * the cart drawer on success (`useCart().openDrawer()`).
 */
export function PdpPurchasePanel({
  productId,
  productName,
  variants,
}: PdpPurchasePanelProps): ReactNode {
  const { addItem } = useCart();
  const { show: showAddedSheet } = useAddedToBag();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [qty, setQty] = useState(1);
  const [selectedId, setSelectedId] = useState<string>(() => {
    const fallback = variants[0];
    return (variants.find((v) => v.isDefault) ?? fallback)?.id ?? "";
  });
  const [liveStock, setLiveStock] = useState<LiveStock>("loading");

  const variantIds = useMemo(() => variants.map((v) => v.id), [variants]);
  const selected =
    variants.find((v) => v.id === selectedId) ?? variants[0] ?? null;

  // LiveStock island: one uncached POST on mount for ALL variants — the
  // per-variant states then swap client-side on selection (spec §5.6).
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ variantIds }),
      signal: controller.signal,
    })
      .then(
        (response) =>
          response.json() as Promise<ApiResult<{ stock: StockMap }>>,
      )
      .then((result) => {
        setLiveStock(result.ok ? result.data.stock : "failed");
      })
      .catch(() => {
        // Fail-open: button stays enabled; server re-verifies at add/placement.
        setLiveStock("failed");
      });
    return () => {
      controller.abort();
    };
  }, [variantIds]);

  if (selected === null) return null;

  /** Live truth for the selected variant. Absent id ⇒ treated as sold out. */
  const live =
    liveStock === "loading" || liveStock === "failed"
      ? null
      : (liveStock[selected.id] ?? { inStock: false, stockLow: false });
  const soldOut = live !== null && !live.inStock;

  /** Integer paise per gram (display only — single formatPaise render path). */
  const perGramPaise = Math.max(
    1,
    Math.round(selected.pricePaise / selected.weightGrams),
  );
  const lineTotalPaise = selected.pricePaise * qty;

  /**
   * Optimistic add via CartProvider. On MOBILE (< sm) we suppress the drawer
   * and show the shared "Added to your bag" sheet instead, so the PDP add is
   * consistent with the card add. On desktop the cart drawer opens as before.
   */
  const handleAdd = (): void => {
    const mobile = isMobileViewport();
    startTransition(async () => {
      // Provider handles reconcile + rollback toast on ApiErr. Pass the live
      // unit price so a first-add bumps the subtotal, not just the badge.
      const result = await addItem(
        {
          variantId: selected.id,
          qty,
          unitPricePaise: selected.pricePaise,
        },
        { openDrawer: !mobile },
      );
      if (result.ok && mobile) {
        showAddedSheet({ productName, qty });
      }
    });
  };

  /** Prototype "Buy it now" — silent add (no drawer), straight to checkout. */
  const handleBuyNow = (): void => {
    startTransition(async () => {
      const result = await addItem(
        {
          variantId: selected.id,
          qty,
          unitPricePaise: selected.pricePaise,
        },
        { openDrawer: false },
      );
      if (result.ok) {
        router.push("/checkout");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Price row — bold 30px price, compare-at strike, per-gram note. */}
      <div className="flex flex-col gap-1">
        <p className="flex items-baseline gap-3">
          <data
            value={selected.pricePaise}
            className="font-body text-[30px] leading-none font-bold text-ink"
          >
            {formatPaise(selected.pricePaise)}
          </data>
          {selected.compareAtPricePaise !== null &&
          selected.compareAtPricePaise > selected.pricePaise ? (
            <s
              aria-label={`Original price ${formatPaise(selected.compareAtPricePaise)}`}
              className="font-body text-[17px] text-ink-muted"
            >
              {formatPaise(selected.compareAtPricePaise)}
            </s>
          ) : null}
        </p>
        <p className="font-body text-[13px] text-ink-muted">
          {formatPaise(perGramPaise)} per gram · Net quantity{" "}
          {selected.weightGrams} g · MRP inclusive of all taxes
        </p>
      </div>

      {/* Variant selector — net quantity beside each name (Legal Metrology). */}
      {variants.length > 1 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="font-mono text-xs tracking-[0.14em] text-espresso uppercase">
            Choose a size
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <Chip
                key={variant.id}
                selected={variant.id === selected.id}
                onClick={() => {
                  setSelectedId(variant.id);
                }}
              >
                {variant.name} · {variant.weightGrams} g
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* Live stock line — never rendered from the ISR payload. */}
      <p
        aria-live="polite"
        className={cx(
          "-my-2 font-body text-sm",
          live === null && "text-espresso",
          live !== null && soldOut && "text-danger",
          live !== null && !soldOut && live.stockLow && "text-caramel",
          live !== null && !soldOut && !live.stockLow && "text-success",
        )}
      >
        {liveStock === "loading"
          ? "Checking availability…"
          : liveStock === "failed"
            ? " "
            : soldOut
              ? "Just sold out"
              : live !== null && live.stockLow
                ? "Only a few left"
                : "In stock — ships in 1–2 days"}
      </p>

      {/* Qty pill + Add-to-bag pill + wishlist icon button (prototype row). */}
      <div className="flex items-center gap-3">
        <QtyStepper
          value={qty}
          min={1}
          max={MAX_QTY}
          label={`Quantity of ${productName}`}
          disabled={soldOut}
          onChange={(nextQty) => {
            setQty(Math.min(MAX_QTY, Math.max(1, nextQty)));
          }}
          className="h-[54px] shrink-0 border-line-soft bg-surface px-1"
        />
        <button
          type="button"
          aria-busy={isPending}
          disabled={soldOut || isPending}
          onClick={handleAdd}
          className={cx(
            "flex h-[54px] flex-1 items-center justify-center rounded-pill bg-ink px-6",
            "font-body text-[15.5px] font-bold whitespace-nowrap text-card",
            "shadow-lift transition-[transform,background-color] duration-[var(--duration-base)] ease-brand hover:-translate-y-0.5 hover:bg-cocoa motion-reduce:transform-none",
            "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
          )}
        >
          {isPending
            ? "Adding…"
            : soldOut
              ? "Just sold out"
              : `Add to bag · ${formatPaise(lineTotalPaise)}`}
        </button>
        <WishlistHeartButton
          productId={productId}
          productName={productName}
          iconSize={20}
          className={cx(
            "grid h-[54px] w-[54px] shrink-0 place-items-center rounded-pill border border-line-soft bg-surface text-espresso shadow-soft transition-colors hover:bg-card",
            "focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          )}
        />
      </div>

      {/* Buy it now — caramel pill, full width (prototype). */}
      <button
        type="button"
        disabled={soldOut || isPending}
        onClick={handleBuyNow}
        className={cx(
          "-mt-2 h-[54px] w-full rounded-pill bg-gold-soft px-6 font-body text-[15.5px] font-bold text-ink shadow-soft transition-colors hover:bg-[#f0d6ac]",
          "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        Buy it now
      </button>
    </div>
  );
}
