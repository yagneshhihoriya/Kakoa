import type { ReactNode } from "react";

/**
 * Shared admin status pill — a "glass" chip (translucent tint + colored ring +
 * status dot + strong text) used by the order / payment / shipment badges so
 * statuses read clearly and stay consistent across the admin. Colours are the
 * system's semantic hues at higher contrast than the old flat pastels.
 */
export type Tone = "success" | "danger" | "warn" | "info" | "purple" | "neutral";

const TONE: Record<Tone, { pill: string; dot: string }> = {
  success: { pill: "border-[#3f8a54]/35 bg-[#3f8a54]/12 text-[#2f7346]", dot: "bg-[#3f8a54]" },
  danger: { pill: "border-[#c0492f]/35 bg-[#c0492f]/12 text-[#a23c28]", dot: "bg-[#c0492f]" },
  warn: { pill: "border-[#c98a1e]/40 bg-[#c98a1e]/15 text-[#8a5e14]", dot: "bg-[#c98a1e]" },
  info: { pill: "border-[#3f6fa3]/35 bg-[#3f6fa3]/12 text-[#345f8c]", dot: "bg-[#3f6fa3]" },
  purple: { pill: "border-[#6a5acd]/35 bg-[#6a5acd]/12 text-[#5044a3]", dot: "bg-[#6a5acd]" },
  neutral: { pill: "border-[#8a7a68]/30 bg-[#8a7a68]/12 text-[#6f6152]", dot: "bg-[#a08a72]" },
};

export function StatusPill({
  tone,
  label,
  size = "md",
}: {
  tone: Tone;
  label: string;
  size?: "sm" | "md";
}): ReactNode {
  const t = TONE[tone];
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[11.5px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold shadow-sm backdrop-blur-sm ${pad} ${t.pill}`}
    >
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${t.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
