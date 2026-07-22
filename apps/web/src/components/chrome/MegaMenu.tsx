import type { ReactNode } from "react";
import Link from "next/link";
import { PhotoSlot } from "@/components/home/PhotoSlot";

/**
 * Desktop "Shop" mega-menu panel (≥1000px). A full-width cream panel that drops
 * below the header: a "Shop by collection" list plus a photo-ready featured
 * tile. Presentational only — the Header owns open/close state, hover/focus
 * intent, Escape handling and the full-width positioning. All colour comes from
 * `@theme` tokens.
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

/** Collections surfaced in the panel — hrefs mirror the mobile drill-down.
 * `as const` keeps each href a literal so Next's typed routes accept it. */
const COLLECTIONS = [
  { href: "/shop", label: "All chocolate", desc: "The full collection" },
  { href: "/shop?category=bars", label: "Bars", desc: "Single-origin & flavoured" },
  { href: "/shop?category=pralines", label: "Pralines", desc: "Filled & ganache" },
  { href: "/shop?category=signature", label: "Signature", desc: "Tasting boxes" },
  { href: "/shop?category=gifts", label: "Gifts", desc: "Ready to give" },
] as const;

export interface MegaMenuProps {
  /** Called when any link is activated, so the Header can close the panel. */
  onNavigate: () => void;
}

export function MegaMenu({ onNavigate }: MegaMenuProps): ReactNode {
  return (
    <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_300px] lg:gap-12">
      <div>
        <div className="mb-4 flex items-center gap-[13px] font-mono text-[11px] font-medium tracking-[0.16em] text-espresso uppercase">
          <span aria-hidden="true" className="inline-block h-px w-[26px] bg-espresso" />
          Shop by collection
        </div>
        <ul className="grid grid-cols-2 gap-1.5">
          {COLLECTIONS.map((collection) => (
            <li key={collection.label}>
              <Link
                href={collection.href}
                onClick={onNavigate}
                className={`group/col block rounded-[12px] px-3 py-2.5 no-underline transition-colors hover:bg-cream-2 ${FOCUS_RING}`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-[18px] leading-tight text-ink transition-colors group-hover/col:text-espresso">
                    {collection.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="translate-x-0 text-espresso opacity-0 transition-[opacity,transform] duration-[var(--duration-base)] ease-brand group-hover/col:translate-x-0.5 group-hover/col:opacity-100"
                  >
                    →
                  </span>
                </span>
                <span className="mt-0.5 block font-body text-[12.5px] text-ink-muted">
                  {collection.desc}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Featured tile — photo-ready (a real `src` drops into PhotoSlot later). */}
      <Link
        href="/shop"
        onClick={onNavigate}
        className={`group/feat relative flex min-h-[168px] flex-col justify-end overflow-hidden rounded-[18px] p-5 no-underline shadow-soft ${FOCUS_RING}`}
      >
        <PhotoSlot alt="" sizes="300px">
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-cocoa to-ink" />
        </PhotoSlot>
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,10,4,.72),rgba(20,10,4,.05)_60%)]"
        />
        <span className="relative font-mono text-[10.5px] font-medium tracking-[0.16em] text-gold-soft uppercase">
          Featured
        </span>
        <span className="relative mt-1 font-display text-[22px] leading-tight text-cream">
          Best sellers
        </span>
        <span className="relative mt-1 inline-flex items-center gap-1.5 font-body text-[13px] font-semibold text-cream/85 transition-[gap] group-hover/feat:gap-2.5">
          Shop now <span aria-hidden="true">→</span>
        </span>
      </Link>
    </div>
  );
}
