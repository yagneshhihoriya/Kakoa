import { cx } from "@kakoa/ui";

/**
 * Shared pill styling for the card "Add" CTA — reference collection card
 * (variant A price row). Lives in a plain module (no 'use client') so BOTH
 * the client AddToBagButton and server fallbacks (sold-out button, PDP
 * link) can import it and render pixel-identical.
 */
export const ADD_TO_BAG_CLASSES = cx(
  "relative z-10 inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-[18px] font-body text-[13.5px] font-bold text-[#F3E7D5] transition-colors hover:bg-[#3f2c1b]",
  "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none",
);
