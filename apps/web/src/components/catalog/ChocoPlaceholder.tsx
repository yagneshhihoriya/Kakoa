import type { ReactNode } from "react";
import type { ProductTone } from "@kakoa/core";
import { cx } from "@kakoa/ui";

/**
 * Tone → gradient map, verbatim from the prototype (design-system placeholder
 * tones — `products.tone`). Products may ship without real photography, so
 * every empty image slot renders this gradient block instead. These hexes are
 * art direction, not palette tokens — they exist only here.
 */
export const TONE_GRADIENTS: Record<ProductTone, string> = {
  dark: "linear-gradient(140deg, #4a2e1c 0%, #2c150a 100%)",
  milk: "linear-gradient(140deg, #a06a3c 0%, #623f22 100%)",
  caramel: "linear-gradient(140deg, #e0a457 0%, #a86a2c 100%)",
  ruby: "linear-gradient(140deg, #b8827a 0%, #6f3d38 100%)",
  white: "linear-gradient(140deg, #f2e6d2 0%, #dcc6a2 100%)",
  matcha: "linear-gradient(140deg, #9aa863 0%, #5f6e39 100%)",
};

/**
 * Layered lighting stacked over each tone gradient for a tactile,
 * molded-chocolate read: a broad top-left specular, a tight glossy hotspot,
 * and a bottom-right vignette for depth. Composited front-to-back.
 */
const SHEEN = [
  "radial-gradient(60% 45% at 28% 20%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 60%)",
  "radial-gradient(18% 14% at 24% 18%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)",
  "radial-gradient(90% 80% at 84% 108%, rgba(30,16,8,0.42) 0%, rgba(30,16,8,0) 55%)",
].join(", ");

export interface ChocoPlaceholderProps {
  tone: ProductTone;
  /** Optional label chip rendered bottom-left (e.g. category name). */
  label?: string;
  /** CSS `aspect-ratio` for the container. Default square. */
  ratio?: string;
  className?: string;
}

/**
 * Server component — tone-based gradient placeholder for product imagery.
 * Dimension-locked via `aspect-ratio` so it contributes zero CLS.
 */
export function ChocoPlaceholder({
  tone,
  label,
  ratio = "1 / 1",
  className,
}: ChocoPlaceholderProps): ReactNode {
  return (
    <div
      aria-hidden={label === undefined ? true : undefined}
      className={cx("relative w-full overflow-hidden rounded-lg", className)}
      style={{
        aspectRatio: ratio,
        backgroundImage: `${SHEEN}, ${TONE_GRADIENTS[tone]}`,
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
