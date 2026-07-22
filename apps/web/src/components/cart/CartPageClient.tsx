"use client";

import { useId, useState, type ReactNode } from "react";
import Image from "next/image";
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
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function TrashIcon(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

function LockIcon(): ReactNode {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function HeartIcon(): ReactNode {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.5-9.5 9-9.5 9z" />
    </svg>
  );
}

function SnowIcon(): ReactNode {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14"
    >
      <div className="border-t border-line-soft">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center gap-5 border-b border-line-soft py-7">
            <Skeleton variant="card" width={112} height={132} className="rounded-[12px]" />
            <div className="flex-1">
              <Skeleton variant="line" width="46%" className="mb-3" />
              <Skeleton variant="text" width="30%" className="mb-4" />
              <Skeleton variant="line" width={128} height={38} />
            </div>
            <Skeleton variant="line" width={70} />
          </div>
        ))}
      </div>
      <Skeleton variant="card" height={460} className="rounded-[22px]" />
    </div>
  );
}

/** Inline retry panel — GET /api/cart failed; page chrome stays live. */
function CartError({ onRetry }: { onRetry: () => void }): ReactNode {
  return (
    <div role="alert" className="mx-auto flex max-w-[520px] flex-col items-center gap-[18px] rounded-[24px] border border-line-soft bg-surface px-10 py-20 text-center shadow-soft">
      <div className="font-display text-[26px] text-ink">We couldn&rsquo;t load your bag</div>
      <div className="text-[15px] text-ink-soft">Something went wrong on our side. Your items are safe — try again.</div>
      <button
        type="button"
        onClick={onRetry}
        className={cx("rounded-pill bg-ink px-[30px] py-[15px] font-body text-[15px] font-bold text-card transition-colors hover:bg-ink-hover", FOCUS_RING)}
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
        <div className="mb-1.5 font-display text-[28px] text-ink">Your bag is empty</div>
        <div className="text-[15px] text-ink-soft">Once you add something delicious, it&rsquo;ll show up here.</div>
      </div>
      <Link
        href="/shop"
        className={cx("rounded-pill bg-ink px-[30px] py-[15px] font-body text-[15px] font-bold text-card no-underline transition-colors hover:bg-ink-hover", FOCUS_RING)}
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
        className={cx("mt-3.5 self-start font-body text-[13px] font-semibold text-espresso underline-offset-2 transition-colors hover:text-ink hover:underline", FOCUS_RING)}
      >
        + Add gift options
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-[14px] border border-line-soft bg-cream-2 p-4">
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
      <div className="mt-3">
        <label htmlFor={fieldId} className="mb-1 block font-mono text-[11px] tracking-[0.14em] text-ink-soft uppercase">
          Gift note
        </label>
        <textarea
          id={fieldId}
          aria-describedby={`${fieldId}-count`}
          value={message}
          maxLength={GIFT_MESSAGE_MAX}
          rows={2}
          placeholder="Add a short note to the recipient…"
          disabled={pending || line.stockState === "out"}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
          className={cx("w-full resize-none rounded-[10px] border border-line bg-surface px-3 py-2 font-body text-[13.5px] text-ink placeholder:text-ink-muted", FOCUS_RING)}
        />
        <div className="mt-1 flex items-center justify-between">
          <span id={`${fieldId}-count`} className="font-mono text-[11.5px] text-ink-soft">
            {message.length}/{GIFT_MESSAGE_MAX}
          </span>
          {dirty ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                persist(line.giftWrap, message);
              }}
              className={cx("rounded-pill bg-card px-3.5 py-1.5 font-body text-[12.5px] font-bold text-ink transition-colors hover:bg-line disabled:opacity-50", FOCUS_RING)}
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
    <li className="flex gap-4 border-b border-line-soft py-7 first:pt-6 last:border-b-0 sm:gap-6">
      <Link
        href={`/product/${line.productSlug}`}
        aria-label={line.name}
        className={cx(
          "group relative h-[120px] w-[104px] flex-none overflow-hidden rounded-[12px] bg-cream-2 shadow-soft sm:h-[132px] sm:w-[112px]",
          unavailable && "opacity-50",
          FOCUS_RING,
        )}
      >
        {line.imageUrl !== null ? (
          <Image
            src={line.imageUrl}
            alt=""
            fill
            sizes="112px"
            className="object-cover transition-transform duration-[var(--duration-base)] ease-brand group-hover:scale-[1.04] motion-reduce:transition-none"
          />
        ) : (
          <ChocoPlaceholder tone={line.tone} ratio="6 / 7" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-body text-[17px] leading-snug font-semibold text-ink">
              <Link href={`/product/${line.productSlug}`} className={cx("text-ink no-underline underline-offset-2 transition-colors hover:text-espresso hover:underline", FOCUS_RING)}>
                {line.name}
              </Link>
            </div>
            <div className="mt-1.5 font-body text-[13.5px] text-ink-soft">
              {line.variantName}
              <span className="mx-1.5 text-line">·</span>
              {formatPaise(line.unitPricePaise)} each
              {line.stockState === "low" ? (
                <span className="font-medium text-caramel"> · Only a few left</span>
              ) : null}
            </div>
          </div>
          <div className={cx("font-body text-[17px] font-bold whitespace-nowrap text-ink", unavailable && "text-ink-muted line-through")}>
            {formatPaise(line.lineTotalPaise)}
          </div>
        </div>

        {unavailable ? (
          <p role="status" className="mt-3 font-body text-[13px] font-semibold text-raspberry">
            Unavailable — this item is out of stock and excluded from your total. Please remove it to check out.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div
            role="group"
            aria-label={`Quantity for ${line.name}`}
            className={cx("flex items-center overflow-hidden rounded-[12px] border border-line bg-surface shadow-soft", unavailable && "opacity-50")}
          >
            <button
              type="button"
              aria-label={`Decrease quantity of ${line.name}`}
              disabled={pending || unavailable}
              onClick={() => {
                void updateItem({ itemId: line.itemId, qty: line.qty - 1 });
              }}
              className={cx("h-[38px] w-[40px] text-lg text-ink transition-colors hover:bg-cream-2 disabled:opacity-40", FOCUS_RING)}
            >
              −
            </button>
            <span aria-live="polite" className="w-[32px] text-center font-body text-sm font-semibold text-ink">
              {line.qty}
            </span>
            <button
              type="button"
              aria-label={`Increase quantity of ${line.name}`}
              disabled={pending || unavailable || line.qty >= MAX_QTY}
              onClick={() => {
                void updateItem({ itemId: line.itemId, qty: line.qty + 1 });
              }}
              className={cx("h-[38px] w-[40px] text-lg text-ink transition-colors hover:bg-cream-2 disabled:opacity-40", FOCUS_RING)}
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
            className={cx("flex items-center gap-1.5 font-body text-[13px] text-ink-soft transition-colors hover:text-raspberry disabled:opacity-40", unavailable && "font-semibold text-raspberry", FOCUS_RING)}
          >
            <TrashIcon />
            Remove
          </button>
        </div>

        {line.giftWrap || line.giftMessage !== null ? (
          <p className="mt-3 truncate font-body text-[13px] text-ink-soft italic">
            {line.giftWrap ? "Gift wrapped" : "Gift note"}
            {line.giftMessage !== null ? ` · “${line.giftMessage}”` : ""}
          </p>
        ) : null}
        <GiftEditor key={`${line.itemId}-gift`} line={line} />
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Order summary                                                       */
/* ------------------------------------------------------------------ */

function SummaryRow({ label, children }: { label: ReactNode; children: ReactNode }): ReactNode {
  return (
    <div className="flex items-baseline justify-between font-body text-[14.5px] text-ink-soft">
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
    <ul className="mt-5 flex flex-col gap-2 border-t border-line-soft pt-5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2.5 font-body text-[12.5px] text-ink-soft">
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
  const totalPaise = Math.max(cart.subtotalPaise + cart.giftWrapTotalPaise - discountPaise, 0);
  const threshold = cart.freeShippingThresholdPaise;
  const freeShipGapPaise = Math.max(threshold - cart.subtotalPaise, 0);
  const freeShipPct = threshold > 0 ? Math.min(100, Math.round((cart.subtotalPaise / threshold) * 100)) : 100;
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
      className="sticky top-[98px] rounded-[18px] border border-line-soft bg-surface p-6 shadow-card max-[980px]:static sm:p-7"
    >
      <h2 className="mb-5 font-display text-[22px] leading-none font-normal text-ink">Order summary</h2>

      {/* Free-shipping progress (subtotal vs threshold). */}
      {threshold > 0 ? (
        <div className="mb-5 rounded-[14px] bg-cream-2 p-4">
          <div className="mb-2 font-body text-[12.5px] font-medium text-espresso">
            {freeShipUnlocked ? (
              <span className="font-semibold text-pistachio-deep">You&rsquo;ve unlocked free shipping</span>
            ) : (
              <>
                Add <span className="font-semibold text-ink">{formatPaise(freeShipGapPaise)}</span> more for free shipping
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
              className={cx("h-full rounded-pill transition-[width] duration-500 ease-brand motion-reduce:transition-none", freeShipUnlocked ? "bg-pistachio" : "bg-gold")}
              style={{ width: `${freeShipPct}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3.5">
        <SummaryRow label="Subtotal">{formatPaise(cart.subtotalPaise)}</SummaryRow>
        {cart.giftWrapTotalPaise > 0 ? (
          <SummaryRow label="Gift wrap">{formatPaise(cart.giftWrapTotalPaise)}</SummaryRow>
        ) : null}
        {cart.coupon !== null ? (
          <div className="flex items-baseline justify-between font-body text-[14.5px] text-ink-soft">
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
                className={cx("text-ink-muted transition-colors hover:text-raspberry disabled:opacity-40", FOCUS_RING)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </span>
            <span className="font-semibold text-success">−{formatPaise(cart.coupon.discountPaise)}</span>
          </div>
        ) : null}
        <SummaryRow label="Shipping">
          {freeShipUnlocked ? <span className="font-semibold text-pistachio-deep">Free</span> : "Calculated at checkout"}
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
              className={cx("min-w-0 flex-1 rounded-[12px] border border-line bg-cream-2 px-4 py-3 font-body text-sm font-medium text-ink placeholder:text-ink-muted", FOCUS_RING)}
            />
            <button
              type="submit"
              disabled={pending || code.trim() === ""}
              className={cx("rounded-[12px] bg-card px-[18px] font-body text-[13.5px] font-bold text-ink transition-colors hover:bg-line disabled:opacity-50", FOCUS_RING)}
            >
              Apply
            </button>
          </div>
        </form>
      ) : null}
      {couponError !== null ? (
        <p role="alert" className="mt-2 font-body text-[12.5px] font-medium text-raspberry">
          {couponError}
        </p>
      ) : null}

      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
        <div>
          <span className="font-body text-base font-semibold text-ink">Total</span>
          <span className="mt-0.5 block font-body text-[11.5px] text-ink-soft">Inclusive of all taxes</span>
        </div>
        <span className="font-display text-[32px] leading-none text-ink">{formatPaise(totalPaise)}</span>
      </div>

      <button
        type="button"
        disabled={pending || hasUnavailable}
        onClick={() => {
          router.push("/checkout");
        }}
        className={cx(
          "mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-ink px-6 py-[15px] font-body text-[15px] font-bold text-card shadow-lift transition-[transform,background-color] duration-[var(--duration-base)] ease-brand hover:-translate-y-0.5 hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transform-none",
          FOCUS_RING,
        )}
      >
        <LockIcon />
        Proceed to checkout
      </button>
      {hasUnavailable ? (
        <p role="status" className="mt-2.5 text-center font-body text-[12.5px] font-medium text-raspberry">
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
 * Layout is Lake-Champlain-style: an open, hairline-divided item list on the
 * left and a sticky summary card on the right. Presentation only — cart
 * actions, pricing, coupons, and checkout routing are unchanged.
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
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
      <div>
        <div className="flex items-baseline justify-between border-b border-line pb-4">
          <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase">
            {itemCount} {itemCount === 1 ? "item" : "items"} in your bag
          </span>
        </div>

        <ul>
          {cart.lines.map((line) => (
            <LineRow key={line.itemId} line={line} />
          ))}
        </ul>

        <Link
          href="/shop"
          className={cx(
            "mt-8 inline-flex items-center gap-2 rounded-[12px] border-[1.5px] border-line px-6 py-3 font-body text-[14px] font-bold text-ink no-underline transition-colors hover:border-ink hover:bg-card",
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
