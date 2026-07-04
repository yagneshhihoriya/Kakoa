import type { ReactNode } from 'react';
import { formatPaise } from '@kakoa/core';
import { cx } from '../lib/cx';

export interface PriceProps {
  /** Integer paise. All money rendering goes through `formatPaise()` — components never accept pre-formatted price strings or do float math. */
  paise: number;
  /** Original price (integer paise) rendered struck-through when greater than `paise`. */
  compareAtPaise?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PriceProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
};

/** Money display — `formatPaise(129900)` → "₹1,299.00" with Indian grouping. */
export function Price({
  paise,
  compareAtPaise,
  size = 'md',
  className,
}: PriceProps): ReactNode {
  const showCompareAt =
    compareAtPaise !== undefined && compareAtPaise > paise;
  return (
    <span
      className={cx(
        'inline-flex items-baseline gap-2 font-body',
        SIZE_CLASSES[size],
        className,
      )}
    >
      <data value={paise} className="font-semibold text-ink">
        {formatPaise(paise)}
      </data>
      {showCompareAt ? (
        <s aria-label={`Original price ${formatPaise(compareAtPaise)}`} className="text-espresso/70">
          {formatPaise(compareAtPaise)}
        </s>
      ) : null}
    </span>
  );
}
