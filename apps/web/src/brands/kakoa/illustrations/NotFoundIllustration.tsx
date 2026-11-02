import type { ReactNode } from "react";

/**
 * KAKOA 404 graphic — a gently floating, melting chocolate bar with a drip
 * motif. Pure CSS motion (`kk-float` / `kk-drip` keyframes in globals.css),
 * disabled under `prefers-reduced-motion`. Hexes are the bar's own art
 * direction, not palette tokens.
 */
export function NotFoundIllustration(): ReactNode {
  return (
    <div className="mb-8 animate-[kk-float_5s_ease-in-out_infinite] motion-reduce:animate-none">
      <div className="relative">
        <svg
          width="132"
          height="112"
          viewBox="0 0 132 112"
          fill="none"
          aria-hidden="true"
          className="drop-shadow-[0_18px_28px_rgb(var(--shadow-tint)_/_0.28)]"
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
  );
}
