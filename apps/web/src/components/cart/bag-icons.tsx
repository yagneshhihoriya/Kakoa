import type { ReactNode } from "react";

/**
 * Bag glyphs for the compact add-to-bag tile on phone product grids. Plain
 * SVG with no client code, so the server-rendered link/sold-out fallbacks and
 * the client `AddToBagButton` draw the identical icon.
 */
function Bag({ children }: { children: ReactNode }): ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5.5 8.5h13l-1 11.5h-11l-1-11.5Z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
      {children}
    </svg>
  );
}

/** Bag with a plus — "add to bag". */
export function BagPlusIcon(): ReactNode {
  return (
    <Bag>
      <path d="M12 11.5v5M9.5 14h5" />
    </Bag>
  );
}

/** Bag with a tick — the optimistic "added" state. */
export function BagCheckIcon(): ReactNode {
  return (
    <Bag>
      <path d="M9.5 14.3l1.8 1.8 3.4-3.8" />
    </Bag>
  );
}
