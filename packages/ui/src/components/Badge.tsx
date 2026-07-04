import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

/**
 * Presentational tones. Feature lanes map domain enums to tones with
 * `satisfies Record<OrderStatus, BadgeTone>` so a new enum value without a
 * mapping fails `tsc` (design-system.md §1.2 / edge case #12).
 */
export type BadgeTone =
  | 'neutral'
  | 'gold'
  | 'caramel'
  | 'success'
  | 'danger'
  | 'plum'
  | 'ink';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: BadgeTone;
  children: ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-card text-cocoa border-line',
  gold: 'bg-gold/15 text-espresso border-gold',
  caramel: 'bg-caramel/15 text-espresso border-caramel',
  success: 'bg-success/15 text-success border-success',
  danger: 'bg-danger/15 text-danger border-danger',
  plum: 'bg-plum/15 text-plum border-plum',
  ink: 'bg-ink text-cream border-ink',
};

/** Status chip — non-interactive, pill radius. */
export function Badge({
  tone,
  className,
  children,
  ...rest
}: BadgeProps): ReactNode {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 font-body text-xs font-semibold',
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
