"use client";

import { useEffect } from "react";

/**
 * Section fade-up enhancement — 1:1 port of the prototype's `_enhance()`
 * (app script): every `main > section` starts `opacity: 0` /
 * `translateY(26px)` and reveals on intersection with a small stagger
 * (`min(i, 6) * 0.05s`). Progressive enhancement only:
 *
 * - styles are applied *from JS* after mount, so no-JS visitors and the
 *   server-rendered HTML never hide content;
 * - respects `prefers-reduced-motion: reduce` (no-op);
 * - 1.7s never-hide fallback force-reveals everything.
 *
 * Renders nothing — drop once inside the page's `<main>`.
 */
export function SectionReveal(): null {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("main > section"),
    );
    if (targets.length === 0) return undefined;

    let io: IntersectionObserver | null = null;
    let failSafe: number | undefined;

    const reveal = (el: HTMLElement): void => {
      el.style.opacity = "1";
      el.style.transform = "none";
    };

    const start = window.setTimeout(() => {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              reveal(entry.target as HTMLElement);
              io?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.06, rootMargin: "0px 0px -6% 0px" },
      );
      targets.forEach((target, index) => {
        target.style.opacity = "0";
        target.style.transform = "translateY(26px)";
        const delay = Math.min(index, 6) * 0.05;
        target.style.transition = `opacity .75s cubic-bezier(.2,.7,.3,1) ${delay}s, transform .75s cubic-bezier(.2,.7,.3,1) ${delay}s`;
        io?.observe(target);
      });
      // Safety: never leave content hidden (prototype fallback).
      failSafe = window.setTimeout(() => {
        targets.forEach(reveal);
      }, 1700);
    }, 50);

    return () => {
      window.clearTimeout(start);
      if (failSafe !== undefined) window.clearTimeout(failSafe);
      io?.disconnect();
      targets.forEach(reveal);
    };
  }, []);

  return null;
}
