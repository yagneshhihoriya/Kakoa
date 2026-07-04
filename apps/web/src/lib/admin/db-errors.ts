/**
 * Translate Postgres constraint violations into friendly admin validation
 * messages. The data-layer pre-checks (SELECT-then-write) catch the common
 * SEQUENTIAL cases; this is the race-safe BACKSTOP so a concurrent unique/check
 * violation (two admins writing the same SKU/slug at once, or a check tripped by
 * data another path wrote) returns a clean VALIDATION_ERROR instead of an
 * unhandled 500 that leaks a raw DB error.
 *
 * postgres-js surfaces the SQLSTATE as `.code` and the offending constraint as
 * `.constraint_name`, but drizzle WRAPS it as `new Error('Failed query…', { cause })`,
 * so we walk the `.cause` chain to find the underlying PostgresError (the same
 * unwrap apps/web/src/lib/checkout/place.ts does). Returns null when `e` is not a
 * violation we translate — the caller rethrows.
 */
interface PgError {
  code: string;
  constraint_name?: unknown;
}

/** Find the PostgresError (has a string `.code`) through drizzle's `.cause` wrapping. */
function findPgError(e: unknown): PgError | null {
  let cur: unknown = e;
  for (let i = 0; i < 6 && cur !== null && typeof cur === 'object'; i += 1) {
    const c = cur as { code?: unknown; cause?: unknown };
    if (typeof c.code === 'string') return c as PgError;
    cur = c.cause;
  }
  return null;
}

export function pgConstraintMessage(e: unknown): string | null {
  const err = findPgError(e);
  if (err === null) return null;
  const code = err.code;
  const constraint = typeof err.constraint_name === 'string' ? err.constraint_name : '';

  if (code === '23505') {
    // unique_violation
    if (constraint.includes('sku')) return 'That SKU is already in use.';
    if (constraint.includes('slug')) return 'A product or category with a similar name already exists.';
    if (constraint.includes('one_default')) return 'That product already has a default variant.';
    if (constraint.includes('code')) return 'That code is already in use.';
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
  if (code === '22003' || code === '22P02') {
    // numeric_value_out_of_range / invalid_text_representation
    return 'That value is out of the allowed range.';
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
