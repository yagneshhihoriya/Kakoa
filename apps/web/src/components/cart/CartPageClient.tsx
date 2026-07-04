"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CartView } from "@kakoa/core";
import { formatPaise } from "@kakoa/core";
import { Skeleton, cx } from "@kakoa/ui";
import { ChocoPlaceholder } from "@/components/catalog/ChocoPlaceholder";
import { useCart } from "@/components/cart/CartProvider";

type CartLine = CartView["lines"][number];

const MAX_QTY = 20;
const GIFT_MESSAGE_MAX = 300;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

function BagIcon(): ReactNode {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function TrashIcon(): ReactNode {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Loading / error / empty states                                      */
/* ------------------------------------------------------------------ */

/** Dimension-locked skeleton mirroring the filled two-column layout. */
function CartSkeleton(): ReactNode {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your bag"
      className="grid grid-cols-[1fr_380px] items-start gap-10 max-[980px]:grid-cols-1"
    >
      <div>
        <div className="border-b border-line pb-3.5">
          <Skeleton variant="text" width={160} />
        </div>
        {[0, 1].map((row) => (
          <div
            key={row}
            className="flex items-center gap-5 border-b border-line py-[22px]"
          >
            <Skeleton variant="card" width={96} height={112} />
            <div className="flex-1">
              <Skeleton variant="line" width="40%" className="mb-3" />
              <Skeleton variant="text" width="28%" className="mb-4" />
              <Skeleton variant="line" width={140} height={34} />
            </div>
            <Skeleton variant="line" width={72} />
          </div>
        ))}
      </div>
      <Skeleton variant="card" height={420} className="rounded-[22px]" />
    </div>
  );
}

/** Inline retry panel — GET /api/cart failed; page chrome stays live. */
function CartError({ onRetry }: { onRetry: () => void }): ReactNode {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-[18px] rounded-[24px] border border-[#EEE1CE] bg-white px-10 py-20 text-center"
    >
      <div className="font-display text-[26px] text-ink">
        We couldn&rsquo;t load your bag
      </div>
      <div className="text-[15px] text-[#6B5A49]">
        Something went wrong on our side. Your items are safe — try again.
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cx(
          "rounded-pill bg-ink px-[30px] py-[15px] font-body text-[15px] font-bold text-card transition-colors hover:bg-[#3f2c1b]",
          FOCUS_RING,
        )}
      >
        Retry
      </button>
    </div>
  );
}

