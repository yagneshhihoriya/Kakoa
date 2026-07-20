"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@kakoa/ui";
import { useAuthOptional } from "./AuthProvider";
import { useWishlist } from "./WishlistProvider";

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
 * Auth-gated wishlist heart. Anonymous taps open the login sheet; signed-in
 * taps toggle `wishlist_items` via the WishlistProvider (POST/DELETE
 * /api/wishlist) and the heart fills/outlines to reflect membership.
 */
export function WishlistHeartButton({
  productId,
  productName,
  iconSize = 17,
  className,
}: WishlistHeartButtonProps): ReactNode {
  const auth = useAuthOptional();
  const wishlist = useWishlist();
  const saved = wishlist?.isSaved(productId) ?? false;
  const [beat, setBeat] = useState(false);

  const handleClick = (): void => {
    if (auth === null) return;
    if (auth.customer === null) {
      auth.open("wishlist");
      return;
    }
    // Beat only on the delightful "adding" moment (not on remove).
    if (!saved) setBeat(true);
    void wishlist?.toggle(productId);
  };

  return (
    <button
      type="button"
      aria-label={saved ? `Remove ${productName} from wishlist` : `Add ${productName} to wishlist`}
      aria-pressed={saved}
      onClick={handleClick}
      className={cx(
        "transition-colors hover:text-raspberry focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
        saved && "text-raspberry",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        onAnimationEnd={() => setBeat(false)}
        className={cx(
          "origin-center",
          beat && "animate-[kk-heart_0.5s_ease-out] motion-reduce:animate-none",
        )}
      >
        <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" />
      </svg>
    </button>
  );
}
