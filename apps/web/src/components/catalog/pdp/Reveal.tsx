"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@kakoa/ui";

export interface RevealProps {
  /** Section index on the page — staggers the transition delay (prototype: `min(i, 6) * 0.05s`). */
  index?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Prototype `_enhance()` section fade-up, translated to React:
 * sections start visible (SSR / no-JS safe), are hidden only after mount
 * (opacity 0 → translateY(26px)), then reveal via IntersectionObserver
 * (threshold .06, rootMargin -6%). A 1.7s never-hide fallback guarantees
 * content is never left invisible; `prefers-reduced-motion` skips it all.
 */
export function Reveal({ index = 0, className, children }: RevealProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"static" | "hidden" | "visible">("static");

  useEffect(() => {
    if (
      typeof matchMedia !== "function" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    const node = ref.current;
    if (node === null) return;

    setPhase("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setPhase("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(node);
    // Safety: never leave content hidden (prototype's 1700ms fallback).
    const fallback = setTimeout(() => {
      setPhase("visible");
    }, 1700);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  const delay = Math.min(index, 6) * 0.05;
  return (
    <div
      ref={ref}
      className={cx(className)}
      style={
        phase === "static"
          ? undefined
          : {
              opacity: phase === "hidden" ? 0 : 1,
              transform: phase === "hidden" ? "translateY(26px)" : "none",
              transition: `opacity .75s cubic-bezier(.2,.7,.3,1) ${delay}s, transform .75s cubic-bezier(.2,.7,.3,1) ${delay}s`,
            }
      }
    >
      {children}
    </div>
  );
}
