'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** 'right' side panel (cart drawer) or mobile 'bottom' sheet variant. */
  side?: 'right' | 'bottom';
  /** Accessible dialog title. */
  title: string;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus-trapped drawer. ESC and scrim click close; focus is restored to the
 * trigger on close; body scroll is locked while open and ALWAYS unlocked on
 * unmount (design-system.md edge case #11).
 */
export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  children,
  className,
}: DrawerProps): ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Body scroll lock — restored on close AND unconditionally on unmount.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Initial focus + focus restore to the trigger element.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    panelRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  // ESC to close + Tab focus trap.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (panel === null) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        aria-hidden="true"
        onClick={() => {
          onCloseRef.current();
        }}
        className="absolute inset-0 bg-ink/50"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'absolute flex flex-col bg-cream shadow-xl focus-visible:outline-none',
          side === 'right'
            ? 'inset-y-0 right-0 w-full max-w-md'
            : 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-lg',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-lg text-cocoa">{title}</h2>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={() => {
              onCloseRef.current();
            }}
            className={cx(
              'inline-flex h-11 w-11 items-center justify-center rounded-pill text-espresso transition-colors',
              'hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
            )}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
