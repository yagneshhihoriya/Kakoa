import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ProductCardView } from "@kakoa/core";
import { formatPaise } from "@kakoa/core";
import { TONE_GRADIENTS } from "@/components/catalog/ChocoPlaceholder";

/** Focus ring for the bespoke floating chip link. */
const CHIP_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

/**
 * Home hero visual — studio-lit plated 16-piece tasting box with gold wax
 * seal and a floating product chip. Verbatim translation of the prototype
 * hero markup (reference/10-home.html). Server component; the only live data
 * is the chip product (name / badge / price via `formatPaise`).
 *
 * Hexes are prototype scene lighting — same art-direction carve-out as
 * `ChocoPlaceholder` / `ChocoScene`.
 */

/** 16 molded pieces, row-major, exact gradient order from the reference. */
const PIECE_GRADIENTS: readonly string[] = [
  "linear-gradient(150deg,#6b4326,#2a1a10 80%)",
  "linear-gradient(150deg,#b07c4c,#734a29 82%)",
  "linear-gradient(150deg,#c58f84,#6f3d38 82%)",
  "linear-gradient(150deg,#e2af64,#a9722f 82%)",
  "linear-gradient(150deg,#e2af64,#a9722f 82%)",
  "linear-gradient(150deg,#a5764a,#5f3d22 82%)",
  "linear-gradient(150deg,#6b4326,#2a1a10 80%)",
  "linear-gradient(150deg,#b07c4c,#734a29 82%)",
  "linear-gradient(150deg,#b07c4c,#734a29 82%)",
  "linear-gradient(150deg,#c58f84,#6f3d38 82%)",
  "linear-gradient(150deg,#aeb672,#6d7a3c 82%)",
  "linear-gradient(150deg,#6b4326,#2a1a10 80%)",
  "linear-gradient(150deg,#6b4326,#2a1a10 80%)",
  "linear-gradient(150deg,#e2af64,#a9722f 82%)",
  "linear-gradient(150deg,#b07c4c,#734a29 82%)",
  "linear-gradient(150deg,#c58f84,#6f3d38 82%)",
];

const PIECE_SHADOW =
  "inset 3px 4px 6px rgba(255,255,255,.26),inset -3px -7px 11px rgba(0,0,0,.42),0 3px 6px rgba(0,0,0,.3)";

export interface HeroShowcaseProps {
  /** Product surfaced in the floating chip (nullable while catalog is empty). */
  product: ProductCardView | null;
  /**
   * Optional hero photograph. When supplied it replaces the art-directed
   * tasting-box scene inside the same framed slot (gold seal + floating chip
   * still overlay it), so real studio photography can drop in with no layout
   * change. Falls back to the gradient scene when omitted.
   */
  imageUrl?: string | null;
  /** Accessible description for the hero photograph. */
  imageAlt?: string;
}

