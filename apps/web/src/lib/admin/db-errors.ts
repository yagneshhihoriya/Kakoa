/**
 * Translate Postgres constraint violations into friendly admin validation
 * messages. The data-layer pre-checks (SELECT-then-write) catch the common
 * SEQUENTIAL cases; this is the race-safe BACKSTOP so a concurrent unique/check
 * violation (two admins writing the same SKU/slug at once, or a check tripped by
 * data another path wrote) returns a clean VALIDATION_ERROR instead of an
 * unhandled 500 that leaks a raw DB error.
 *
 * postgres-js surfaces the SQLSTATE as `.code` and the offending constraint as
 * `.constraint_name` (see apps/web/src/lib/checkout/place.ts for the pattern).
 * Returns null when `e` is not a violation we translate — the caller rethrows.
 */
interface PgError {
  code?: unknown;
  constraint_name?: unknown;
}

export function pgConstraintMessage(e: unknown): string | null {
  if (typeof e !== 'object' || e === null) return null;
  const err = e as PgError;
  const code = typeof err.code === 'string' ? err.code : '';
  const constraint = typeof err.constraint_name === 'string' ? err.constraint_name : '';

  if (code === '23505') {
    // unique_violation
    if (constraint.includes('sku')) return 'That SKU is already in use.';
    if (constraint.includes('slug')) return 'A product or category with a similar name already exists.';
    if (constraint.includes('one_default')) return 'That product already has a default variant.';
    return 'That value is already in use.';
  }
  if (code === '23514') {
    // check_violation
    if (constraint.includes('compare_at')) return 'Price must be below the compare-at price.';
    if (constraint.includes('price')) return 'Enter a price greater than ₹0.';
    if (constraint.includes('weight')) return 'Enter a valid weight (grams).';
    if (constraint.includes('stock')) return 'Stock cannot be negative.';
    if (constraint.includes('slug')) return 'That name produces an invalid URL slug.';
    return 'That change violates a validation rule.';
  }
  if (code === '23503') {
    // foreign_key_violation
    return 'A referenced record no longer exists.';
  }
  return null;
}

type FailValidation = { ok: false; code: 'VALIDATION_ERROR'; message: string };

/**
 * Run a transaction-returning fn; if it throws a mappable Postgres constraint
 * violation, convert it to a VALIDATION_ERROR result. Any other error rethrows.
 * `T` already includes the error shape, so `T | FailValidation` collapses to `T`.
 */
export async function withConstraintMapping<T>(
  fn: () => Promise<T>,
): Promise<T | FailValidation> {
  try {
    return await fn();
  } catch (e) {
    const message = pgConstraintMessage(e);
    if (message !== null) return { ok: false, code: 'VALIDATION_ERROR', message };
    throw e;
  }
}
