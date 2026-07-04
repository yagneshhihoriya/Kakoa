import { describe, expect, it } from 'vitest';

import {
  GstError,
  splitGst,
  taxFromInclusive,
  taxableFromInclusive,
} from './gst';

describe('taxFromInclusive — extraction, never addition', () => {
  it('canonical Contract example: 5% GST on ₹499.00 (49900p)', () => {
    // 49900 * 500 / 10500 = 2376.19... -> 2376; taxable = 47524
    expect(taxFromInclusive(49900, 500)).toBe(2376);
    expect(taxableFromInclusive(49900, 500)).toBe(47524);
    expect(taxFromInclusive(49900, 500) + taxableFromInclusive(49900, 500)).toBe(
      49900,
    );
  });

  it.each([
    // [grossPaise, rateBp, expectedTaxPaise] — all hand-computed
    [0, 500, 0],
    [1, 500, 0], // 1-paisa item: 500/10500 = 0.0476 -> 0
    [10, 500, 0], // 0.476 -> 0
    [11, 500, 1], // 0.5238 -> 1 (crosses the .5 boundary)
    [21, 500, 1], // exactly 1.0
    [100, 500, 5], // 4.7619 -> 5
    [10500, 500, 500], // exact division
    [14, 1200, 2], // 3/28 * 14 = 1.5 exactly -> rounds half up to 2
    [100, 1200, 11], // 10.714 -> 11
    [11800, 1800, 1800], // 18%: exact division
    [49900, 0, 0], // zero-rated
  ] as Array<[number, number, number]>)(
    'gross=%d rateBp=%d -> tax=%d',
    (gross, rateBp, expected) => {
      expect(taxFromInclusive(gross, rateBp)).toBe(expected);
    },
  );

  it('tax never exceeds gross and taxable is never negative (sweep)', () => {
    for (let gross = 0; gross <= 300; gross++) {
      for (const rateBp of [0, 500, 1200, 1800, 2800]) {
        const tax = taxFromInclusive(gross, rateBp);
        expect(tax).toBeGreaterThanOrEqual(0);
        expect(tax).toBeLessThanOrEqual(gross);
        expect(taxableFromInclusive(gross, rateBp)).toBe(gross - tax);
      }
    }
  });

  it('throws on negative or non-integer inputs', () => {
    expect(() => taxFromInclusive(-1, 500)).toThrow(GstError);
    expect(() => taxFromInclusive(499.5, 500)).toThrow(GstError);
    expect(() => taxFromInclusive(49900, -500)).toThrow(GstError);
    expect(() => taxFromInclusive(49900, 5.5)).toThrow(GstError);
    expect(() => taxFromInclusive(Number.NaN, 500)).toThrow(GstError);
  });
});

describe('splitGst', () => {
  it('intra-state: half each, even split', () => {
    expect(splitGst(2376, true)).toEqual({
      cgstPaise: 1188,
      sgstPaise: 1188,
      igstPaise: 0,
    });
  });

  it('intra-state: odd remainder paisa goes to CGST', () => {
    expect(splitGst(2377, true)).toEqual({
      cgstPaise: 1189,
      sgstPaise: 1188,
      igstPaise: 0,
    });
    expect(splitGst(1, true)).toEqual({
      cgstPaise: 1,
      sgstPaise: 0,
      igstPaise: 0,
    });
  });

  it('inter-state: everything is IGST', () => {
    expect(splitGst(2376, false)).toEqual({
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 2376,
    });
    expect(splitGst(1, false)).toEqual({
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 1,
    });
  });

  it('zero tax splits to all zeros', () => {
    expect(splitGst(0, true)).toEqual({
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
    });
    expect(splitGst(0, false)).toEqual({
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
    });
  });

  it('components always reassemble to the input tax (sweep, both modes)', () => {
    for (let tax = 0; tax <= 500; tax++) {
      for (const intra of [true, false]) {
        const { cgstPaise, sgstPaise, igstPaise } = splitGst(tax, intra);
        expect(cgstPaise + sgstPaise + igstPaise).toBe(tax);
        if (intra) {
          expect(igstPaise).toBe(0);
          expect(cgstPaise - sgstPaise === 0 || cgstPaise - sgstPaise === 1).toBe(
            true,
          );
        } else {
          expect(cgstPaise).toBe(0);
          expect(sgstPaise).toBe(0);
        }
      }
    }
  });

  it('throws on negative or non-integer tax', () => {
    expect(() => splitGst(-1, true)).toThrow(GstError);
    expect(() => splitGst(1.5, true)).toThrow(GstError);
  });
});

describe('end-to-end line-item fixture (5% intra-state, remainder to CGST)', () => {
  it('₹499.00 bar shipped within seller state', () => {
    const tax = taxFromInclusive(49900, 500); // 2376
    const split = splitGst(tax, true);
    expect(split).toEqual({ cgstPaise: 1188, sgstPaise: 1188, igstPaise: 0 });
  });

  it('odd-tax line: gross 49921p @5% -> tax 2377 -> CGST gets the extra paisa', () => {
    // 49921 * 500 / 10500 = 2377.19 -> 2377
    const tax = taxFromInclusive(49921, 500);
    expect(tax).toBe(2377);
    expect(splitGst(tax, true)).toEqual({
      cgstPaise: 1189,
      sgstPaise: 1188,
      igstPaise: 0,
    });
  });
});
