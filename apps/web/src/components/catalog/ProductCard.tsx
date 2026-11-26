import type { ReactNode } from "react";
import Link from "next/link";
import type { ProductCardView } from "@kakoa/core";
import { Price, StarRating, cx } from "@kakoa/ui";
import { AddToBagButton } from "@/components/cart/AddToBagButton";
import {
  ADD_TO_BAG_CLASSES,
  ADD_TO_BAG_ICON_CLASSES,
} from "@/components/cart/add-to-bag-classes";
import { BagPlusIcon } from "@/components/cart/bag-icons";
import { WishlistHeartButton } from "@/components/auth/WishlistHeartButton";
import { SafeImage } from "@/components/media/SafeImage";
import { ProductPlaceholder } from "./ProductPlaceholder";

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
 * Catalog product card.
 *
 * ≥ sm (tablet and desktop, unchanged): a raised paper card with a flush 4/5
 * image that slowly zooms on hover, a hairline badge chip + wishlist heart,
 * serif name, 2-line blurb, stars, and the price / Add row.
 *
 * < sm (phones): the compact grid tile of premium D2C stores — no card
 * chrome, a square photo with the add-to-bag icon in its corner, the name on
 * up to two lines, stars when the product has any, and the price. Two tiles
 * fit a phone screen with room to spare, so a grid reads as a collection
 * rather than a stack of panels. The blurb, the "New" label and the divider
 * are desktop-only; the badge chip on the photo carries the same signal.
 *
 * The whole card is a stretched link to the PDP; the heart and the add CTA
 * (pill or corner icon) layer above it. Server component — imagery is
 * `product.imageUrl` first (real photos drop in with zero markup change),
 * swatch gradient as the art-directed fallback.
 */
export function ProductCard({
  product,
  defaultVariantId,
  className,
}: ProductCardProps): ReactNode {
  const isOnSale =
    product.compareAtPricePaise !== null &&
    product.compareAtPricePaise > product.fromPricePaise;
  const pdpHref = `/product/${product.slug}`;
  return (
    <article
      className={cx(
        "group relative flex flex-col",
        // ≥ sm: the raised paper card.
        "sm:overflow-hidden sm:rounded-[20px] sm:border sm:border-line-soft sm:bg-surface",
        "sm:shadow-card sm:transition-[box-shadow,transform] sm:duration-[var(--duration-base)] sm:ease-brand",
        "sm:hover:-translate-y-1 sm:hover:shadow-lift",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {/* Image area — real product image when present, else gradient art.
          Square rounded tile on phones; 4/5 and flush inside the card from sm. */}
      <div className="relative overflow-hidden rounded-[14px] sm:rounded-none">
        <div className="transition-transform duration-[650ms] ease-brand group-hover:scale-[1.045] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          {product.imageUrl !== null ? (
            <div className="relative aspect-square overflow-hidden bg-cream-2 sm:aspect-[4/5]">
              <SafeImage
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 33vw, 25vw"
                className="object-cover"
              />
            </div>
          ) : (
            <>
              <ProductPlaceholder tone={product.tone} ratio="1 / 1" className="rounded-none! sm:hidden" />
              <ProductPlaceholder tone={product.tone} ratio="4 / 5" className="rounded-none! max-sm:hidden" />
            </>
          )}
        </div>
        {/* soft floor gradient for legibility of the bottom-left sold-out chip */}
        {!product.inStock ? (
          <span className="absolute bottom-3 left-3 z-10 rounded-pill bg-ink/90 px-[9px] py-[5px] font-mono text-[11px] font-semibold tracking-[0.06em] text-cream uppercase backdrop-blur-sm">
            Sold out
          </span>
        ) : null}
        {product.badge !== null ? (
          <span className="absolute top-3 left-3 z-10 rounded-pill bg-cream/[0.92] px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.06em] text-ink uppercase shadow-soft backdrop-blur-sm sm:px-[10px] sm:py-[5px] sm:text-[11px]">
            {product.badge}
          </span>
        ) : null}
        <WishlistHeartButton
          productId={product.id}
          productName={product.name}
          iconSize={17}
          className="absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-pill bg-cream/90 text-espresso shadow-soft backdrop-blur-sm transition-transform duration-[var(--duration-fast)] ease-brand hover:scale-110"
        />
        {/* PHONES — add-to-bag icon in the photo corner; the price-row pill
            below is ≥ sm only. Same three states as the pill. */}
        <div className="absolute right-3 bottom-3 z-10 sm:hidden">
          {!product.inStock ? (
            <button
              type="button"
              disabled
              aria-label={`${product.name} is sold out`}
              className={cx(ADD_TO_BAG_ICON_CLASSES, "cursor-not-allowed opacity-50")}
            >
              <BagPlusIcon />
            </button>
          ) : typeof defaultVariantId === "string" ? (
            <AddToBagButton
              variantId={defaultVariantId}
              productName={product.name}
              variant="icon"
            />
          ) : (
            <Link
              href={pdpHref}
              aria-label={`View ${product.name}`}
              className={ADD_TO_BAG_ICON_CLASSES}
            >
              <BagPlusIcon />
            </Link>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col pt-3 pb-1 sm:px-[18px] sm:pt-[18px] sm:pb-5">
        <h3 className="line-clamp-2 font-display text-[16px] leading-snug text-ink sm:line-clamp-none sm:text-[19px]">
          <Link
            href={pdpHref}
            className="transition-colors group-hover:text-espresso focus-visible:outline-none after:absolute after:inset-0 after:z-0 after:content-['']"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 flex-1 font-body text-[13px] leading-relaxed text-ink-muted max-sm:hidden">
          {product.blurb}
        </p>
        <div
          className={cx(
            "flex items-center gap-1.5 sm:mt-2.5 sm:mb-[14px] sm:min-h-[18px]",
            product.ratingCount > 0 ? "mt-1.5" : "max-sm:hidden",
          )}
        >
          {product.ratingCount > 0 ? (
            <>
              <StarRating value={product.ratingAvg} size="sm" />
              <span className="font-body text-[12.5px] text-ink-soft">
                {product.ratingAvg.toFixed(1)} ({product.ratingCount})
              </span>
            </>
          ) : (
            <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-ink-muted uppercase">
              New
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 sm:mt-0 sm:border-t sm:border-line-soft sm:pt-[14px]">
          <Price
            paise={product.fromPricePaise}
            compareAtPaise={product.compareAtPricePaise ?? undefined}
          />
          {/* PHONE-only "Sale" flag — desktop keeps the plain price row. The
              struck compare-at itself is rendered by <Price> on both. */}
          {isOnSale ? (
            <span className="rounded-pill bg-raspberry/12 px-[9px] py-[3px] font-mono text-[10.5px] font-semibold tracking-[0.06em] text-raspberry uppercase sm:hidden">
              Sale
            </span>
          ) : null}
          {/* DESKTOP CTA — unchanged pill in the price row. `contents` keeps the
              flex layout identical to before; `max-sm:hidden` drops it on
              phones in favour of the corner icon on the photo. */}
          <div className="contents max-sm:hidden">
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
                href={pdpHref}
                aria-label={`View ${product.name}`}
                className={ADD_TO_BAG_CLASSES}
              >
                Add
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