/** Empty state, verbatim from the prototype cart page. */
function CartEmpty(): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-[18px] rounded-[24px] border border-[#EEE1CE] bg-white px-10 py-20 text-center">
      <div className="grid h-[88px] w-[88px] place-items-center rounded-pill bg-card text-espresso">
        <BagIcon />
      </div>
      <div>
        <div className="mb-1.5 font-display text-[26px] text-ink">
          Your bag is empty
        </div>
        <div className="text-[15px] text-[#6B5A49]">
          Once you add something delicious, it&rsquo;ll show up here.
        </div>
      </div>
      <Link
        href="/shop"
        className={cx(
          "rounded-pill bg-ink px-[30px] py-[15px] font-body text-[15px] font-bold text-card no-underline transition-colors hover:bg-[#3f2c1b]",
          FOCUS_RING,
        )}
      >
        Browse chocolates
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gift options editor                                                 */
/* ------------------------------------------------------------------ */

/**
 * Per-line gift options: wrap toggle persists immediately (optimistic);
 * the ≤300-char message (live "N/300" counter, cap mirrors the DB CHECK)
 * saves explicitly so we don't fire an action per keystroke.
 */
function GiftEditor({ line }: { line: CartLine }): ReactNode {
  const { setGift, pending } = useCart();
  const fieldId = useId();
  const [open, setOpen] = useState(
    line.giftWrap || line.giftMessage !== null,
  );
  const [message, setMessage] = useState(line.giftMessage ?? "");
  const dirty = message.trim() !== (line.giftMessage ?? "");

  const persist = (giftWrap: boolean, giftMessage: string): void => {
    const trimmed = giftMessage.trim();
    void setGift(
      trimmed === ""
        ? { itemId: line.itemId, giftWrap }
        : { itemId: line.itemId, giftWrap, giftMessage: trimmed },
    );
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className={cx(
          "mt-3 self-start font-body text-[13px] font-semibold text-espresso transition-colors hover:text-ink",
          FOCUS_RING,
        )}
      >
        + Add gift options
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-[12px] bg-[#F6EEE1] p-3.5">
      <label className="flex cursor-pointer items-center gap-2.5 font-body text-[13.5px] font-semibold text-ink">
        <input
          type="checkbox"
          checked={line.giftWrap}
          disabled={pending || line.stockState === "out"}
          onChange={(event) => {
            persist(event.target.checked, message);
          }}
          className="h-4 w-4 accent-espresso"
        />
        Gift wrap this item
      </label>
      <div className="mt-2.5">
        <label
          htmlFor={fieldId}
          className="mb-1 block font-mono text-[11px] tracking-[.1em] text-[#8a7a68] uppercase"
        >
          Gift note
        </label>
        <textarea
          id={fieldId}
          value={message}
          maxLength={GIFT_MESSAGE_MAX}
          rows={2}
          placeholder="Add a short note to the recipient…"
          disabled={pending || line.stockState === "out"}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
          className={cx(
            "w-full resize-none rounded-[10px] border border-[#E8DBC6] bg-white px-3 py-2 font-body text-[13.5px] text-ink placeholder:text-[#a08a72]",
            FOCUS_RING,
          )}
        />
        <div className="mt-1 flex items-center justify-between">
          <span
            aria-live="polite"
            className="font-mono text-[11.5px] text-[#8a7a68]"
          >
            {message.length}/{GIFT_MESSAGE_MAX}
          </span>
          {dirty ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                persist(line.giftWrap, message);
              }}
              className={cx(
                "rounded-pill bg-card px-3.5 py-1.5 font-body text-[12.5px] font-bold text-ink transition-colors hover:bg-[#e8d6bc] disabled:opacity-50",
                FOCUS_RING,
              )}
            >
              Save note
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Line row                                                            */
/* ------------------------------------------------------------------ */

function LineRow({ line }: { line: CartLine }): ReactNode {
  const { updateItem, removeItem, pending } = useCart();
  const unavailable = line.stockState === "out";

  return (
    <div className="flex items-center gap-5 border-b border-line py-[22px] max-[560px]:items-start">
      <div
        className={cx(
          "relative h-[112px] w-[96px] flex-none overflow-hidden rounded-[14px]",
          unavailable && "opacity-50",
        )}
      >
        <ChocoPlaceholder tone={line.tone} ratio="6 / 7" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 font-body text-[17px] font-semibold text-ink">
          <Link
            href={`/product/${line.productSlug}`}
            className={cx("text-ink no-underline hover:underline", FOCUS_RING)}
          >
            {line.name}
          </Link>
        </div>
        <div className="mb-3.5 text-[13.5px] text-[#8a7a68]">
          {line.variantName} · {formatPaise(line.unitPricePaise)} each
          {line.stockState === "low" ? (
            <span className="text-caramel"> · Only a few left</span>
          ) : null}
        </div>

        {unavailable ? (
          <p role="status" className="mb-3.5 text-[13.5px] font-semibold text-raspberry">
            Unavailable — this item is out of stock and excluded from your
            total. Please remove it to check out.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-[18px]">
          <div
            role="group"
            aria-label={`Quantity for ${line.name}`}
            className={cx(
              "flex items-center overflow-hidden rounded-pill border border-[#E0CFB6] bg-white",
              unavailable && "opacity-50",
            )}
          >
            <button
              type="button"
              aria-label={`Decrease quantity of ${line.name}`}
              disabled={pending || unavailable}
              onClick={() => {
                void updateItem({ itemId: line.itemId, qty: line.qty - 1 });
              }}
              className={cx(
                "h-[34px] w-[34px] text-lg text-ink transition-colors hover:bg-card disabled:opacity-40",
                FOCUS_RING,
              )}
            >
              −
            </button>
            <span
              aria-live="polite"
              className="w-[30px] text-center font-body text-sm font-semibold text-ink"
            >
              {line.qty}
            </span>
            <button
              type="button"
              aria-label={`Increase quantity of ${line.name}`}
              disabled={pending || unavailable || line.qty >= MAX_QTY}
              onClick={() => {
                void updateItem({ itemId: line.itemId, qty: line.qty + 1 });
              }}
              className={cx(
                "h-[34px] w-[34px] text-lg text-ink transition-colors hover:bg-card disabled:opacity-40",
                FOCUS_RING,
              )}
            >
              +
            </button>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              void removeItem({ itemId: line.itemId });
            }}
            className={cx(
              "flex items-center gap-1.5 text-[13.5px] text-[#a08a72] transition-colors hover:text-raspberry disabled:opacity-40",
              unavailable && "font-semibold text-raspberry",
              FOCUS_RING,
            )}
          >
            <TrashIcon />
            Remove
          </button>
        </div>

        {line.giftWrap || line.giftMessage !== null ? (
          <p className="mt-3 truncate text-[13px] text-[#8a7a68] italic">
            {line.giftWrap ? "Gift wrapped" : "Gift note"}
            {line.giftMessage !== null ? ` · “${line.giftMessage}”` : ""}
          </p>
        ) : null}
        <GiftEditor key={`${line.itemId}-gift`} line={line} />
      </div>

      <div
        className={cx(
          "font-body text-lg font-bold whitespace-nowrap text-ink",
          unavailable && "text-[#a08a72] line-through",
        )}
      >
        {formatPaise(line.lineTotalPaise)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Order summary                                                       */
/* ------------------------------------------------------------------ */

function SummaryRow({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="mb-3 flex justify-between text-[14.5px] text-[#5C4B3A]">
      <span>{label}</span>
      <span className="font-semibold text-ink">{children}</span>
    </div>
  );
}

function OrderSummary({ cart }: { cart: CartView }): ReactNode {
  const { applyCouponCode, removeCouponCode, pending } = useCart();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);

  const discountPaise = cart.coupon?.discountPaise ?? 0;
  const totalPaise = Math.max(
    cart.subtotalPaise + cart.giftWrapTotalPaise - discountPaise,
    0,
  );
  const threshold = cart.freeShippingThresholdPaise;
  const freeShipGapPaise = Math.max(threshold - cart.subtotalPaise, 0);
  const freeShipPct =
    threshold > 0
      ? Math.min(100, Math.round((cart.subtotalPaise / threshold) * 100))
      : 100;
  const hasUnavailable = cart.lines.some((line) => line.stockState === "out");

  const submitCoupon = (): void => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed === "") return;
    setCouponError(null);
    void applyCouponCode({ code: trimmed }).then((result) => {
      if (result.ok) {
        setCode("");
      } else {
        // Identical generic copy for every COUPON_* code (no enumeration).
        setCouponError(result.error.message);
      }
    });
  };

  return (
    <aside
      aria-label="Order summary"
      className="sticky top-[98px] rounded-[22px] border border-[#EEE1CE] bg-white p-[26px] max-[980px]:static"
    >
      <div className="mb-5 font-display text-[22px] text-ink">
        Order summary
      </div>

      <SummaryRow label="Subtotal">{formatPaise(cart.subtotalPaise)}</SummaryRow>
      {cart.giftWrapTotalPaise > 0 ? (
        <SummaryRow label="Gift wrap">
          {formatPaise(cart.giftWrapTotalPaise)}
        </SummaryRow>
      ) : null}
      {cart.coupon !== null ? (
        <div className="mb-3 flex justify-between text-[14.5px] text-[#5C4B3A]">
          <span className="flex items-center gap-2">
            Coupon · {cart.coupon.code}
            <button
              type="button"
              aria-label={`Remove coupon ${cart.coupon.code}`}
              disabled={pending}
              onClick={() => {
                setCouponError(null);
                void removeCouponCode().then((result) => {
                  if (!result.ok) setCouponError(result.error.message);
                });
              }}
              className={cx(
                "text-[#a08a72] transition-colors hover:text-raspberry disabled:opacity-40",
                FOCUS_RING,
              )}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </span>
          <span className="font-semibold text-success">
            −{formatPaise(cart.coupon.discountPaise)}
          </span>
        </div>
      ) : null}
      <SummaryRow label="Shipping">
        {freeShipGapPaise === 0 ? "Free" : "Calculated at checkout"}
      </SummaryRow>

      {/* Free-shipping progress (subtotal vs threshold). */}
      {threshold > 0 ? (
        <div className="mb-[18px]">
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
            aria-valuenow={freeShipPct}
            className="h-1.5 overflow-hidden rounded-pill bg-[#EADBC6]"
          >
            <div
              className="h-full rounded-pill bg-caramel transition-[width] duration-500"
              style={{ width: `${freeShipPct}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Coupon input row (prototype "Promo code" + Apply). */}
      {cart.coupon === null ? (
        <form
          className="mb-[18px]"
          onSubmit={(event) => {
            event.preventDefault();
            submitCoupon();
          }}
        >
          <div className="flex gap-2">
            <input
              value={code}
              placeholder="Promo code"
              aria-label="Promo code"
              aria-invalid={couponError !== null}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={24}
              onChange={(event) => {
                setCode(event.target.value);
                setCouponError(null);
              }}
              onBlur={(event) => {
                setCode(event.target.value.trim().toUpperCase());
              }}
              className={cx(
                "min-w-0 flex-1 rounded-pill border border-[#E8DBC6] bg-[#F6EEE1] px-4 py-3 font-body text-sm font-medium text-ink placeholder:text-[#a08a72]",
                FOCUS_RING,
              )}
            />
            <button
              type="submit"
              disabled={pending || code.trim() === ""}
              className={cx(
                "rounded-pill bg-card px-[18px] font-body text-[13.5px] font-bold text-ink transition-colors hover:bg-[#e8d6bc] disabled:opacity-50",
                FOCUS_RING,
              )}
            >
              Apply
            </button>
          </div>
        </form>
      ) : null}
      {couponError !== null ? (
        <p
          role="alert"
          className="-mt-2 mb-[18px] text-[12.5px] font-medium text-raspberry"
        >
          {couponError}
        </p>
      ) : null}

      <div className="mb-5 flex items-baseline justify-between border-t border-line pt-[18px]">
        <span className="font-body text-base font-semibold text-ink">
          Total
        </span>
        <span className="font-body text-[26px] font-bold text-ink">
          {formatPaise(totalPaise)}
        </span>
      </div>

      <button
        type="button"
        disabled={pending || hasUnavailable}
        onClick={() => {
          router.push("/checkout");
        }}
        className={cx(
          "w-full rounded-pill bg-ink p-4 font-body text-base font-bold text-card transition-colors hover:bg-[#3f2c1b] disabled:cursor-not-allowed disabled:opacity-60",
          FOCUS_RING,
        )}
      >
        Proceed to checkout
      </button>
      {hasUnavailable ? (
        <p role="status" className="mt-2.5 text-center text-[12.5px] font-medium text-raspberry">
          Remove unavailable items to check out.
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-center gap-2 text-[12.5px] text-[#8a7a68]">
        <span aria-hidden="true">🔒</span> Secure checkout · encrypted payment
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Page island                                                         */
/* ------------------------------------------------------------------ */

/**
 * Full cart page island (prototype 40-cart-page.html) — consumes the
 * CartProvider context. Covers all five module UI states: loading
 * skeleton, inline error + retry, empty, success, and partial
 * (unavailable lines flagged + checkout blocked).
 */
export function CartPageClient(): ReactNode {
  const { cart, status, refresh } = useCart();

  if (status === "error" && cart === null) {
    return (
      <CartError
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }
  if (cart === null) return <CartSkeleton />;
  if (cart.lines.length === 0) return <CartEmpty />;

  return (
    <div className="grid grid-cols-[1fr_380px] items-start gap-10 max-[980px]:grid-cols-1">
      <div>
        <div className="flex justify-between border-b border-line pb-3.5 font-mono text-xs font-semibold tracking-[.1em] text-[#8a7a68] uppercase">
          <span>Product</span>
          <span>Total</span>
        </div>
        {cart.lines.map((line) => (
          <LineRow key={line.itemId} line={line} />
        ))}
        <Link
          href="/shop"
          className={cx(
            "mt-[22px] inline-flex items-center gap-2 font-body text-[14.5px] font-bold text-ink no-underline transition-all hover:gap-3",
            FOCUS_RING,
          )}
        >
          <span aria-hidden="true">←</span> Continue shopping
        </Link>
      </div>

      <OrderSummary cart={cart} />
    </div>
  );
}
