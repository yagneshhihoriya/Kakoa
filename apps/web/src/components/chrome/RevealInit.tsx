"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const NEVER_HIDE_FALLBACK_MS = 1700;

/**
 * `_enhance` section fade-ups from the prototype: any element carrying
 * `data-reveal` starts at opacity 0 / translateY(26px) (CSS in globals.css,
 * gated behind the `.kk-js` class this component sets) and transitions in
 * when it enters the viewport.
 *
 * Safety rails:
 * - no JS  → `.kk-js` never set → content is simply visible;
 * - reduced motion → CSS media query keeps everything visible, and we skip
 *   the observer entirely;
 * - 1.7s never-hide fallback force-reveals anything the observer missed.
 */
export function RevealInit(): null {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    document.documentElement.classList.add("kk-js");

    const revealAll = (): void => {
      document
        .querySelectorAll("[data-reveal]:not(.kk-in)")
        .forEach((el) => el.classList.add("kk-in"));
    };

    if (!("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("kk-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );
    document
      .querySelectorAll("[data-reveal]:not(.kk-in)")
      .forEach((el) => observer.observe(el));

    const fallback = window.setTimeout(revealAll, NEVER_HIDE_FALLBACK_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
    // Re-scan after every client-side navigation — new page, new sections.
  }, [pathname]);

  return null;
}
