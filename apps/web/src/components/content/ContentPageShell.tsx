import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";

/**
 * Shared content-page primitives for KAKOA's editorial / reference surfaces
 * (Help/FAQ, Journal articles, and — retrofit-ready — Legal/Contact). Extracted
 * so every long-form page inherits the same eyebrow → DM Serif H1 → measured
 * reading column, and can't drift on spacing, type scale, or palette. All colour
 * comes from `@theme` design tokens — no raw hex.
 */

/** DM-Mono eyebrow with a growing rule — the KAKOA section signature. */
export function Eyebrow({
  children,
  tone = "espresso",
}: {
  children: ReactNode;
  tone?: "espresso" | "gold";
}): ReactNode {
  const color = tone === "gold" ? "text-gold-soft" : "text-espresso";
  const rule = tone === "gold" ? "bg-gold-soft/70" : "bg-espresso";
  return (
    <div
      className={`flex items-center gap-[13px] font-mono text-eyebrow font-medium uppercase ${color}`}
    >
      <span aria-hidden="true" className={`inline-block h-px w-[30px] ${rule}`} />
      {children}
    </div>
  );
}

/** Shared focus treatment for bespoke interactive elements on content pages. */
export const CONTENT_FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export interface Crumb {
  label: string;
  href: Route;
}

export interface ContentPageShellProps {
  /** Mono eyebrow above the title. */
  eyebrow: string;
  eyebrowTone?: "espresso" | "gold";
  /** DM Serif H1. */
  title: string;
  /** Optional intro paragraph under the title. */
  lede?: ReactNode;
  /** Optional mono meta line (e.g. "Updated 12 July 2026 · 4 min read"). */
  meta?: ReactNode;
  /** Optional breadcrumb trail rendered above the eyebrow. */
  breadcrumb?: Crumb[];
  /** Constrained reading measure. `narrow` for docs, `wide` for card grids. */
  width?: "narrow" | "wide";
  /** Page body. */
  children: ReactNode;
  /** Optional closing call-to-action band rendered full-bleed below the body. */
  footer?: ReactNode;
}

/**
 * Long-form content shell: a breadcrumb + mono eyebrow + DM Serif H1 + optional
 * lede/meta over a constrained reading column, with an optional closing band.
 * Server component.
 */
export function ContentPageShell({
  eyebrow,
  eyebrowTone = "espresso",
  title,
  lede,
  meta,
  breadcrumb,
  width = "narrow",
  children,
  footer,
}: ContentPageShellProps): ReactNode {
  const measure = width === "wide" ? "max-w-[1180px]" : "max-w-[820px]";
  return (
    <main>
      <div className={`mx-auto w-full ${measure} px-6 pt-12 pb-14 md:px-8 md:pt-16`}>
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex flex-wrap items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-ink-muted uppercase"
          >
            {breadcrumb.map((crumb, index) => (
              <span key={crumb.href} className="flex items-center gap-1.5">
                <Link
                  href={crumb.href}
                  className={`transition-colors hover:text-espresso ${CONTENT_FOCUS_RING} rounded-sm`}
                >
                  {crumb.label}
                </Link>
                {index < breadcrumb.length - 1 ? (
                  <span aria-hidden="true" className="text-line">
                    /
                  </span>
                ) : null}
              </span>
            ))}
          </nav>
        ) : null}

        <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>

        <h1 className="mt-3.5 font-display text-[34px] leading-[1.06] text-balance text-ink md:text-[44px]">
          {title}
        </h1>

        {meta ? (
          <p className="mt-3 font-mono text-[11.5px] tracking-[0.06em] text-ink-muted uppercase">
            {meta}
          </p>
        ) : null}

        {lede ? (
          <div className="mt-5 max-w-[62ch] font-body text-lead text-ink-soft">
            {lede}
          </div>
        ) : null}

        <div className="mt-10">{children}</div>
      </div>

      {footer}
    </main>
  );
}

/**
 * Reusable closing CTA band — a warm cocoa strip inviting the reader back to
 * shopping or the newsletter. Drop into `ContentPageShell`'s `footer` slot.
 */
export function ContentClosingCta({
  eyebrow = "Ready when you are",
  title,
  body,
  primary,
  secondary,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  primary: Crumb;
  secondary?: Crumb;
}): ReactNode {
  return (
    <section aria-label="Keep exploring" className="border-t border-line bg-cream-2">
      <div className="mx-auto max-w-[1180px] px-6 py-14 text-center md:px-8 md:py-[72px]">
        <div className="flex justify-center">
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h2 className="mx-auto mt-4 max-w-[20ch] font-display text-h2 leading-[1.08] text-balance text-ink">
          {title}
        </h2>
        {body ? (
          <p className="mx-auto mt-4 max-w-[52ch] font-body text-lead text-ink-soft">
            {body}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3.5">
          <Link
            href={primary.href}
            className={`rounded-pill bg-ink px-[30px] py-4 font-body text-[15.5px] font-bold text-cream shadow-lift transition-[transform,background-color] duration-[var(--duration-base)] ease-brand hover:-translate-y-0.5 hover:bg-ink-hover motion-reduce:transform-none ${CONTENT_FOCUS_RING}`}
          >
            {primary.label}
          </Link>
          {secondary ? (
            <Link
              href={secondary.href}
              className={`rounded-pill border-[1.5px] border-ink/25 px-[30px] py-4 font-body text-[15.5px] font-bold text-ink transition-colors hover:border-ink hover:bg-card ${CONTENT_FOCUS_RING}`}
            >
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
