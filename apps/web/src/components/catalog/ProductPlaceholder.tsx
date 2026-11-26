import type { ReactNode } from "react";
import { cx } from "@kakoa/ui";
import { swatchFor } from "@/lib/brand";

/**
 * Swatch gradient for a `products.tone` value — the vertical preset's
 * `presentation.swatches` (the chocolate preset carries the prototype's molded
 * tone studies). Products may ship without real photography, so every empty
 * image slot renders this gradient block instead. Unknown tones resolve to the
 * preset's default swatch, so this never throws.
 */
export function swatchGradient(tone: string): string {
  const { from, to } = swatchFor(tone);
  return `linear-gradient(140deg, ${from} 0%, ${to} 100%)`;
}

/**
 * Layered lighting stacked over each swatch gradient for a tactile, molded
 * read: a broad top-left specular, a tight glossy hotspot, and a bottom-right
 * vignette for depth. Composited front-to-back.
 */
const SHEEN = [
  "radial-gradient(60% 45% at 28% 20%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 60%)",
  "radial-gradient(18% 14% at 24% 18%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)",
  "radial-gradient(90% 80% at 84% 108%, rgba(30,16,8,0.42) 0%, rgba(30,16,8,0) 55%)",
].join(", ");

export interface ProductPlaceholderProps {
  /** Swatch key (`products.tone`); any string is accepted. */
  tone: string;
  /** Optional label chip rendered bottom-left (e.g. category name). */
  label?: string;
  /** CSS `aspect-ratio` for the container. Default square. */
  ratio?: string;
  className?: string;
}

/**
 * Server component — swatch-based gradient placeholder for product imagery.
 * Dimension-locked via `aspect-ratio` so it contributes zero CLS.
 */
export function ProductPlaceholder({
  tone,
  label,
  ratio = "1 / 1",
  className,
}: ProductPlaceholderProps): ReactNode {
  return (
    <div
      aria-hidden={label === undefined ? true : undefined}
      className={cx("relative w-full overflow-hidden rounded-lg", className)}
      style={{
        aspectRatio: ratio,
        backgroundImage: `${SHEEN}, ${swatchGradient(tone)}`,
      }}
    >
      {label !== undefined ? (
        <span className="absolute bottom-3 left-3 rounded-pill bg-cream/90 px-3 py-1 font-body text-xs font-semibold text-ink shadow-soft">
          {label}
        </span>
      ) : null}
    </div>
  );
}
