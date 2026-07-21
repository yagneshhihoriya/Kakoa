"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { cx } from "@kakoa/ui";
import { useToast } from "@kakoa/ui/client";
import { ADD_TO_BAG_CLASSES } from "@/components/cart/add-to-bag-classes";
import { useCart } from "@/components/cart/CartProvider";
import { useAddedToBag } from "@/components/cart/AddedToBagSheet";

/** Optimistic label flip resets after this many ms (success path). */
const RESET_MS = 1800;

/** MOBILE breakpoint mirror — matches Tailwind `<sm` (< 640px, Feature B). */
const MOBILE_QUERY = "(max-width: 639px)";

/** True when the viewport is below the `sm` breakpoint (client-only guard). */
function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MOBILE_QUERY).matches
  );
}

export interface AddToBagButtonProps {
  /** Default variant id resolved server-side — one-tap add, qty 1. */
  variantId: string;
  productName: string;
  className?: string;
  /** Resting CTA label. Defaults to "Add" (card price-row pill). */
  label?: string;
}

/**
 * One-tap "Add" on the product card. Optimistic: the label flips to
 * "Added" immediately and the badge bumps via the provider; the server
 * action reconciles — success opens the drawer + toasts, failure reverts
 * the label and rolls the optimistic count back (provider toast).
 */
export function AddToBagButton({
  variantId,
  productName,
  className,
  label = "Add",
}: AddToBagButtonProps): ReactNode {
  const { toast } = useToast();
  const { addItem } = useCart();
  const { show: showAddedSheet } = useAddedToBag();
  const [, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetRef.current !== null) clearTimeout(resetRef.current);
    },
    [],
  );

  const handleAdd = (): void => {
    // Optimistic flip — reverted below if the action fails.
    setAdded(true);
    if (resetRef.current !== null) clearTimeout(resetRef.current);
    resetRef.current = setTimeout(() => {
      setAdded(false);
    }, RESET_MS);

    // MOBILE (< sm) shows the "Added to your bag" sheet instead of the
    // desktop toast + auto-opened drawer (Feature B). Captured before the
    // async settle so an orientation/resize mid-flight can't flip behaviour.
    const mobile = isMobileViewport();

    startTransition(async () => {
      const result = await addItem({ variantId, qty: 1 }, { openDrawer: !mobile });
      if (result.ok) {
        if (mobile) {
          showAddedSheet({ productName, qty: 1 });
        } else {
          toast({
            kind: "success",
            message: `${productName} added to your bag`,
          });
        }
      } else {
        // Provider already toasted `ApiErr.message` — just revert the label.
        if (resetRef.current !== null) clearTimeout(resetRef.current);
        setAdded(false);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      aria-label={`Add ${productName} to bag`}
      className={cx(ADD_TO_BAG_CLASSES, className)}
    >
      {added ? (
        <span className="inline-block animate-[kk-pop_0.4s_ease-out] motion-reduce:animate-none">
          Added ✓
        </span>
      ) : (
        label
      )}
    </button>
  );
}
