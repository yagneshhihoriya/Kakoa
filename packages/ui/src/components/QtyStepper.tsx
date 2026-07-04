'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface QtyStepperProps {
  /** Server-authoritative value. Prop changes reconcile (and roll back) the optimistic local value. */
  value: number;
  /** Contract default cart range is 1–10. Must satisfy 1 ≤ min ≤ max. */
  min: number;
  max: number;
  /**
   * Emitted after the 250ms trailing debounce with a fresh client op ID
   * (uuid v4) per mutation — the client half of the optimistic-mutation /
   * reconcile loop (design-system.md §3, Cart edge case #6).
   */
  onChange: (qty: number, opId: string) => void;
  disabled?: boolean;
  /** Accessible group label, e.g. the product title. Default "Quantity". */
  label?: string;
  className?: string;
}

const DEBOUNCE_MS = 250;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Quantity stepper — optimistic local state, debounce + reconcile owned here, not by consumers. */
export function QtyStepper({
  value,
  min,
  max,
  onChange,
  disabled = false,
  label = 'Quantity',
  className,
}: QtyStepperProps): ReactNode {
  const [localValue, setLocalValue] = useState<number>(() =>
    clamp(value, min, max),
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Reconcile to the server-authoritative prop (rollback path).
  useEffect(() => {
    setLocalValue(clamp(value, min, max));
  }, [value, min, max]);

  // Never leave a pending debounce behind on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const step = (delta: 1 | -1): void => {
    setLocalValue((current) => {
      const next = clamp(current + delta, min, max);
      if (next !== current) {
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          onChangeRef.current(next, crypto.randomUUID());
        }, DEBOUNCE_MS);
      }
      return next;
    });
  };

  const buttonClasses = cx(
    'inline-flex h-11 w-11 items-center justify-center rounded-pill font-body text-lg font-semibold text-ink transition-colors',
    'hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
    'disabled:cursor-not-allowed disabled:opacity-40',
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        'inline-flex items-center rounded-pill border border-line bg-cream',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || localValue <= min}
        onClick={() => {
          step(-1);
        }}
        className={buttonClasses}
      >
        −
      </button>
      <span
        aria-live="polite"
        className="min-w-8 text-center font-body text-base font-semibold text-ink"
      >
        {localValue}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || localValue >= max}
        onClick={() => {
          step(1);
        }}
        className={buttonClasses}
      >
        +
      </button>
    </div>
  );
}
