import type { ReactNode } from "react";
import type { BrandMark } from "../contract";

/**
 * Cacao-pod line mark, verbatim from the prototype's `#mark` symbol
 * (00-global-header-drawers.html). The symbol is authored on a
 * 150×156 canvas and always consumed through the cropped
 * `viewBox="46 8 88 116"` window, exactly as the reference does.
 * Server-safe — pure SVG, colored via `currentColor`.
 */
export function Mark({ className }: { className?: string }): ReactNode {
  return (
    <svg viewBox="46 8 88 116" aria-hidden="true" className={className}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M62 48 C78 55 84 72 84 91 C84 112 75 127 62 137 C49 127 40 112 40 91 C40 72 46 55 62 48 Z" />
        <path d="M62 55 L62 131" />
        <path d="M51 60 C46 80 46 104 55 128" />
        <path d="M73 60 C78 80 78 104 69 128" />
        <path d="M62 48 C61 37 63 30 70 25" />
        <path d="M70 25 C97 23 116 41 110 69 C91 66 74 47 70 25 Z" />
        <path d="M76 32 C87 43 97 55 104 66" />
      </g>
    </svg>
  );
}

Mark satisfies BrandMark;
