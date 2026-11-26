import { cx } from "@kakoa/ui";

/**
 * Shared pill styling for the card "Add" CTA — reference collection card
 * (variant A price row). Lives in a plain module (no 'use client') so BOTH
 * the client AddToBagButton and server fallbacks (sold-out button, PDP
 * link) can import it and render pixel-identical.
 */
export const ADD_TO_BAG_CLASSES = cx(
  "relative z-10 inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-[18px] font-body text-[13.5px] font-bold text-card transition-[transform,background-color] hover:bg-ink-hover active:scale-[0.96] motion-reduce:active:scale-100",
  "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none",
);

/**
 * Square icon tile for phone product grids — sits in the photo's bottom-right
 * corner (the compact grid read of premium D2C stores), replacing the
 * full-width pill below sm. Same z-index contract as the pill so it stays
 * above the card's stretched link.
 */
export const ADD_TO_BAG_ICON_CLASSES = cx(
  "relative z-10 grid h-10 w-10 place-items-center rounded-[10px] bg-cream/95 text-ink shadow-soft backdrop-blur-sm transition-[transform,background-color] hover:bg-cream active:scale-[0.94] motion-reduce:active:scale-100",
  "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none",
);
