import type { ReactNode, SelectHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  id: string;
  options: readonly SelectOption[];
  /** Shown as the disabled first option when no value is selected. */
  placeholder?: string;
}

/**
 * Native select styled with tokens. Empty `options` renders disabled with
 * the canonical placeholder "No options available" (design-system.md §1.2).
 */
export function Select({
  id,
  options,
  placeholder,
  disabled,
  className,
  ...rest
}: SelectProps): ReactNode {
  const isEmpty = options.length === 0;
  const effectivePlaceholder = isEmpty
    ? 'No options available'
    : placeholder;
  return (
    <select
      id={id}
      disabled={disabled === true || isEmpty}
      className={cx(
        'min-h-11 w-full appearance-none rounded-md border border-line bg-cream px-3 font-body text-base text-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    >
      {effectivePlaceholder !== undefined ? (
        <option value="" disabled>
          {effectivePlaceholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
