/**
 * Pure customer-PII masking — NO @kakoa/db import, so it's unit-testable and the
 * single source of truth for how phone/email are redacted when the acting admin
 * lacks `customers:pii-view`. Masking is a display concern decided on the SERVER
 * (context.ts / customers.ts): a client without the permission never receives the
 * raw contact value in the RSC/JSON payload. `@kakoa/core` is pure (zero runtime
 * deps) so importing `maskPhone` here keeps this file safe to unit test.
 */
import { maskPhone } from '@kakoa/core';

/**
 * Mask a (possibly null) phone for display. `customers.phone` is nullable —
 * `maskPhone` expects a string, so guard first. A non-`+91` value is returned
 * by `maskPhone` unchanged, which is acceptable (masking is never authority).
 */
export function maskPhoneMaybe(phone: string | null | undefined): string | null {
  if (phone == null || phone === '') return null;
  return maskPhone(phone);
}

/**
 * Mask an email for display: keep the first character of the local part and the
 * full domain, e.g. `john@kakoa.in` → `j•••@kakoa.in`. A one-char local part
 * reveals nothing (`•••@kakoa.in`). A malformed value (no `@`) collapses to
 * `•••` so nothing leaks. Returns null for a null/blank input.
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (email == null) return null;
  const e = email.trim();
  if (e === '') return null;
  const at = e.lastIndexOf('@');
  if (at <= 0 || at === e.length - 1) return '•••'; // no local or no domain — never leak
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const shown = local.length > 1 ? local.slice(0, 1) : '';
  return `${shown}•••@${domain}`;
}
