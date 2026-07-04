/**
 * Pure CSV serializer — NO @kakoa/db import, unit-testable. RFC-4180 quoting +
 * spreadsheet formula-injection defense. Used by the Analytics export routes.
 */

/**
 * Neutralize CSV/formula injection: a text cell that a spreadsheet could execute
 * as a formula (starts with `= + - @`, or a leading tab/CR) is prefixed with a
 * single quote so it renders as literal text.
 */
function neutralizeInjection(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** Quote a single cell per RFC-4180 (wrap + double quotes when needed). */
function encodeCell(value: string | number | null): string {
  if (value === null) return '';
  let s = typeof value === 'number' ? String(value) : neutralizeInjection(value);
  if (/[",\r\n]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize a table to an RFC-4180 CSV string (CRLF row terminators). Every text
 * cell is injection-safe; numbers are emitted verbatim.
 */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): string {
  const lines: string[] = [];
  lines.push(headers.map((h) => encodeCell(h)).join(','));
  for (const row of rows) {
    lines.push(row.map((c) => encodeCell(c)).join(','));
  }
  return lines.join('\r\n');
}

/** paise → a rupees string with 2 decimals for a CSV money column. */
export function paiseToRupeeString(paise: number): string {
  return (paise / 100).toFixed(2);
}
