import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface EmptyStateCta {
  label: string;
  href: string;
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Exactly one CTA — never a bare "No data" (design-system.md §1.2). */
  cta: EmptyStateCta;
  /** Optional illustration slot. */
  icon?: ReactNode;
  className?: string;
}

/**
 * Section-level empty state. Canonical copies live with consumers, e.g.
 * empty cart → title "Your cart is empty", CTA "Explore the collection" → /shop.
 */
export function EmptyState({
  title,
  description,
  cta,
  icon,
  className,
}: EmptyStateProps): ReactNode {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-4 rounded-lg border border-line bg-card px-6 py-10 text-center',
        className,
      )}
    >
      {icon !== undefined ? (
        <div aria-hidden="true" className="text-espresso">
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-xl text-cocoa">{title}</h2>
      {description !== undefined ? (
        <p className="max-w-prose font-body text-sm text-espresso">
          {description}
        </p>
      ) : null}
      <a
        href={cta.href}
        className={cx(
          'inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-6 font-body text-base font-semibold text-cream transition-colors hover:bg-cocoa',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-card',
        )}
      >
        {cta.label}
      </a>
    </div>
  );
}
