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

/* ------------------------------------------------------------------ */
/* Icons (presentational)                                              */
/* ------------------------------------------------------------------ */

function BagIcon(): ReactNode {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
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
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

function LockIcon(): ReactNode {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function HeartIcon(): ReactNode {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.5-9.5 9-9.5 9z" />
    </svg>
  );
}

function SnowIcon(): ReactNode {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" />
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
      <div className="rounded-[22px] border border-line-soft bg-surface p-2 shadow-soft sm:p-3">
        {[0, 1].map((row) => (
          <div
            key={row}
            className="flex items-center gap-5 border-b border-line-soft px-3 py-5 last:border-b-0"
          >
            <Skeleton variant="card" width={92} height={104} />
            <div className="flex-1">
              <Skeleton variant="line" width="42%" className="mb-3" />
              <Skeleton variant="text" width="28%" className="mb-4" />
              <Skeleton variant="line" width={132} height={34} />
            </div>
            <Skeleton variant="line" width={70} />
          </div>
        ))}
      </div>
      <Skeleton variant="card" height={440} className="rounded-[22px]" />
    </div>
  );
}

/** Inline retry panel — GET /api/cart failed; page chrome stays live. */
function CartError({ onRetry }: { onRetry: () => void }): ReactNode {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-[520px] flex-col items-center gap-[18px] rounded-[24px] border border-line-soft bg-surface px-10 py-20 text-center shadow-soft"
    >
      <div className="font-display text-[26px] text-ink">
        We couldn&rsquo;t load your bag
      </div>
      <div className="text-[15px] text-ink-soft">
        Something went wrong on our side. Your items are safe — try again.
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cx(
          "rounded-pill bg-ink px-[30px] py-[15px] font-body text-[15px] font-bold text-card transition-colors hover:bg-ink-hover",
          FOCUS_RING,
        )}
      >
        Retry
      </button>
    </div>
  );
}

/** On-brand empty state — single, focused CTA. */
function CartEmpty(): ReactNode {
  return (
    <div className="mx-auto flex max-w-[520px] flex-col items-center justify-center gap-5 rounded-[24px] border border-line-soft bg-surface px-10 py-20 text-center shadow-soft">
      <div className="grid h-[92px] w-[92px] place-items-center rounded-pill bg-cream-2 text-espresso">
        <BagIcon />
      </div>
      <div>
        <div className="mb-1.5 font-display text-[28px] text-ink">
          Your bag is empty
        </div>
        <div className="text-[15px] text-ink-soft">
          Once you add something delicious, it&rsquo;ll show up here.
        </div>
      </div>
      <Link
        href="/shop"
        className={cx(
          "rounded-pill bg-ink px-[30px] py-[15px] font-body text-[15px] font-bold text-card no-underline transition-colors hover:bg-ink-hover",
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
  const [open, setOpen] = useState(line.giftWrap || line.giftMessage !== null);
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
    <div className="mt-3.5 rounded-[14px] border border-line-soft bg-cream-2 p-3.5">
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
          className="mb-1 block font-mono text-[11px] tracking-[0.14em] text-ink-muted uppercase"
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
            "w-full resize-none rounded-[10px] border border-line bg-surface px-3 py-2 font-body text-[13.5px] text-ink placeholder:text-ink-muted",
            FOCUS_RING,
          )}
        />
        <div className="mt-1 flex items-center justify-between">
          <span
            aria-live="polite"
            className="font-mono text-[11.5px] text-ink-muted"
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
                "rounded-pill bg-card px-3.5 py-1.5 font-body text-[12.5px] font-bold text-ink transition-colors hover:bg-line disabled:opacity-50",
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
    <div className="flex gap-4 border-b border-line-soft px-3 py-6 last:border-b-0 sm:gap-5 sm:px-4">
      <Link
        href={`/product/${line.productSlug}`}
        aria-label={line.name}
        className={cx(
          "relative h-[104px] w-[90px] flex-none overflow-hidden rounded-[14px] shadow-soft transition-transform hover:scale-[1.02] motion-reduce:transition-none",
          unavailable && "opacity-50",
          FOCUS_RING,
        )}
      >
        <ChocoPlaceholder tone={line.tone} ratio="6 / 7" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-body text-[16.5px] leading-snug font-semibold text-ink">
              <Link
                href={`/product/${line.productSlug}`}
                className={cx(
                  "text-ink no-underline hover:underline",
                  FOCUS_RING,
                )}
              >
                {line.name}
              </Link>
            </div>
            <div className="mt-1 text-[13px] text-ink-muted">
              {line.variantName} · {formatPaise(line.unitPricePaise)} each
              {line.stockState === "low" ? (
                <span className="text-caramel"> · Only a few left</span>
              ) : null}
            </div>
          </div>
          <div
            className={cx(
              "font-body text-[17px] font-bold whitespace-nowrap text-ink",
              unavailable && "text-ink-muted line-through",
            )}
          >
            {formatPaise(line.lineTotalPaise)}
          </div>
        </div>

        {unavailable ? (
          <p
            role="status"
            className="mt-3 text-[13px] font-semibold text-raspberry"
          >
            Unavailable — this item is out of stock and excluded from your total.
            Please remove it to check out.
          </p>
        ) : null}

        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div
            role="group"
            aria-label={`Quantity for ${line.name}`}
            className={cx(
              "flex items-center overflow-hidden rounded-pill border border-line bg-surface",
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
                "h-[34px] w-[34px] text-lg text-ink transition-colors hover:bg-cream-2 disabled:opacity-40",
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
                "h-[34px] w-[34px] text-lg text-ink transition-colors hover:bg-cream-2 disabled:opacity-40",
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
              "flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-raspberry disabled:opacity-40",
              unavailable && "font-semibold text-raspberry",
              FOCUS_RING,
            )}
          >
            <TrashIcon />
            Remove
          </button>
        </div>

        {line.giftWrap || line.giftMessage !== null ? (
          <p className="mt-3 truncate text-[13px] text-ink-muted italic">
            {line.giftWrap ? "Gift wrapped" : "Gift note"}
            {line.giftMessage !== null ? ` · “${line.giftMessage}”` : ""}
          </p>
        ) : null}
        <GiftEditor key={`${line.itemId}-gift`} line={line} />
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
    <div className="flex justify-between text-[14.5px] text-ink-soft">
      <span>{label}</span>
      <span className="font-semibold text-ink">{children}</span>
    </div>
  );
}

