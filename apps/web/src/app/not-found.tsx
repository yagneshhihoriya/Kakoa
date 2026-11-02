import type { Route } from "next";
import Link from "next/link";
import { illustrations } from "@brand/illustrations";
import { brand } from "@/lib/brand";

/** The pack's 404 graphic and copy; the page owns the eased entrance + CTAs. */
const NotFoundIllustration = illustrations.NotFound;
const { notFound } = brand.copy;

/**
 * Brand 404 — the pack's illustration over an eased entrance. Pure CSS (server
 * component); all motion is disabled under `prefers-reduced-motion`.
 */
export default function NotFound() {
  return (
    <main className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-cream to-[#efe4d2] px-6 py-20 text-center">
      <NotFoundIllustration />

      <div className="animate-[kk-rise_0.6s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none">
        <p className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.28em] text-espresso">
          404
        </p>
        <h1
          className="mb-3 text-[34px] leading-tight text-ink sm:text-[42px]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {notFound.headline}
        </h1>
        <p className="mx-auto mb-8 max-w-md font-body text-[15.5px] leading-relaxed text-espresso">
          {notFound.body}
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={notFound.primary.href as Route}
            className="inline-flex items-center justify-center rounded-pill bg-ink px-7 py-[14px] font-body text-[15px] font-bold text-card no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:bg-ink-hover hover:shadow-md active:translate-y-0 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none"
          >
            {notFound.primary.label}
          </Link>
          <Link
            href={notFound.secondary.href as Route}
            className="inline-flex items-center justify-center rounded-pill border-[1.5px] border-line-strong px-7 py-[14px] font-body text-[15px] font-bold text-ink no-underline transition-all hover:-translate-y-0.5 hover:bg-card active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
          >
            {notFound.secondary.label}
          </Link>
        </div>
      </div>
    </main>
  );
}
