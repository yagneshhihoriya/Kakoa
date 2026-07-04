import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface FieldProps {
  /** Visible label text. */
  label: string;
  /** id of the control this field labels. */
  htmlFor: string;
  required?: boolean;
  /** Optional helper text below the control. */
  hint?: string;
  /**
   * Field-level errors rendered verbatim (zod `flatten()` output) in
   * `--color-danger`. The error list id is `${htmlFor}-error` — pass it as
   * `aria-describedby` on the control (Input does this automatically via
   * `fieldErrors`).
   */
  errors?: readonly string[];
  className?: string;
  children: ReactNode;
}

/** Returns the conventional error-list element id for a control id. */
export function fieldErrorId(controlId: string): string {
  return `${controlId}-error`;
}

/** Label / control / hint / error layout wrapper for any form control. */
export function Field({
  label,
  htmlFor,
  required = false,
  hint,
  errors,
  className,
  children,
}: FieldProps): ReactNode {
  const hasErrors = errors !== undefined && errors.length > 0;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="font-body text-sm font-medium text-cocoa"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint !== undefined && !hasErrors ? (
        <p className="font-body text-xs text-espresso">{hint}</p>
      ) : null}
      {hasErrors ? (
        <ul
          id={fieldErrorId(htmlFor)}
          className="flex list-none flex-col gap-0.5 font-body text-xs text-danger"
        >
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
