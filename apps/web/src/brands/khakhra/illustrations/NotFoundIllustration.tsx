import type { ReactNode } from "react";

/**
 * Khakhra House 404 graphic — a roasted disc with a bite taken out, gently
 * floating, with a few crumbs below. Pure CSS motion (`kk-float` keyframes in
 * globals.css), disabled under `prefers-reduced-motion`. Hexes are the disc's
 * own art direction, not palette tokens.
 */
export function NotFoundIllustration(): ReactNode {
  return (
    <div className="mb-8 animate-[kk-float_5s_ease-in-out_infinite] motion-reduce:animate-none">
      <svg
        width="132"
        height="120"
        viewBox="0 0 132 120"
        fill="none"
        aria-hidden="true"
        className="drop-shadow-[0_18px_28px_rgb(var(--shadow-tint)_/_0.28)]"
      >
        <defs>
          <linearGradient id="kh-404-disc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3d7a4" />
            <stop offset="100%" stopColor="#cfa264" />
          </linearGradient>
          <linearGradient id="kh-404-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b9864a" />
            <stop offset="100%" stopColor="#7f5128" />
          </linearGradient>
        </defs>
        {/* rim, then the face with a bite out of the top-right */}
        <path d="M66 8a50 50 0 1 0 50 50c0-8-2-15-5-22a16 16 0 0 1-22-18A50 50 0 0 0 66 8z" fill="url(#kh-404-rim)" transform="translate(0 5)" />
        <path d="M66 8a50 50 0 1 0 50 50c0-8-2-15-5-22a16 16 0 0 1-22-18A50 50 0 0 0 66 8z" fill="url(#kh-404-disc)" />
        {/* blister marks */}
        {(
          [
            [44, 40, 5],
            [62, 30, 3.5],
            [82, 70, 5],
            [54, 62, 3],
            [34, 68, 3.5],
            [70, 86, 3],
            [50, 88, 2.5],
          ] as const
        ).map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#8a5a2c" fillOpacity="0.45" />
        ))}
        {/* crumbs */}
        <ellipse cx="22" cy="112" rx="5" ry="3" fill="#c99a5a" />
        <ellipse cx="104" cy="114" rx="4" ry="2.5" fill="#c99a5a" />
        <ellipse cx="112" cy="106" rx="3" ry="2" fill="#b48a4c" />
      </svg>
    </div>
  );
}
