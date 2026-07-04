import type { CSSProperties, ReactNode } from "react";

/**
 * Studio-lit editorial scene — molded glossy chocolate bars + cacao nibs on a
 * warm lit surface. 1:1 translation of the prototype's `chocoScene()` helper
 * (app script) into a server component. Fills its nearest positioned parent
 * (`position: absolute; inset: 0`) — callers own aspect-ratio + radius + clip.
 *
 * All hexes here are prototype art direction (scene lighting), not palette
 * tokens — same carve-out as `ChocoPlaceholder`.
 */

export type ChocoSceneKind = "hero" | "sourcing" | "tempering" | "story";

const BAR_GRADIENTS = {
  dark: "linear-gradient(150deg,#6b4326,#2e1a0e 82%)",
  milk: "linear-gradient(150deg,#b3804f,#6d4526 82%)",
  caramel: "linear-gradient(150deg,#e2af64,#a9722f 82%)",
  ruby: "linear-gradient(150deg,#c58f84,#6f3d38 82%)",
} as const;

/** Single-bar scenes pick a bar colour by editorial context (prototype). */
const SINGLE_KIND_GRADIENT: Record<
  Exclude<ChocoSceneKind, "hero">,
  (typeof BAR_GRADIENTS)[keyof typeof BAR_GRADIENTS]
> = {
  sourcing: BAR_GRADIENTS.dark,
  tempering: BAR_GRADIENTS.caramel,
  story: BAR_GRADIENTS.milk,
};

interface MoldedBarProps {
  gradient: string;
  cols: number;
  rows: number;
  /** Absolute placement on the surface (width/aspect/left/top/transform/z). */
  style: CSSProperties;
}

function MoldedBar({ gradient, cols, rows, style }: MoldedBarProps): ReactNode {
  return (
    <div className="absolute" style={style}>
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols},1fr)`,
          gridTemplateRows: `repeat(${rows},1fr)`,
          gap: "7%",
          padding: "8%",
          borderRadius: "6%",
          background: "linear-gradient(155deg,#3a2416,#1b0c06)",
          boxShadow:
            "0 20px 36px rgba(0,0,0,.44),inset 0 1px 0 rgba(255,255,255,.09)",
        }}
      >
        {Array.from({ length: cols * rows }, (_, i) => (
          <div
            key={i}
            className="rounded-[22%]"
            style={{
              background: gradient,
              boxShadow:
                "inset 2px 3px 4px rgba(255,255,255,.24),inset -2px -5px 8px rgba(0,0,0,.44)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** [left, top, size(px), rotation(deg)] */
type NibSpec = readonly [string, string, number, number];

function Nib({ spec }: { spec: NibSpec }): ReactNode {
  const [left, top, size, rotate] = spec;
  return (
    <div
      className="absolute"
      style={{
        left,
        top,
        width: `${size}px`,
        height: `${size * 0.7}px`,
        borderRadius: "42% 56% 46% 52%",
        background: "linear-gradient(150deg,#5a3620,#28140a)",
        transform: `rotate(${rotate}deg)`,
        boxShadow:
          "0 2px 3px rgba(0,0,0,.4),inset 1px 1px 2px rgba(255,255,255,.16)",
      }}
    />
  );
}

const HERO_NIBS: readonly NibSpec[] = [
  ["20%", "74%", 16, 18],
  ["23%", "80%", 12, -24],
  ["68%", "30%", 14, 40],
  ["72%", "26%", 10, -10],
  ["50%", "83%", 13, 30],
  ["64%", "78%", 11, 12],
];

const SINGLE_NIBS: readonly NibSpec[] = [
  ["24%", "72%", 16, 20],
  ["28%", "79%", 11, -18],
  ["72%", "30%", 13, 36],
  ["75%", "24%", 9, -8],
];

export interface ChocoSceneProps {
  kind: ChocoSceneKind;
  /** Optional DM Mono caption bottom-left (e.g. "Small-batch kitchen"). */
  label?: string;
}

export function ChocoScene({ kind, label }: ChocoSceneProps): ReactNode {
  const inner: ReactNode =
    kind === "hero" ? (
      <>
        <MoldedBar
          gradient={BAR_GRADIENTS.milk}
          cols={3}
          rows={4}
          style={{
            width: "19%",
            aspectRatio: "3 / 4",
            left: "25%",
            top: "50%",
            transform: "translateY(-53%) rotate(-9deg)",
            zIndex: 2,
          }}
        />
        <MoldedBar
          gradient={BAR_GRADIENTS.dark}
          cols={3}
          rows={4}
          style={{
            width: "21%",
            aspectRatio: "3 / 4",
            left: "41%",
            top: "50%",
            transform: "translateY(-50%) rotate(4deg)",
            zIndex: 3,
          }}
        />
        <MoldedBar
          gradient={BAR_GRADIENTS.caramel}
          cols={3}
          rows={4}
          style={{
            width: "18%",
            aspectRatio: "3 / 4",
            left: "59%",
            top: "50%",
            transform: "translateY(-55%) rotate(-3deg)",
            zIndex: 2,
          }}
        />
        {HERO_NIBS.map((spec) => (
          <Nib key={`${spec[0]}-${spec[1]}`} spec={spec} />
        ))}
      </>
    ) : (
      <>
        <MoldedBar
          gradient={SINGLE_KIND_GRADIENT[kind]}
          cols={4}
          rows={5}
          style={{
            width: "44%",
            aspectRatio: "4 / 5",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-52%) rotate(-6deg)",
            zIndex: 2,
          }}
        />
        {SINGLE_NIBS.map((spec) => (
          <Nib key={`${spec[0]}-${spec[1]}`} spec={spec} />
        ))}
      </>
    );

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {/* warm surface + studio key light + vignette (prototype `surface()`) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 118% at 30% 8%, #F5E6CF 0%, #E4CBA4 46%, #cdac80 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 55% at 28% 16%, rgba(255,255,255,.5), transparent 56%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(92% 92% at 84% 110%, rgba(48,26,12,.42), transparent 60%)",
        }}
      />
      {inner}
      {label !== undefined ? (
        <div className="absolute bottom-3.5 left-4 font-mono text-[10px] leading-none font-medium tracking-[0.14em] text-[rgba(74,46,28,.6)] uppercase">
          {label}
        </div>
      ) : null}
    </div>
  );
}
