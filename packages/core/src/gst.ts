/**
 * GST extraction & split — Contract §3.0 Global Conventions (PROJECT_PLAN.md).
 *
 * Consumer prices are GST-**inclusive** (MRP). The tax portion is
 * *extracted*, never added: `tax = round(gross * rateBp / (10000 + rateBp))`.
 * Intra-state (ship-to state == seller state) → CGST + SGST split, half
 * each with the odd remainder paisa to CGST; inter-state → all IGST.
 * `rateBp` is basis points (5% = 500).
 */

import { toPaise, type Paise } from './money';

export class GstError extends Error {
  override readonly name = 'GstError';
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new GstError(
      `${label} must be a non-negative safe integer, got ${String(value)}`,
    );
  }
}

/**
 * Tax portion contained in a GST-inclusive gross amount.
 * `taxFromInclusive(49900, 500)` → `2376` (taxable value 47524).
 */
export function taxFromInclusive(grossPaise: number, rateBp: number): Paise {
  assertNonNegativeInteger(grossPaise, 'grossPaise');
  assertNonNegativeInteger(rateBp, 'rateBp');
  return toPaise(Math.round((grossPaise * rateBp) / (10000 + rateBp)));
}

/** Taxable (pre-tax) value of a GST-inclusive gross amount. */
export function taxableFromInclusive(
  grossPaise: number,
  rateBp: number,
): Paise {
  assertNonNegativeInteger(grossPaise, 'grossPaise');
  return toPaise(grossPaise - taxFromInclusive(grossPaise, rateBp));
}

export interface GstSplit {
  cgstPaise: Paise;
  sgstPaise: Paise;
  igstPaise: Paise;
}

/**
 * Split an extracted tax amount into CGST/SGST/IGST.
 * Intra-state: half each, odd remainder paisa goes to CGST.
 * Inter-state: everything is IGST.
 */
export function splitGst(taxPaise: number, intraState: boolean): GstSplit {
  assertNonNegativeInteger(taxPaise, 'taxPaise');
  if (intraState) {
    const sgst = Math.floor(taxPaise / 2);
    const cgst = taxPaise - sgst; // remainder paisa to CGST
    return {
      cgstPaise: toPaise(cgst),
      sgstPaise: toPaise(sgst),
      igstPaise: toPaise(0),
    };
  }
  return {
    cgstPaise: toPaise(0),
    sgstPaise: toPaise(0),
    igstPaise: toPaise(taxPaise),
  };
}
