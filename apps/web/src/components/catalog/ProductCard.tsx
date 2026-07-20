import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
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
 * Catalog product card (2026 premium refresh). A raised paper card with a
 * flush 4/5 image that slowly zooms on hover, a hairline badge chip + wishlist
 * heart, serif name, 2-line blurb, stars, and the price / Add row. The whole
 * card is a stretched link to the PDP; the heart and Add CTA layer above it.
 * Server component — imagery is `product.imageUrl` first (real photos drop in
 * with zero markup change), tone gradient as the art-directed fallback.
 */
export function ProductCard({
  product,
  defaultVariantId,
  className,
}: ProductCardProps): ReactNode {
  return (
    <article
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-[20px] border border-line-soft bg-surface",
        "shadow-card transition-[box-shadow,transform] duration-[var(--duration-base)] ease-brand",
        "hover:-translate-y-1 hover:shadow-lift",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {/* Image area — real product image when present, else 4/5 gradient art. */}
      <div className="relative overflow-hidden">
        <div className="transition-transform duration-[650ms] ease-brand group-hover:scale-[1.045] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          {product.imageUrl !== null ? (
            <div className="relative aspect-[4/5] overflow-hidden bg-cream-2">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
            </div>
          ) : (
            <ChocoPlaceholder
              tone={product.tone}
              ratio="4 / 5"
              className="rounded-none!"
            />
          )}
        </div>
        {/* soft floor gradient for legibility of the bottom-left sold-out chip */}
        {!product.inStock ? (
          <span className="absolute bottom-3 left-3 z-10 rounded-pill bg-ink/90 px-[9px] py-[5px] font-mono text-[11px] font-semibold tracking-[0.06em] text-cream uppercase backdrop-blur-sm">
            Sold out
          </span>
        ) : null}
        {product.badge !== null ? (
          <span className="absolute top-3 left-3 z-10 rounded-pill bg-cream/[0.92] px-[10px] py-[5px] font-mono text-[11px] font-semibold tracking-[0.06em] text-ink uppercase shadow-soft backdrop-blur-sm">
            {product.badge}
          </span>
        ) : null}
        <WishlistHeartButton
          productId={product.id}
          productName={product.name}
          iconSize={17}
          className="absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-pill bg-cream/90 text-espresso shadow-soft backdrop-blur-sm transition-transform duration-[var(--duration-fast)] ease-brand hover:scale-110"
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-[18px] pt-[18px] pb-5">
        <h3 className="font-display text-[19px] leading-snug text-ink">
          <Link
            href={`/product/${product.slug}`}
            className="transition-colors group-hover:text-espresso focus-visible:outline-none after:absolute after:inset-0 after:z-0 after:content-['']"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 flex-1 font-body text-[13px] leading-relaxed text-ink-muted">
          {product.blurb}
        </p>
        <div className="mt-2.5 mb-[14px] flex items-center gap-1.5">
          <StarRating value={product.ratingAvg} size="sm" />
          <span className="font-body text-[12.5px] text-ink-soft">
            {product.ratingAvg.toFixed(1)} ({product.ratingCount})
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-[14px]">
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
