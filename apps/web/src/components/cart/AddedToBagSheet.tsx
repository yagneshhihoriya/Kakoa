"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatPaise } from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { useCart } from "./CartProvider";
import { useOverlay } from "@/components/chrome/useOverlay";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

/** The just-added item, surfaced in the confirmation heading. */
interface AddedItem {
  productName: string;
  qty: number;
}

interface AddedToBagContextValue {
  /**
   * Show the MOBILE "Added to your bag" confirmation sheet. Callers gate the
   * call to mobile widths themselves (the sheet is also `sm:hidden` so it can
   * never paint on desktop even if invoked).
   */
  show: (item: AddedItem) => void;
}

const AddedToBagContext = createContext<AddedToBagContextValue | null>(null);

/**
 * Defensive optional accessor — returns a no-op when rendered outside the
 * provider (mirrors `useCartChrome`), so the card CTA never throws in
 * isolated previews or before the shell mounts the provider.
 */
export function useAddedToBag(): AddedToBagContextValue {
  const ctx = useContext(AddedToBagContext);
  return ctx ?? NOOP_CONTEXT;
}

const NOOP_CONTEXT: AddedToBagContextValue = {
  show: () => {},
};

function BagIcon({ size }: { size: number }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

/**
 * Feature B — MOBILE-ONLY "Added to your bag" confirmation.
 *
 * An original KAKOA bottom-sheet that slides up after a successful add on
 * mobile. It reads the SUBTOTAL + item count from the existing cart context
 * (no new mutations, no API), shows the item just added, and offers a primary
 * Checkout action plus a secondary "View bag" that opens the existing cart
 * drawer. Desktop keeps its current toast + drawer behaviour — the sheet is
 * both gated at the call site (width check) and hard-hidden with `sm:hidden`.
 */
export function AddedToBagProvider({
  children,
}: Readonly<{ children: ReactNode }>): ReactNode {
  const { cart, openDrawer } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<AddedItem | null>(null);

  const close = useCallback((): void => {
    setOpen(false);
  }, []);

  const show = useCallback((next: AddedItem): void => {
    setItem(next);
    setOpen(true);
  }, []);

  useOverlay(open, close, panelRef);

  // Auto-dismiss on navigation (route change).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const value = useMemo<AddedToBagContextValue>(() => ({ show }), [show]);

  const subtotalPaise = cart?.subtotalPaise ?? 0;
  const count = cart?.count ?? 0;

  const goTo = (href: Parameters<typeof router.push>[0]): void => {
    close();
    router.push(href);
  };

  return (
    <AddedToBagContext.Provider value={value}>
      {children}
      {open && item !== null ? (
        <div className="sm:hidden">
          <div
            aria-hidden="true"
            onClick={close}
            className="fixed inset-0 z-[70] bg-ink/[.42] animate-[kk-overlay_.25s_ease] motion-reduce:animate-none"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Added to your bag"
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-[71] flex flex-col rounded-t-[24px] border-t border-line bg-cream px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-[0_-24px_60px_rgba(42,29,18,.28)] animate-[kk-sheetup_.34s_cubic-bezier(.2,.7,.3,1)] focus-visible:outline-none motion-reduce:animate-none"
          >
            {/* Grab handle */}
            <span
              aria-hidden="true"
              className="mx-auto mb-3 h-1 w-10 rounded-pill bg-line"
            />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-pill bg-pistachio/15 text-pistachio motion-safe:animate-[kk-pop_.4s_ease-out]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span className="font-display text-[21px] leading-none text-ink">
                  Added to your bag
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Dismiss"
                className={cx(
                  "-mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-pill bg-card text-ink transition-colors hover:bg-line",
                  FOCUS_RING,
                )}
              >
                <span aria-hidden="true" className="text-[15px]">
                  ✕
                </span>
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-[16px] border border-line-soft bg-surface px-3.5 py-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-cream-2 text-espresso">
                <BagIcon size={20} />
              </span>
              <span className="min-w-0 flex-1 font-body text-[14.5px] font-semibold text-ink">
                <span className="line-clamp-2">{item.productName}</span>
              </span>
              <span className="flex-none font-mono text-[12.5px] font-semibold tracking-[0.04em] text-ink-muted">
                ×{item.qty}
              </span>
            </div>

            <div className="mt-3.5 flex items-center justify-between border-t border-line-soft pt-3.5">
              <span className="font-body text-[13.5px] text-ink-soft">
                Subtotal
                <span className="text-ink-muted">
                  {" "}
                  · {count} {count === 1 ? "item" : "items"}
                </span>
              </span>
              <span className="font-body text-[16px] font-semibold text-ink">
                {formatPaise(subtotalPaise)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                goTo("/checkout");
              }}
              className={cx(
                "mt-4 w-full rounded-pill bg-ink py-[15px] font-body text-[15px] font-bold text-card transition-colors hover:bg-ink-hover",
                FOCUS_RING,
              )}
            >
              Checkout
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                openDrawer();
              }}
              className={cx(
                "mt-2.5 w-full rounded-pill border border-line bg-transparent py-[13px] font-body text-[14px] font-semibold text-ink transition-colors hover:bg-card",
                FOCUS_RING,
              )}
            >
              View bag
            </button>
          </div>
        </div>
      ) : null}
    </AddedToBagContext.Provider>
  );
}
