/**
 * Money — Contract §3.0 Global Conventions (PROJECT_PLAN.md).
 *
 * All money is integer **paise** (INR only). No floats, ever. The branded
 * `Paise` type prevents accidental mixing of raw numbers and validated
 * paise amounts; all arithmetic goes through the guarded helpers below.
 */

declare const PAISE_BRAND: unique symbol;

/** An integer amount of paise (1/100 INR). Branded — construct via `toPaise`. */
export type Paise = number & { readonly [PAISE_BRAND]: 'Paise' };

export class MoneyError extends Error {
  override readonly name = 'MoneyError';
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(
      `${label} must be a safe integer number of paise, got ${String(value)}`,
    );
  }
}

/**
 * Brand a raw integer as `Paise`. Throws on non-integer / non-finite input.
 * Negative values are allowed (signed ledger adjustments, refund deltas).
 */
export function toPaise(value: number): Paise {
  assertSafeInteger(value, 'amount');
  return value as Paise;
}

/** Sum paise amounts. Throws if any input or the result is not a safe integer. */
export function addPaise(...amounts: readonly Paise[]): Paise {
  let total = 0;
  for (const amount of amounts) {
    assertSafeInteger(amount, 'amount');
    total += amount;
  }
  assertSafeInteger(total, 'sum');
  return total as Paise;
}

/**
 * Multiply a paise amount by a quantity (line totals). The factor must be a
 * non-negative integer — fractional or negative quantities are invalid.
 */
export function multiplyPaise(amount: Paise, factor: number): Paise {
  assertSafeInteger(amount, 'amount');
  if (!Number.isSafeInteger(factor) || factor < 0) {
    throw new MoneyError(
      `factor must be a non-negative integer, got ${String(factor)}`,
    );
  }
  const result = amount * factor;
  assertSafeInteger(result, 'product');
  return result as Paise;
}

/** Indian-system digit grouping: last 3 digits, then groups of 2 ("1,11,100"). */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  const groups: string[] = [];
  for (let i = head.length; i > 0; i -= 2) {
    groups.unshift(head.slice(Math.max(0, i - 2), i));
  }
  return `${groups.join(',')},${tail}`;
}

/**
 * Format integer paise as an INR display string with Indian grouping:
 * `formatPaise(11110000)` → `"₹1,11,100.00"`. Negative amounts render as
 * `"-₹1.00"`. Throws on non-integer input.
 */
export function formatPaise(amount: Paise | number): string {
  assertSafeInteger(amount, 'amount');
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs / 100);
  const paise = abs % 100;
  return `${sign}₹${groupIndian(String(rupees))}.${String(paise).padStart(2, '0')}`;
}
