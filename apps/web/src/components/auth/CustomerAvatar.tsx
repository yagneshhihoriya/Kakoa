import type { ReactNode } from "react";
import { cx } from "@kakoa/ui";

/**
 * Generated, deterministic customer avatar in the KAKOA house style — a
 * letterpress serif monogram on warm parchment, framed by a fine gold hairline
 * ring, with a slow gloss sweep (light catching a wax seal). The gradient tint
 * is picked from the seed (name → phone → email), so every customer gets a
 * stable, distinct-but-cohesive avatar the instant they sign in — no upload, no
 * picker. Shows initials when a name is known, else the brand spark (✦), never
 * raw phone digits.
 *
 * Presentational + hook-free (server- or client-safe). The gloss is motion-safe.
 */

/** Warm, muted parchment gradient pairs [from, to]; index chosen from the seed. */
const GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["#F1DCB0", "#DFBB84"], // honey
  ["#ECDCC2", "#D6BB93"], // almond
  ["#EDCBC2", "#D9A99E"], // rose
  ["#DBE0C0", "#BFC894"], // sage
  ["#EFD4AE", "#DDB57E"], // caramel
  ["#E9CDB4", "#D3AC8B"], // clay
];

const INK = "#4a2e1c";
const GOLD = "#c69a4c";

function seedIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % GRADIENTS.length;
}

function initialsOf(name: string | null | undefined): string | null {
  if (name == null || name.trim() === "") return null;
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  const out = (first + last).toUpperCase();
  return out === "" ? null : out;
}

export interface CustomerAvatarProps {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Diameter in px (default 46). */
  size?: number;
  className?: string;
}

export function CustomerAvatar({
  name,
  phone,
  email,
  size = 46,
  className,
}: CustomerAvatarProps): ReactNode {
  const seed = (name ?? phone ?? email ?? "kakoa").toLowerCase();
  const pair = GRADIENTS[seedIndex(seed)] ?? GRADIENTS[0]!;
  const [from, to] = pair;
  const label = initialsOf(name);

  return (
    <span
      aria-hidden="true"
      className={cx("relative inline-block shrink-0 overflow-hidden rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(152deg, ${from} 0%, ${to} 100%)`,
        // Fine gold hairline ring + a soft inner top-light + gentle drop shadow.
        boxShadow: `inset 0 0 0 1.4px ${GOLD}99, inset 0 1.5px 3px rgba(255,255,255,0.55), inset 0 -4px 8px rgba(120,78,32,0.18), 0 4px 12px -4px rgba(74,46,28,0.45)`,
      }}
    >
      {/* soft studio highlight, top-left */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 30% 24%, rgba(255,255,255,0.5), transparent 60%)",
        }}
      />

      {/* monogram / brand spark */}
      <span className="absolute inset-0 grid place-items-center">
        {label !== null ? (
          <span
            style={{
              fontFamily: "var(--font-display), serif",
              fontSize: Math.round(size * 0.42),
              lineHeight: 1,
              color: INK,
              letterSpacing: label.length > 1 ? "0.02em" : "0",
              textShadow: "0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            {label}
          </span>
        ) : (
          <span
            style={{
              fontSize: Math.round(size * 0.4),
              lineHeight: 1,
              color: INK,
              opacity: 0.8,
              textShadow: "0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            ✦
          </span>
        )}
      </span>

      {/* luxe gloss sweep (motion-safe) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 motion-safe:animate-[kk-sheen_5.5s_ease-in-out_infinite] motion-reduce:hidden"
        style={{
          width: "45%",
          left: "-45%",
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
        }}
      />
    </span>
  );
}
