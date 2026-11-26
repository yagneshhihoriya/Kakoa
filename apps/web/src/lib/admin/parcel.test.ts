import { describe, expect, it } from 'vitest';
import { resolveParcelCm } from './parcel';

/**
 * `resolveParcelCm` is pure: variant physicals when every line has them, else
 * the vertical preset's default box (the Shiprocket adapter no longer invents
 * 10×10×10). Numeric columns arrive from Drizzle as strings.
 */
const FALLBACK = { length: 30, breadth: 20, height: 10 };

describe('resolveParcelCm', () => {
  it('uses the largest of each dimension when every line carries dims', () => {
    expect(
      resolveParcelCm(
        [
          { lengthCm: '28.00', breadthCm: '20.00', heightCm: '8.00' },
          { lengthCm: '12.50', breadthCm: '24.00', heightCm: '4.00' },
        ],
        FALLBACK,
      ),
    ).toEqual({ lengthCm: 28, breadthCm: 24, heightCm: 8 });
  });

  it('falls back to the preset default when any line is missing a dimension', () => {
    expect(
      resolveParcelCm(
        [
          { lengthCm: '28.00', breadthCm: '20.00', heightCm: '8.00' },
          { lengthCm: null, breadthCm: null, heightCm: null },
        ],
        FALLBACK,
      ),
    ).toEqual({ lengthCm: 30, breadthCm: 20, heightCm: 10 });
    expect(resolveParcelCm([{ lengthCm: '0', breadthCm: '1', heightCm: '1' }], FALLBACK)).toEqual({
      lengthCm: 30,
      breadthCm: 20,
      heightCm: 10,
    });
  });

  it('falls back when there are no lines at all', () => {
    expect(resolveParcelCm([], FALLBACK)).toEqual({ lengthCm: 30, breadthCm: 20, heightCm: 10 });
  });
});
