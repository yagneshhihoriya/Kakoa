"use client";

import { type ReactNode } from "react";
import { cx } from "@kakoa/ui";
import { useAuthOptional } from "./AuthProvider";

export interface WishlistHeartButtonProps {
  /** Product this heart would save (used by the future toggle). */
  productId: string;
  /** Product name for the accessible label. */
  productName: string;
  /** Icon size in px (17 for cards, 20 for the PDP). */
  iconSize?: number;
  /** Extra classes for placement/skin (card overlay vs PDP square). */
  className?: string;
}

/**
 * Auth-gated wishlist heart (docs/modules/auth-otp.md §2). This module only
 * gates on auth: anonymous taps open the login sheet; signed-in taps are a
 * no-op placeholder until the wishlist toggle module lands.
 *
 * TODO(accounts module): call `POST /api/wishlist` to toggle the heart and
 * reflect `wishlist_items` membership (filled vs outline) here.
 */
export function WishlistHeartButton({
  productId,
  productName,
  iconSize = 17,
  className,
}: WishlistHeartButtonProps): ReactNode {
  const auth = useAuthOptional();

  const handleClick = (): void => {
    if (auth === null) return;
    if (auth.customer === null) {
      auth.open("wishlist");
      return;
    }
    // Signed in — wishlist mutation is a follow-up module (read-only here).
    // Intentionally a no-op; the /account wishlist tab renders saved items.
    void productId;
  };

  return (
    <button
      type="button"
      aria-label={`Add ${productName} to wishlist`}
      onClick={handleClick}
      className={cx(
        "transition-colors hover:text-raspberry focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" />
      </svg>
    </button>
  );
}
