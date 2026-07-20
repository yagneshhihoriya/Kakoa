"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPaise } from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { ChocoPlaceholder } from "@/components/catalog/ChocoPlaceholder";
import { useCartChrome, type ChromeCartContext } from "./useCartChrome";
import { useOverlay } from "./useOverlay";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

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
 * Cart drawer (prototype CART DRAWER aside): right slide-in, 420px, line
 * items with tone thumbnails + qty steppers, subtotal / shipping summary,
 * free-ship progress note, checkout + view-full-cart actions.
 *
 * Visual SHELL for Module 2 — reads the pinned CartProvider context through
 * the defensive `useCartChrome()` hook, so with no provider (or a null cart)
 * it renders the empty-bag state and never throws. Mutations go through the
 * provider's optimistic wrappers when present.
 */
export function CartDrawer(): ReactNode {
  const ctx = useCartChrome();
  const router = useRouter();
  const panelRef = useRef<HTMLElement | null>(null);

  const open = ctx?.drawerOpen ?? false;
  const close = (): void => {
    ctx?.closeDrawer();
  };
  useOverlay(open, close, panelRef);

  if (!open) return null;

  const cart = ctx?.cart ?? null;
  const pending = ctx?.pending ?? false;

  const setQty = (itemId: string, qty: number): void => {
    const context: ChromeCartContext | null = ctx;
    if (context === null) return;
    const update = context.updateItem ?? context.updateCartItem;
    if (qty <= 0) {
      const remove = context.removeItem ?? context.removeCartItem;
      if (remove !== undefined) {
        remove({ itemId });
        return;
      }
    }
    update?.({ itemId, qty: Math.max(qty, 0) });
  };

  const goTo = (href: Parameters<typeof router.push>[0]): void => {
    close();
    router.push(href);
  };

  const discountPaise = cart?.coupon?.discountPaise ?? 0;
  const subtotalPaise = cart?.subtotalPaise ?? 0;
  const totalPaise = Math.max(
    subtotalPaise + (cart?.giftWrapTotalPaise ?? 0) - discountPaise,
    0,
  );
  const freeShipGapPaise =
    cart === null
      ? 0
      : Math.max(cart.freeShippingThresholdPaise - subtotalPaise, 0);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={close}
        className="fixed inset-0 z-[60] bg-ink/[.42] animate-[kk-overlay_.25s_ease]"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your bag"
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-[61] flex w-[420px] max-w-[92vw] flex-col bg-cream shadow-[-24px_0_60px_rgba(42,29,18,.24)] animate-[kk-drawer_.34s_cubic-bezier(.2,.7,.3,1)] focus-visible:outline-none"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-[22px]">
          <span className="font-display text-[22px] text-ink">Your bag</span>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            className={cx(
              "h-[34px] w-[34px] rounded-pill bg-[#F0E4D2] text-lg text-ink transition-colors hover:bg-[#e6d5bd]",
              FOCUS_RING,
            )}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {cart === null || cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="grid h-[72px] w-[72px] place-items-center rounded-pill bg-[#F0E4D2] text-espresso">
              <BagIcon size={30} />
            </div>
            <div>
              <div className="mb-1 font-display text-xl text-ink">
                Your bag is empty
              </div>
              <div className="text-sm text-[#6B5A49]">
                Let&rsquo;s fix that — the truffles are calling.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                goTo("/shop");
              }}
              className={cx(
                "rounded-pill bg-ink px-[26px] py-[13px] font-body text-[14.5px] font-semibold text-card transition-colors hover:bg-[#3f2c1b]",
                FOCUS_RING,
              )}
            >
              Browse chocolates
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto px-6 py-2">
              {cart.lines.map((line, index) => (
                <div
                  key={line.itemId}
                  style={{ animationDelay: `${index * 45}ms` }}
                  className="flex gap-3.5 border-b border-line py-4 animate-[kk-rise_0.4s_ease_both] motion-reduce:animate-none"
                >
                  <div className="relative w-[70px] flex-none overflow-hidden rounded-[12px]">
                    <ChocoPlaceholder tone={line.tone} ratio="7 / 8" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-body text-[15px] font-semibold text-ink">
                        {line.name}
                      </span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setQty(line.itemId, 0);
                        }}
                        className={cx(
                          "text-[13px] text-[#a08a72] transition-colors hover:text-raspberry disabled:opacity-40",
                          FOCUS_RING,
                        )}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-0.5 mb-2.5 text-[12.5px] text-[#8a7a68]">
                      {line.variantName}
                      {line.giftWrap ? " · Gift wrapped" : ""}
                      {line.stockState === "out" ? (
                        <span className="text-raspberry">
                          {" "}
                          · Unavailable — please remove
                        </span>
                      ) : line.stockState === "low" ? (
                        <span className="text-caramel"> · Low stock</span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between">
                      <div
                        role="group"
                        aria-label={`Quantity for ${line.name}`}
                        className="flex items-center overflow-hidden rounded-pill border border-[#E0CFB6]"
                      >
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${line.name}`}
                          disabled={pending}
                          onClick={() => {
                            setQty(line.itemId, line.qty - 1);
                          }}
                          className={cx(
                            "h-7 w-7 text-base text-ink transition-[background-color,transform] hover:bg-card active:scale-90 disabled:opacity-40 motion-reduce:active:scale-100",
                            FOCUS_RING,
                          )}
                        >
                          −
                        </button>
                        <span
                          aria-live="polite"
                          className="w-[26px] text-center font-body text-[13px] font-semibold text-ink"
                        >
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${line.name}`}
                          disabled={
                            pending ||
                            line.stockState === "out" ||
                            line.qty >= 20
                          }
                          onClick={() => {
                            setQty(line.itemId, line.qty + 1);
                          }}
                          className={cx(
                            "h-7 w-7 text-base text-ink transition-[background-color,transform] hover:bg-card active:scale-90 disabled:opacity-40 motion-reduce:active:scale-100",
                            FOCUS_RING,
                          )}
                        >
                          +
                        </button>
                      </div>
                      <span className="font-body text-[15px] font-semibold text-ink">
                        {formatPaise(line.lineTotalPaise)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-line bg-[#F6EEE1] px-6 py-5">
              <div className="mb-1.5 flex justify-between text-sm text-[#6B5A49]">
                <span>Subtotal</span>
                <span className="font-semibold text-ink">
                  {formatPaise(subtotalPaise)}
                </span>
              </div>
              {cart.coupon !== null ? (
                <div className="mb-1.5 flex justify-between text-sm text-[#6B5A49]">
                  <span>Coupon · {cart.coupon.code}</span>
                  <span className="font-semibold text-success">
                    −{formatPaise(cart.coupon.discountPaise)}
                  </span>
                </div>
              ) : null}
              <div className="mb-3.5 flex justify-between text-sm text-[#6B5A49]">
                <span>Shipping</span>
                <span className="font-semibold text-ink">
                  {freeShipGapPaise === 0 ? "Free" : "Calculated at checkout"}
                </span>
              </div>
              {cart.freeShippingThresholdPaise > 0 ? (
                <div className="mb-3.5">
                  <div className="mb-1.5 text-[12.5px] font-medium text-espresso">
                    {freeShipGapPaise > 0
                      ? `Add ${formatPaise(freeShipGapPaise)} more for complimentary shipping.`
                      : "Complimentary shipping unlocked."}
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Progress towards complimentary shipping"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(
                      100,
                      Math.round(
                        (subtotalPaise / cart.freeShippingThresholdPaise) * 100,
                      ),
                    )}
                    className="h-1.5 overflow-hidden rounded-pill bg-[#E8D9C2]"
                  >
                    <div
                      className="h-full rounded-pill bg-caramel transition-[width] duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (subtotalPaise /
                              cart.freeShippingThresholdPaise) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  goTo("/checkout");
                }}
                className={cx(
                  "w-full rounded-pill bg-ink py-[15px] font-body text-[15px] font-bold text-card transition-colors hover:bg-[#3f2c1b] disabled:opacity-60",
                  FOCUS_RING,
                )}
              >
                Checkout · {formatPaise(totalPaise)}
              </button>
              <Link
                href="/cart"
                onClick={close}
                className={cx(
                  "mt-2.5 block w-full text-center font-body text-[13.5px] font-semibold text-[#6B5A49] no-underline transition-colors hover:text-ink",
                  FOCUS_RING,
                )}
              >
                View full cart
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
