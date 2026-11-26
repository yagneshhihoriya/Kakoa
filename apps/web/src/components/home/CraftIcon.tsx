import type { ReactNode } from "react";
import type { ProcessIconName } from "@/brands/contract";

/**
 * Thin-stroke line icons for the process band — decorative, brand-neutral,
 * drawn in the same 24-unit grid and 1.6 stroke as the trust-band icons so the
 * two sections read as one system. Each pack picks one per step.
 */
export function CraftIcon({ name }: { name: ProcessIconName }): ReactNode {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "knead":
      // A mound of dough resting in a shallow bowl.
      return (
        <svg {...common}>
          <path d="M3 12.5h18l-1.4 5.1a3 3 0 0 1-2.9 2.2H7.3a3 3 0 0 1-2.9-2.2L3 12.5z" />
          <path d="M7 12.5a5 4.2 0 0 1 10 0" />
          <path d="M10 8.5c.6-.6 1.4-.6 2 0s1.4.6 2 0" />
        </svg>
      );
    case "roll":
      // A rolling pin over a thin sheet.
      return (
        <svg {...common}>
          <rect x="5" y="7" width="14" height="6" rx="3" />
          <path d="M2 10h3M19 10h3" />
          <path d="M4 18c2.5-1.2 5.5-1.2 8 0s5.5 1.2 8 0" />
        </svg>
      );
    case "roast":
      // A flat griddle over three licks of heat.
      return (
        <svg {...common}>
          <path d="M4 13h16" />
          <path d="M6 13a6 3.6 0 0 0 12 0" />
          <path d="M20 13h2" />
          <path d="M8.5 9.5c0-1.2.8-1.6.8-2.8M12 9.5c0-1.2.8-1.6.8-2.8M15.5 9.5c0-1.2.8-1.6.8-2.8" />
        </svg>
      );
    case "pack":
      // A sealed carton.
      return (
        <svg {...common}>
          <path d="M3 8l9-4 9 4v9l-9 4-9-4V8z" />
          <path d="M3 8l9 4 9-4M12 12v9" />
          <path d="M7.5 6l9 4" />
        </svg>
      );
    case "source":
      // A single pod with its seam.
      return (
        <svg {...common}>
          <path d="M12 3c4.8 0 7.5 4 7.5 9s-2.7 9-7.5 9-7.5-4-7.5-9 2.7-9 7.5-9z" />
          <path d="M12 3c-2 3-2 15 0 18" />
          <path d="M12 3c2 3 2 15 0 18" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M11 20A7 7 0 0 1 4 13C4 8 8 4 13 3c2 8-2 14-2 17z" />
          <path d="M11 20c0-5 2.5-9 6.5-12" />
        </svg>
      );
    case "conch":
      // A slow spiral.
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 1 1-9 9" />
          <path d="M12 7a5 5 0 1 1-5 5" />
          <path d="M12 11a1 1 0 1 1-1 1" />
        </svg>
      );
    case "temper":
    default:
      // A scored bar.
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2.5" />
          <path d="M4 12h16M12 5v14" />
        </svg>
      );
  }
}
