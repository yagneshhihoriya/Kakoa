"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Floating "back to top" affordance. Fades + slides in once the page is
 * scrolled past a threshold, smooth-scrolls to the top on click, and collapses
 * out of the way otherwise. Motion is disabled under reduced-motion (the button
 * still works — it just appears/scrolls instantly).
 */
export function BackToTop(): ReactNode {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = (): void => {
      setVisible(window.scrollY > 640);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior:
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "auto"
              : "smooth",
        })
      }
      className={
        "fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-pill bg-ink text-cream shadow-[0_10px_28px_-6px_rgba(42,29,18,0.5)] transition-all duration-300 ease-brand hover:-translate-y-0.5 hover:bg-[#3f2c1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream motion-reduce:transition-none " +
        (visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0")
      }
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
