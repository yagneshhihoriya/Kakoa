"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import type { ApiResult, ProductVariantView } from "@kakoa/core";
import { formatPaise } from "@kakoa/core";
import { Button, Chip, Price, cx } from "@kakoa/ui";
import { QtyStepper, useToast } from "@kakoa/ui/client";
import { addToBag } from "@/lib/catalog/actions";

/** Contract default cart range cap (PROJECT_PLAN §2.3 merge cap is 20). */
const MAX_QTY = 20;

type StockMap = Record<string, { inStock: boolean; stockLow: boolean }>;

/**
 * Live stock never comes from the ISR payload (module spec edge case #1):
 * 'loading' until the uncached POST /api/stock resolves; 'failed' keeps the
 * CTA enabled (fail-open for UX — checkout re-verifies, fail-closed for money).
 */
type LiveStock = "loading" | "failed" | StockMap;

export interface PdpPurchasePanelProps {
  productName: string;
  /** Active variants, position order, exactly one `isDefault`. */
  variants: ProductVariantView[];
  /** `store_settings.gift_wrap_fee_paise` — null renders a degraded note. */
  giftWrapFeePaise: number | null;
  /** `store_settings.free_shipping_threshold_paise`. */
  freeShippingThresholdPaise: number | null;
}

/**
 * PDP purchase island — variant Chip group (default preselected, price
 * swaps on selection), qty stepper (1–20), live-stock hydration, and the
 * add-to-bag CTA posting to the Cart-module stub Server Action.
 */
export function PdpPurchasePanel({
  productName,
  variants,
  giftWrapFeePaise,
  freeShippingThresholdPaise,
}: PdpPurchasePanelProps): ReactNode {
  const { toast } = useToast();
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

  const handleAdd = (): void => {
    startTransition(async () => {
      const result = await addToBag({ variantId: selected.id, qty });
      if (!result.ok) {
        toast({ kind: "info", message: result.error.message });
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Price — selected variant, compare-at strikethrough via <Price>. */}
      <div className="flex flex-col gap-1">
        <Price
          paise={selected.pricePaise}
          compareAtPaise={selected.compareAtPricePaise ?? undefined}
          size="lg"
        />
        <p className="font-body text-xs text-espresso">
          MRP inclusive of all taxes · Net quantity {selected.weightGrams} g
        </p>
      </div>

      {/* Variant selector — net quantity beside each name (Legal Metrology). */}
      <fieldset className="flex flex-col gap-2">
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

      {/* Live stock line — never rendered from the ISR payload. */}
      <p
        aria-live="polite"
        className={cx(
          "font-body text-sm",
          live === null && "text-espresso",
          live !== null && soldOut && "text-danger",
          live !== null && !soldOut && live.stockLow && "text-caramel",
          live !== null && !soldOut && !live.stockLow && "text-success",
        )}
      >
        {liveStock === "loading"
          ? "Checking availability…"
          : liveStock === "failed"
            ? " "
            : soldOut
              ? "Just sold out"
              : live !== null && live.stockLow
                ? "Only a few left"
                : "In stock"}
      </p>

      {/* Qty + CTA */}
      <div className="flex flex-wrap items-center gap-3">
        <QtyStepper
          value={qty}
          min={1}
          max={MAX_QTY}
          label={`Quantity of ${productName}`}
          disabled={soldOut}
          onChange={(nextQty) => {
            setQty(Math.min(MAX_QTY, Math.max(1, nextQty)));
          }}
        />
        <Button
          variant="primary"
          size="lg"
          loading={isPending}
          disabled={soldOut}
          onClick={handleAdd}
          className="flex-1"
        >
          {soldOut ? "Just sold out" : "Add to bag"}
        </Button>
      </div>

      {/* Policy notes from store_settings (read-only here). */}
      <ul className="flex flex-col gap-1 font-body text-sm text-espresso">
        <li>
          {giftWrapFeePaise !== null
            ? `Gift wrapping available at ${formatPaise(giftWrapFeePaise)} per box — add it in your bag.`
            : "Gift wrapping available — add it in your bag."}
        </li>
        {freeShippingThresholdPaise !== null ? (
          <li>
            Free shipping on orders over{" "}
            {formatPaise(freeShippingThresholdPaise)}.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
