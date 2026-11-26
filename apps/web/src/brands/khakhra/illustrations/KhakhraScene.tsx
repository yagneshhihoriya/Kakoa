import type { CSSProperties, ReactNode } from "react";

/**
 * Studio-lit editorial scene — a stack of roasted discs on a warm, lit
 * surface, with a few crumbs and methi flecks. Original artwork for this
 * pack; fills its nearest positioned parent (`position: absolute; inset: 0`)
 * — callers own aspect-ratio, radius and clip.
 *
 * All hexes here are scene art direction (lighting, roast tones), not palette
 * tokens — the same carve-out as `ProductPlaceholder`.
 */

/** A single disc: a gradient oval with blister marks and a darker rim. */
interface DiscProps {
  readonly top: string;
  readonly left: string;
  readonly width: string;
  readonly rotate: number;
  readonly zIndex: number;
  readonly surface: string;
}

const BLISTERS =
  "radial-gradient(circle at 28% 32%, rgba(120,76,36,.5) 0 5%, transparent 6%)," +
  "radial-gradient(circle at 62% 22%, rgba(120,76,36,.45) 0 4%, transparent 5%)," +
  "radial-gradient(circle at 74% 56%, rgba(120,76,36,.5) 0 6%, transparent 7%)," +
  "radial-gradient(circle at 44% 64%, rgba(120,76,36,.4) 0 4%, transparent 5%)," +
  "radial-gradient(circle at 18% 70%, rgba(120,76,36,.45) 0 3.5%, transparent 4.5%)," +
  "radial-gradient(circle at 52% 40%, rgba(120,76,36,.35) 0 3%, transparent 4%)";

function Disc({ top, left, width, rotate, zIndex, surface }: DiscProps): ReactNode {
  const style: CSSProperties = {
    top,
    left,
    width,
    aspectRatio: "10 / 3.4",
    transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
    zIndex,
  };
  return (
    <div className="absolute" style={style}>
      {/* rim / underside */}
      <div
        className="absolute inset-0 rounded-[50%]"
        style={{
          transform: "translateY(7%)",
          background: "linear-gradient(160deg,#b9864a,#7f5128)",
          boxShadow: "0 18px 30px rgba(44,26,11,.38)",
        }}
      />
      {/* face */}
      <div
        className="absolute inset-0 rounded-[50%]"
        style={{
          background: `${BLISTERS}, ${surface}`,
          boxShadow: "inset 0 2px 3px rgba(255,255,255,.35), inset 0 -6px 10px rgba(90,50,20,.22)",
        }}
      />
    </div>
  );
}

/** [left, top, width(px), rotation(deg)] */
type CrumbSpec = readonly [string, string, number, number];

const CRUMBS: readonly CrumbSpec[] = [
  ["22%", "78%", 14, 18],
  ["27%", "84%", 9, -24],
  ["70%", "82%", 12, 40],
  ["76%", "76%", 8, -10],
  ["58%", "88%", 10, 30],
];

function Crumb({ spec }: { spec: CrumbSpec }): ReactNode {
  const [left, top, size, rotate] = spec;
  return (
    <div
      className="absolute"
      style={{
        left,
        top,
        width: `${size}px`,
        height: `${size * 0.6}px`,
        borderRadius: "48% 56% 44% 52%",
        background: "linear-gradient(150deg,#e2bd7e,#b48a4c)",
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 2px 3px rgba(44,26,11,.35)",
      }}
    />
  );
}

export interface KhakhraSceneProps {
  /** Optional mono caption bottom-left (e.g. "Small-batch kitchen"). */
  label?: string;
}

export function KhakhraScene({ label }: KhakhraSceneProps): ReactNode {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {/* warm surface + key light + vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(120% 118% at 30% 8%, #F7E6C6 0%, #E5C58E 46%, #C99A5E 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(58% 55% at 28% 16%, rgba(255,255,255,.5), transparent 56%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(92% 92% at 84% 110%, rgba(74,32,16,.38), transparent 60%)",
        }}
      />
      <Disc top="62%" left="50%" width="66%" rotate={-4} zIndex={1} surface="linear-gradient(135deg,#e9c689,#c79a5a)" />
      <Disc top="52%" left="53%" width="62%" rotate={3} zIndex={2} surface="linear-gradient(135deg,#efd09a,#cfa264)" />
      <Disc top="41%" left="49%" width="58%" rotate={-7} zIndex={3} surface="linear-gradient(135deg,#f3d7a4,#d2a86a)" />
      {CRUMBS.map((spec) => (
        <Crumb key={`${spec[0]}-${spec[1]}`} spec={spec} />
      ))}
      {label !== undefined ? (
        <div className="absolute bottom-3.5 left-4 font-mono text-[10px] leading-none font-medium tracking-[0.14em] text-[rgba(74,32,16,.62)] uppercase">
          {label}
        </div>
      ) : null}
    </div>
  );
}
