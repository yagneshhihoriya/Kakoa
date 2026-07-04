import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Apply default internal padding (16px). Default `true`. */
  padded?: boolean;
  children: ReactNode;
}

/** Surface primitive — `--color-card` on `--radius-lg` with `--color-line` border. */
export function Card({
  padded = true,
  className,
  children,
  ...rest
}: CardProps): ReactNode {
  return (
    <div
      className={cx(
        'rounded-lg border border-line bg-card text-ink',
        padded && 'p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
