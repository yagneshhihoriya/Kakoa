import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required — no implicit default variant (design-system.md §1.2). */
  variant: ButtonVariant;
  size?: ButtonSize;
  /**
   * While `true`: inline spinner, disabled, `aria-busy`, and width locked to
   * the pre-loading width (label stays in flow, made invisible — no shift).
   */
  loading?: boolean;
  /**
   * If set, renders disabled with a tooltip. Copy must stay
   * permission-neutral — canonical string: "Owner permission required".
   */
  disabledReason?: string;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-cream hover:bg-cocoa active:bg-cocoa',
  secondary:
    'border border-ink bg-transparent text-ink hover:bg-card active:bg-card',
  ghost: 'bg-transparent text-ink hover:bg-card active:bg-card',
  destructive: 'bg-danger text-cream hover:opacity-90 active:opacity-90',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 text-sm',
  md: 'min-h-11 px-6 text-base',
  lg: 'min-h-12 px-8 text-lg',
};

/**
 * Pill button — always `--radius-pill` (a non-pill button is a lint failure).
 * Server-renderable; interactivity comes from handlers passed by client
 * consumers. Min touch target 44px on every size.
 */
export function Button({
  variant,
  size = 'md',
  loading = false,
  disabledReason,
  disabled,
  type = 'button',
  title,
  className,
  children,
  ...rest
}: ButtonProps): ReactNode {
  const isDisabled = disabled === true || loading || disabledReason !== undefined;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      title={disabledReason ?? title}
      className={cx(
        'relative inline-flex items-center justify-center gap-2 rounded-pill font-body font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      <span className={cx('inline-flex items-center gap-2', loading && 'invisible')}>
        {children}
      </span>
      {loading ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="h-4 w-4 animate-spin rounded-pill border-2 border-current border-t-transparent" />
        </span>
      ) : null}
    </button>
  );
}
