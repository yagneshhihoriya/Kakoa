"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal behavior for the chrome overlays (search sheet, cart drawer):
 * body scroll lock (always unlocked on unmount), ESC to close, Tab focus
 * trap inside `panelRef`, initial focus (`initialFocusRef` falls back to the
 * panel), and focus restore to the trigger on close.
 */
export function useOverlay<
  TPanel extends HTMLElement,
  TFocus extends HTMLElement = HTMLElement,
>(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<TPanel | null>,
  initialFocusRef?: RefObject<TFocus | null>,
): void {
  // Callers may pass inline closures — track the latest without re-binding.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Body scroll lock.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Initial focus + restore to trigger on close.
  useEffect(() => {
    if (!open) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    (initialFocusRef?.current ?? panelRef.current)?.focus();
    return () => {
      trigger?.focus();
    };
    // Refs are stable containers; `open` is the only real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ESC to close + Tab focus trap.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (panel === null) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
