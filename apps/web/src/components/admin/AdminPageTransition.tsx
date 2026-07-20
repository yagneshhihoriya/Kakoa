"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Fades + rises the admin content in on each route change (keyed by pathname,
 * so it re-triggers only on navigation — never on in-page re-renders, which
 * keeps form state intact). Disabled under reduced-motion.
 */
export function AdminPageTransition({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className="animate-[kk-fadeup_0.34s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}
