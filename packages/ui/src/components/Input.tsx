import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { fieldErrorId } from './Field';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  /** Control id — required so `Field` errors can be wired via aria. */
  id: string;
  /**
   * When present and non-empty, the input renders in the error state and
   * sets `aria-invalid` + `aria-describedby` pointing at the matching
   * `Field` error list (`${id}-error`). The strings themselves are rendered
   * by `Field`.
   */
  fieldErrors?: readonly string[];
}

/** Text input — 44px min touch target, danger border + aria wiring on error. */
export function Input({
  id,
  fieldErrors,
  className,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: InputProps): ReactNode {
  const invalid = fieldErrors !== undefined && fieldErrors.length > 0;
  const describedBy = invalid
    ? cx(ariaDescribedBy, fieldErrorId(id))
    : ariaDescribedBy;
  return (
    <input
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy === '' ? undefined : describedBy}
      className={cx(
        'min-h-11 w-full rounded-md border bg-cream px-3 font-body text-base text-ink',
        'placeholder:text-espresso/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        'disabled:cursor-not-allowed disabled:opacity-60',
        invalid ? 'border-danger' : 'border-line',
        className,
      )}
      {...rest}
    />
  );
}
