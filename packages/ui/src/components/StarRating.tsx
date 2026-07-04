import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface StarRatingProps {
  /**
   * Rating 0–5, step 0.1. Out-of-range values clamp. Partial fill is exact:
   * fill width = `(value / 5) * 100`% of the 5-star strip — 4.3 renders a
   * 30%-filled fourth star, never rounds to 4.5 (matches JSON-LD
   * `aggregateRating`, design-system.md edge case #4).
   */
  value: number;
  /** Accessible label override; default "Rated X.X out of 5". */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<StarRatingProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
};

const STARS = '★★★★★';

/**
 * Server-renderable star rating using the two-span overlay technique:
 * a `--color-line` base strip with a width-clipped `--color-gold` overlay.
 */
export function StarRating({
  value,
  label,
  size = 'md',
  className,
}: StarRatingProps): ReactNode {
  const clamped = Math.min(5, Math.max(0, Number.isFinite(value) ? value : 0));
  const fillPercent = (clamped / 5) * 100;
  return (
    <span
      role="img"
      aria-label={label ?? `Rated ${clamped.toFixed(1)} out of 5`}
      className={cx(
        'relative inline-block select-none align-middle leading-none tracking-[0.1em]',
        SIZE_CLASSES[size],
        className,
      )}
    >
      <span aria-hidden="true" className="text-line">
        {STARS}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-gold"
        style={{ width: `${fillPercent}%` }}
      >
        {STARS}
      </span>
    </span>
  );
}
