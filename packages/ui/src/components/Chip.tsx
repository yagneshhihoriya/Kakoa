import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Selected state is controlled by the consumer. */
  selected?: boolean;
  children: ReactNode;
}

/**
 * Selectable pill chip (filters, trending searches). Always
 * `--radius-pill`; exposes selection via `aria-pressed`. Server-renderable —
 * click handlers are wired by client consumers.
 */
export function Chip({
  selected = false,
  type = 'button',
  className,
  children,
  ...rest
}: ChipProps): ReactNode {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        'inline-flex min-h-11 items-center justify-center rounded-pill border px-4 font-body text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? 'border-ink bg-ink text-cream'
          : 'border-line bg-cream text-ink hover:border-espresso',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
