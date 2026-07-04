import type { ReactNode } from "react";
import { formatPaise } from "@kakoa/core";
import type { Bucket } from "@/lib/admin/analytics-range";

interface Point {
  bucketStartIso: string;
  netRevenuePaise: number;
}

const W = 760;
const H = 220;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 16;
const PAD_B = 28;

function labelFor(iso: string, bucket: Bucket): string {
  const d = new Date(iso);
  if (bucket === "month") {
    return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" }).format(d);
  }
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);
}

/**
 * Inline SVG net-revenue bar chart — NO external chart dependency (self-contained
 * / CSP-friendly). Renders from the zero-filled timeseries; accessible via title +
 * aria-label. Money is shown via `formatPaise`.
 */
export function RevenueChart({ points, bucket }: { points: Point[]; bucket: Bucket }): ReactNode {
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.netRevenuePaise));
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const gap = n > 1 ? Math.min(6, plotW / n / 4) : 0;
  const barW = n > 0 ? plotW / n - gap : plotW;

  const total = points.reduce((s, p) => s + p.netRevenuePaise, 0);

  // A handful of evenly-spaced x tick labels (avoid crowding).
  const tickEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
          Net revenue ({bucket})
        </div>
        <div className="text-[12.5px] text-[#6b5844]">
          Range total <span className="font-semibold text-[#2a1d12]">{formatPaise(total)}</span>
        </div>
      </div>
      {n === 0 ? (
        <p className="py-10 text-center text-[13px] text-[#8a7a68]">No data in this range.</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Net revenue by ${bucket}. Range total ${formatPaise(total)}. Peak ${formatPaise(max)}.`}
          className="h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <title>Net revenue by {bucket}</title>
          {/* baseline */}
          <line x1={PAD_L} y1={PAD_T + plotH} x2={W - PAD_R} y2={PAD_T + plotH} stroke="#eadbc6" strokeWidth={1} />
          {/* peak label */}
          <text x={PAD_L} y={PAD_T - 4} fontSize={10} fill="#b8a88f">
            peak {formatPaise(max)}
          </text>
          {points.map((p, i) => {
            const h = Math.round((p.netRevenuePaise / max) * plotH);
            const x = PAD_L + i * (plotW / n) + gap / 2;
            const y = PAD_T + plotH - h;
            return (
              <g key={p.bucketStartIso}>
                <rect x={x} y={y} width={Math.max(1, barW)} height={h} rx={1.5} fill="#c69a4c">
                  <title>{`${labelFor(p.bucketStartIso, bucket)}: ${formatPaise(p.netRevenuePaise)}`}</title>
                </rect>
                {i % tickEvery === 0 ? (
                  <text x={x + barW / 2} y={H - 10} fontSize={9.5} fill="#8a7a68" textAnchor="middle">
                    {labelFor(p.bucketStartIso, bucket)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
