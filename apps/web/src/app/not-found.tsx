import Link from "next/link";

/**
 * Brand 404 — a gently floating, melting chocolate bar with a drip motif and
 * an eased entrance. Pure CSS (server component); all motion is disabled under
 * `prefers-reduced-motion`.
 */
export default function NotFound() {
  return (
    <main className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-cream to-[#efe4d2] px-6 py-20 text-center">
      {/* Floating chocolate bar + drips */}
      <div className="mb-8 animate-[kk-float_5s_ease-in-out_infinite] motion-reduce:animate-none">
        <div className="relative">
          <svg
            width="132"
            height="112"
            viewBox="0 0 132 112"
            fill="none"
            aria-hidden="true"
            className="drop-shadow-[0_18px_28px_rgba(42,29,18,0.28)]"
          >
            <defs>
              <linearGradient id="kk-404-bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a06a3c" />
                <stop offset="100%" stopColor="#5c3a20" />
              </linearGradient>
            </defs>
            <rect x="6" y="6" width="120" height="80" rx="12" fill="url(#kk-404-bar)" />
            {/* Segment grooves */}
            {[36, 66, 96].map((x) => (
              <line key={x} x1={x} y1="10" x2={x} y2="82" stroke="#3f2716" strokeWidth="2.5" strokeOpacity="0.5" />
            ))}
            {[32, 58].map((y) => (
              <line key={y} x1="10" y1={y} x2="122" y2={y} stroke="#3f2716" strokeWidth="2.5" strokeOpacity="0.5" />
            ))}
            {/* Glossy highlight */}
            <rect x="14" y="12" width="104" height="10" rx="5" fill="#ffffff" fillOpacity="0.14" />
          </svg>
          {/* Melting drips under the bar */}
          <span className="absolute -bottom-1 left-[26px] h-4 w-3 rounded-b-full bg-[#5c3a20] animate-[kk-drip_2.4s_ease-in_infinite] motion-reduce:hidden" />
          <span className="absolute -bottom-1 left-[62px] h-5 w-3.5 rounded-b-full bg-[#4c2f19] animate-[kk-drip_2.8s_ease-in_0.6s_infinite] motion-reduce:hidden" />
          <span className="absolute -bottom-1 left-[96px] h-4 w-3 rounded-b-full bg-[#5c3a20] animate-[kk-drip_2.6s_ease-in_1.1s_infinite] motion-reduce:hidden" />
        </div>
      </div>

      <div className="animate-[kk-rise_0.6s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none">
        <p className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.28em] text-[#8a5a34]">
          404
        </p>
        <h1
          className="mb-3 text-[34px] leading-tight text-ink sm:text-[42px]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          This page has melted away.
        </h1>
        <p className="mx-auto mb-8 max-w-md font-body text-[15.5px] leading-relaxed text-espresso">
          The page you&apos;re looking for doesn&apos;t exist — but the chocolate
          most certainly does.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-pill bg-ink px-7 py-[14px] font-body text-[15px] font-bold text-card no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#3f2c1b] hover:shadow-md active:translate-y-0 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none"
          >
            Explore the collection
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-pill border-[1.5px] border-[#E0CFB6] px-7 py-[14px] font-body text-[15px] font-bold text-ink no-underline transition-all hover:-translate-y-0.5 hover:bg-[#F3E7D5] active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
