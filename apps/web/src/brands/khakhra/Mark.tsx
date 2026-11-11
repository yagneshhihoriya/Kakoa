import type { ReactNode } from "react";
import type { BrandMark } from "../contract";

/**
 * Roasted-disc roundel — a khakhra seen from above: the rim, a soft roast
 * line and the scatter of blister marks a slow tava roast leaves. Original
 * artwork on a 100×100 canvas. Server-safe — pure SVG, coloured via
 * `currentColor` (strokes and the filled blisters alike).
 */
export function Mark({ className }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="50" r="40" />
        <path d="M26 62 C36 72 62 74 76 60" />
      </g>
      <g fill="currentColor">
        <circle cx="38" cy="34" r="5" />
        <circle cx="58" cy="28" r="3.5" />
        <circle cx="66" cy="44" r="5" />
        <circle cx="48" cy="50" r="3" />
        <circle cx="30" cy="48" r="3.5" />
        <circle cx="56" cy="62" r="2.5" />
      </g>
    </svg>
  );
}

Mark satisfies BrandMark;
