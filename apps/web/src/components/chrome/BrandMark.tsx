import type { ReactNode } from "react";
import { cx } from "@kakoa/ui";
import { Mark } from "@brand/Mark";
import { brand } from "@/lib/brand";

export interface BrandLockupProps {
  /** Header uses 40px square / 26px wordmark; footer 34px / 25px. */
  size?: "header" | "footer";
  /** `brand.logo_url` setting — an uploaded logo replaces the drawn mark square. */
  logoUrl?: string | null;
  className?: string;
}

/**
 * Gradient-square logo mark + serif wordmark, per the prototype header
 * (`linear-gradient(140deg,#8a5a34,#4a2e1c)` = espresso → cocoa tokens).
 * The mark itself is the brand pack's `Mark` — or the owner's uploaded logo
 * (`brand.logo_url`) when set; the wordmark is the brand name.
 */
export function BrandLockup({
  size = "header",
  logoUrl = null,
  className,
}: BrandLockupProps): ReactNode {
  const isHeader = size === "header";
  const square = isHeader
    ? "h-10 w-10 rounded-[10px] shadow-[0_2px_7px_rgba(42,20,10,.22)]"
    : "h-[34px] w-[34px] rounded-[9px]";
  return (
    <span className={cx("flex items-center", isHeader ? "gap-[11px]" : "gap-2.5", className)}>
      {logoUrl !== null ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-supplied logo URL; host not known to next/image
        <img src={logoUrl} alt="" className={cx("flex-none object-cover", square)} />
      ) : (
        <span
          className={cx(
            "grid flex-none place-items-center bg-[linear-gradient(140deg,var(--color-espresso),var(--color-cocoa))]",
            square,
          )}
        >
          <Mark
            className={cx("h-auto text-gold-soft", isHeader ? "w-[22px]" : "w-[19px]")}
          />
        </span>
      )}
      <span
        className={cx(
          "font-display leading-none",
          isHeader
            ? "text-[26px] tracking-[.01em] text-ink"
            : "text-[25px] text-card",
        )}
      >
        {brand.profile.name}
      </span>
    </span>
  );
}
