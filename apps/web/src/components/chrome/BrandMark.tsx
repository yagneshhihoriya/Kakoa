import type { ReactNode } from "react";
import { cx } from "@kakoa/ui";

/**
 * Cacao-pod line mark, verbatim from the prototype's `#mark` symbol
 * (00-global-header-drawers.html). The symbol is authored on a
 * 150×156 canvas and always consumed through the cropped
 * `viewBox="46 8 88 116"` window, exactly as the reference does.
 * Server-safe — pure SVG, colored via `currentColor`.
 */
export function CacaoMark({ className }: { className?: string }): ReactNode {
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

export interface BrandLockupProps {
  /** Header uses 40px square / 26px wordmark; footer 34px / 25px. */
  size?: "header" | "footer";
  className?: string;
}

/**
 * Gradient-square logo mark + serif wordmark, per the prototype header
 * (`linear-gradient(140deg,#8a5a34,#4a2e1c)` = espresso → cocoa tokens).
 */
export function BrandLockup({
  size = "header",
  className,
}: BrandLockupProps): ReactNode {
  const isHeader = size === "header";
  return (
    <span className={cx("flex items-center", isHeader ? "gap-[11px]" : "gap-2.5", className)}>
      <span
        className={cx(
          "grid flex-none place-items-center bg-[linear-gradient(140deg,var(--color-espresso),var(--color-cocoa))]",
          isHeader
            ? "h-10 w-10 rounded-[10px] shadow-[0_2px_7px_rgba(42,20,10,.22)]"
            : "h-[34px] w-[34px] rounded-[9px]",
        )}
      >
        <CacaoMark
          className={cx("h-auto text-[#e8c9a0]", isHeader ? "w-[22px]" : "w-[19px]")}
        />
      </span>
      <span
        className={cx(
          "font-display leading-none",
          isHeader
            ? "text-[26px] tracking-[.01em] text-ink"
            : "text-[25px] text-card",
        )}
      >
        KAKOA
      </span>
    </span>
  );
}
