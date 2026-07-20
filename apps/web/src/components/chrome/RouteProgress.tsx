"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Slim top progress bar (gold→cocoa) that signals navigation. It starts when an
 * internal link is clicked, trickles toward ~85% while the next route loads, and
 * snaps to 100% + fades when the new page commits (pathname/search change). Pure
 * client, pointer-events-none, and out of the a11y tree.
 */
export function RouteProgress(): ReactNode {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const trickle = useRef<number | null>(null);
  const hide = useRef<number | null>(null);

  const clearTimers = (): void => {
    if (trickle.current !== null) window.clearInterval(trickle.current);
    if (hide.current !== null) window.clearTimeout(hide.current);
    trickle.current = null;
    hide.current = null;
  };

  const start = (): void => {
    if (activeRef.current) return;
    activeRef.current = true;
    setActive(true);
    setWidth(8);
    trickle.current = window.setInterval(() => {
      setWidth((w) => (w < 88 ? w + Math.max(0.4, (92 - w) * 0.06) : w));
    }, 180);
  };

  const finish = (): void => {
    if (!activeRef.current) return;
    clearTimers();
    setWidth(100);
    hide.current = window.setTimeout(() => {
      activeRef.current = false;
      setActive(false);
      setWidth(0);
    }, 260);
  };

  // A committed navigation (new pathname/query) finishes the bar.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Start the bar the moment an internal link is clicked.
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        href === null ||
        href === "" ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Same URL (in-page) — no navigation to indicate.
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }
      start();
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, []);

  if (!active && width === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]"
    >
      <div
        className="h-full bg-gradient-to-r from-[#d9ac5e] via-[#c69a4c] to-[#8a5a34] shadow-[0_0_10px_rgba(217,172,94,0.7)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${width}%`, opacity: active ? 1 : 0 }}
      />
    </div>
  );
}