function TrustLine(): ReactNode {
  const items: { icon: ReactNode; label: string }[] = [
    { icon: <LockIcon />, label: "Secure checkout" },
    { icon: <HeartIcon />, label: "Satisfaction promise" },
    { icon: <SnowIcon />, label: "Ships cold & insulated" },
  ];
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-2 font-body text-[12.5px] text-ink-muted"
        >
          <span className="text-espresso" aria-hidden="true">
            {item.icon}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
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
  const freeShipUnlocked = freeShipGapPaise === 0;
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
      className="sticky top-[98px] rounded-[22px] border border-line-soft bg-surface p-6 shadow-card max-[980px]:static sm:p-[26px]"
    >
      <div className="mb-4 font-mono text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
        Order summary
      </div>

      {/* Free-shipping progress (subtotal vs threshold). */}
      {threshold > 0 ? (
        <div className="mb-5 rounded-[14px] bg-cream-2 p-3.5">
          <div className="mb-2 text-[12.5px] font-medium text-espresso">
            {freeShipUnlocked ? (
              <span className="font-semibold text-pistachio">
                Free shipping unlocked
              </span>
            ) : (
              <>
                Add{" "}
                <span className="font-semibold text-ink">
                  {formatPaise(freeShipGapPaise)}
                </span>{" "}
                more for free shipping
              </>
            )}
          </div>
          <div
            role="progressbar"
            aria-label="Progress towards free shipping"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={freeShipPct}
            className="h-2 overflow-hidden rounded-pill bg-line"
          >
            <div
              className={cx(
                "h-full rounded-pill transition-[width] duration-500 ease-brand motion-reduce:transition-none",
                freeShipUnlocked ? "bg-pistachio" : "bg-caramel",
              )}
              style={{ width: `${freeShipPct}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <SummaryRow label="Subtotal">
          {formatPaise(cart.subtotalPaise)}
        </SummaryRow>
        {cart.giftWrapTotalPaise > 0 ? (
          <SummaryRow label="Gift wrap">
            {formatPaise(cart.giftWrapTotalPaise)}
          </SummaryRow>
        ) : null}
        {cart.coupon !== null ? (
          <div className="flex justify-between text-[14.5px] text-ink-soft">
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
                  "text-ink-muted transition-colors hover:text-raspberry disabled:opacity-40",
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
          {freeShipUnlocked ? (
            <span className="text-pistachio">Free</span>
          ) : (
            "Calculated at checkout"
          )}
        </SummaryRow>
      </div>

      {/* Coupon input row ("Promo code" + Apply). */}
      {cart.coupon === null ? (
        <form
          className="mt-4"
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
                "min-w-0 flex-1 rounded-pill border border-line bg-cream-2 px-4 py-3 font-body text-sm font-medium text-ink placeholder:text-ink-muted",
                FOCUS_RING,
              )}
            />
            <button
              type="submit"
              disabled={pending || code.trim() === ""}
              className={cx(
                "rounded-pill bg-card px-[18px] font-body text-[13.5px] font-bold text-ink transition-colors hover:bg-line disabled:opacity-50",
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
          className="mt-2 text-[12.5px] font-medium text-raspberry"
        >
          {couponError}
        </p>
      ) : null}

      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-[18px]">
        <span className="font-body text-base font-semibold text-ink">Total</span>
        <span className="font-display text-[30px] leading-none text-ink">
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
          "mt-5 w-full rounded-pill bg-ink p-4 font-body text-base font-bold text-card shadow-soft transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60",
          FOCUS_RING,
        )}
      >
        Proceed to checkout
      </button>
      {hasUnavailable ? (
        <p
          role="status"
          className="mt-2.5 text-center text-[12.5px] font-medium text-raspberry"
        >
          Remove unavailable items to check out.
        </p>
      ) : null}

      <TrustLine />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Page island                                                         */
/* ------------------------------------------------------------------ */

/**
 * Full cart page island — consumes the CartProvider context and covers all
 * five module UI states: loading skeleton, inline error + retry, empty,
 * success, and partial (unavailable lines flagged + checkout blocked).
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

  const itemCount = cart.count;

  return (
    <div className="grid grid-cols-[1fr_380px] items-start gap-10 max-[980px]:grid-cols-1">
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            {itemCount} {itemCount === 1 ? "item" : "items"} in your bag
          </span>
        </div>

        <div className="rounded-[22px] border border-line-soft bg-surface p-2 shadow-soft sm:p-3">
          {cart.lines.map((line) => (
            <LineRow key={line.itemId} line={line} />
          ))}
        </div>

        <Link
          href="/shop"
          className={cx(
            "mt-6 inline-flex items-center gap-2 font-body text-[14.5px] font-bold text-ink no-underline transition-all hover:gap-3",
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
