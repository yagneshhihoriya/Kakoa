/**
 * Pure invoice-number derivation — NO @kakoa/db import, unit-testable. Produces a
 * stable, human GST-style serial from the order number + placement date, e.g.
 * `KK/25-26/48210`. Deterministic (same order → same number every render), so no
 * DB column write is needed for v1. The Indian financial year (Apr–Mar) boundary
 * is evaluated in IST to match how orders are placed/reported.
 */

/** IST financial-year label for a date, e.g. a 2026-07 date → `25-26`? No — 26-27. */
function financialYearLabel(placedAt: Date): string {
  // IST calendar year + month (1-12) for the FY boundary.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).format(placedAt); // 'YYYY-MM'
  const [yStr, mStr] = parts.split('-');
  const year = Number(yStr);
  const month = Number(mStr); // 1-12
  // FY starts in April. Jan–Mar belong to the previous FY start year.
  const fyStart = month >= 4 ? year : year - 1;
  const two = (n: number): string => String(n % 100).padStart(2, '0');
  return `${two(fyStart)}-${two(fyStart + 1)}`;
}

/** Numeric suffix of an order number (`KK-48210` → `48210`), else the raw digits. */
function orderNumericSuffix(orderNumber: string): string {
  const digits = orderNumber.replace(/[^0-9]/g, '');
  return digits.length > 0 ? digits.padStart(5, '0') : '00000';
}

/**
 * Derive the display invoice number for an order. Stable across renders.
 * @example deriveInvoiceNumber('KK-48210', new Date('2026-07-05')) === 'KK/26-27/48210'
 */
export function deriveInvoiceNumber(orderNumber: string, placedAt: Date): string {
  return `KK/${financialYearLabel(placedAt)}/${orderNumericSuffix(orderNumber)}`;
}
