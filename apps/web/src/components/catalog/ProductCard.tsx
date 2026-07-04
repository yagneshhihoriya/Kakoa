import type { ReactNode } from "react";
import Link from "next/link";
import type { ProductCardView } from "@kakoa/core";
import { Price, StarRating, cx } from "@kakoa/ui";
import { AddToBagButton } from "@/components/cart/AddToBagButton";
import { ADD_TO_BAG_CLASSES } from "@/components/cart/add-to-bag-classes";
import { WishlistHeartButton } from "@/components/auth/WishlistHeartButton";
import { ChocoPlaceholder } from "./ChocoPlaceholder";

export interface ProductCardProps {
  product: ProductCardView;
  /**
   * Default variant for the one-tap "Add" CTA. When omitted (Home rails,
   * PDP related/FBT), the CTA renders as a pixel-identical link to the PDP
   * — no client island, no cart call.
   */
  defaultVariantId?: string | null;
  className?: string;
}

/**
 * Catalog product card — prototype collection card (variant A): flush 4/5
 * image with badge chip + wishlist heart, serif name, 2-line blurb, stars +
 * count, price row with the "Add" pill. Server component; the whole card
 * links to the PDP via a stretched-link overlay, with the heart and Add CTA
 * layered above it.
 */
export function ProductCard({
  product,
  defaultVariantId,
  className,
}: ProductCardProps): ReactNode {
  return (
    <article
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-[18px] border border-[#EEE1CE] bg-white",
        "transition-[box-shadow,transform] duration-200 hover:-translate-y-[3px] hover:shadow-[0_18px_40px_rgba(42,29,18,0.12)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {/* Image area — flush 4/5 gradient with badge chip + wishlist heart. */}
      <div className="relative">
        <ChocoPlaceholder
          tone={product.tone}
          ratio="4 / 5"
          className="rounded-none!"
        />
        {product.badge !== null ? (
          <span className="absolute top-3 left-3 rounded-pill bg-cream/[0.92] px-[9px] py-[5px] font-mono text-[11px] font-semibold tracking-[0.06em] text-ink uppercase">
            {product.badge}
          </span>
        ) : null}
        {!product.inStock ? (
          <span className="absolute bottom-3 left-3 rounded-pill bg-ink/90 px-[9px] py-[5px] font-mono text-[11px] font-semibold tracking-[0.06em] text-cream uppercase">
            Sold out
          </span>
        ) : null}
        <WishlistHeartButton
          productId={product.id}
          productName={product.name}
          iconSize={17}
          className="absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-pill bg-cream/90 text-espresso"
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 pt-4 pb-[18px]">
        <h3 className="font-display text-[19px] leading-snug text-ink">
          <Link
            href={`/product/${product.slug}`}
            className="focus-visible:outline-none after:absolute after:inset-0 after:z-0 after:content-['']"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-[3px] line-clamp-2 flex-1 font-body text-[13px] text-[#8a7a68]">
          {product.blurb}
        </p>
        <div className="mt-2 mb-[14px] flex items-center gap-1.5">
          <StarRating value={product.ratingAvg} size="sm" />
          <span className="font-body text-[12.5px] text-[#6B5A49]">
            {product.ratingAvg.toFixed(1)} ({product.ratingCount})
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Price
            paise={product.fromPricePaise}
            compareAtPaise={product.compareAtPricePaise ?? undefined}
          />
          {!product.inStock ? (
            <button type="button" disabled className={cx(ADD_TO_BAG_CLASSES, "cursor-not-allowed opacity-50")}>
              Add
            </button>
          ) : typeof defaultVariantId === "string" ? (
            <AddToBagButton
              variantId={defaultVariantId}
              productName={product.name}
            />
          ) : (
            <Link
              href={`/product/${product.slug}`}
              aria-label={`View ${product.name}`}
              className={ADD_TO_BAG_CLASSES}
            >
              Add
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