export function HeroShowcase({
  product,
  imageUrl,
  imageAlt = "KAKOA signature tasting box",
}: HeroShowcaseProps): ReactNode {
  const hasPhoto = typeof imageUrl === "string" && imageUrl !== "";
  return (
    <div className="relative mx-auto w-full max-w-[380px] lg:max-w-none">
      {/* ambient studio glow (behind) */}
      <div
        aria-hidden="true"
        className="absolute -top-[4%] right-[2%] z-0 h-[44%] w-[44%] rounded-pill bg-[#EAC7A2] opacity-55 blur-[48px]"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 -left-[6%] z-0 h-[34%] w-[34%] rounded-pill bg-[#C7D0A6] opacity-50 blur-[44px]"
      />

      {/* plated tasting box (studio-lit) — real photo drops into the same
          framed slot when `imageUrl` is supplied, else the gradient scene. */}
      <div
        aria-hidden={hasPhoto ? undefined : "true"}
        className="relative z-[1] aspect-square overflow-hidden rounded-[28px] shadow-[0_34px_80px_rgba(42,29,18,.32)]"
      >
        {hasPhoto ? (
          <Image
            src={imageUrl as string}
            alt={imageAlt}
            fill
            priority
            sizes="(max-width: 1024px) 92vw, 46vw"
            className="object-cover"
          />
        ) : (
          <>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(115% 100% at 30% 16%, #F5E7D1 0%, #E7D0AC 46%, #D7BA8F 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(66% 56% at 30% 22%, rgba(255,255,255,.55), transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(95% 85% at 82% 104%, rgba(50,28,14,.42), transparent 58%)",
          }}
        />
        {/* the box */}
        <div
          className="absolute rounded-[18px] motion-safe:animate-[kk-drift_16s_ease-in-out_infinite]"
          style={{
            inset: "10.5% 11.5%",
            background: "linear-gradient(158deg,#3b2517 0%,#20100A 100%)",
            boxShadow:
              "0 26px 46px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.09)",
            padding: "6.4%",
          }}
        >
          <div
            className="grid h-full grid-cols-4 grid-rows-4"
            style={{ gap: "7.2%" }}
          >
            {PIECE_GRADIENTS.map((gradient, index) => (
              <div
                key={index}
                className="rounded-[30%]"
                style={{ background: gradient, boxShadow: PIECE_SHADOW }}
              />
            ))}
          </div>
        </div>
        <div className="absolute bottom-[5.2%] left-[7%] z-[2] font-mono text-[10px] font-medium tracking-[0.2em] text-[rgba(74,46,28,.6)] uppercase">
          Signature — 16-piece tasting box
        </div>
          </>
        )}
      </div>

      {/* gold wax seal */}
      <div
        aria-hidden="true"
        className="absolute -top-3 -right-1 z-[3] grid h-[68px] w-[68px] -rotate-[8deg] place-items-center rounded-pill sm:-top-4 sm:-right-2 sm:h-[84px] sm:w-[84px]"
        style={{
          background:
            "radial-gradient(circle at 34% 28%, #EFD59A, #BE9346 74%)",
          boxShadow:
            "0 14px 30px rgba(140,90,40,.38),inset 0 2px 5px rgba(255,255,255,.5),inset 0 -5px 9px rgba(120,78,32,.42)",
        }}
      >
        <div className="grid h-[62px] w-[62px] place-items-center rounded-pill border border-[rgba(74,46,28,.4)]">
          <span className="font-display text-[34px] leading-none text-[#3a2414]">
            K
          </span>
        </div>
      </div>

      {/* floating product chip — live catalog data; links to its PDP */}
      {product !== null ? (
        <Link
          href={`/product/${product.slug}`}
          aria-label={`View ${product.name}`}
          className={`group/chip absolute bottom-6 -left-1 z-[3] flex items-center gap-3 rounded-lg bg-cream px-[15px] py-3 no-underline shadow-[0_18px_44px_rgba(42,29,18,.22)] transition-shadow duration-[var(--duration-base)] ease-brand hover:shadow-[0_22px_54px_rgba(42,29,18,.30)] motion-safe:animate-[kk-float_6s_ease-in-out_infinite] sm:bottom-11 sm:-left-[22px] sm:px-[17px] sm:py-[13px] ${CHIP_FOCUS}`}
        >
          <div
            aria-hidden="true"
            className="relative h-[52px] w-11 flex-none overflow-hidden rounded-[10px]"
            style={
              product.imageUrl !== null
                ? undefined
                : {
                    backgroundImage: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%), ${TONE_GRADIENTS[product.tone]}`,
                  }
            }
          >
            {product.imageUrl !== null ? (
              <Image
                src={product.imageUrl}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div>
            <div className="font-body text-[13.5px] font-semibold text-ink transition-colors group-hover/chip:text-espresso">
              {product.name}
            </div>
            <div className="mt-0.5 mb-[3px] text-xs text-ink-muted">
              {product.badge ?? "New this season"}
            </div>
            <div className="font-body text-sm font-bold text-espresso">
              <data value={product.fromPricePaise}>
                {formatPaise(product.fromPricePaise)}
              </data>
            </div>
          </div>
        </Link>
      ) : null}
    </div>
  );
}
