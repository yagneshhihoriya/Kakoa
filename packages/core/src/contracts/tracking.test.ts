import { describe, expect, it } from 'vitest';

import {
  CANCEL_REASON_MAX,
  CANCEL_REASON_MIN,
  cancelOrderSchema,
  countGraphemes,
  lookupRequestSchema,
  lookupVerifySchema,
} from './tracking';

describe('lookupRequestSchema', () => {
  it('accepts KK-48210 + a bare 10-digit phone, normalizing to E.164', () => {
    const parsed = lookupRequestSchema.parse({
      orderNumber: 'KK-48210',
      phone: '9876543210',
    });
    expect(parsed).toEqual({
      orderNumber: 'KK-48210',
      phone: '+919876543210',
    });
  });

  it('normalizes a +91-prefixed phone (with separators)', () => {
    const parsed = lookupRequestSchema.parse({
      orderNumber: 'KK-48210',
      phone: '+91 98765-43210',
    });
    expect(parsed.phone).toBe('+919876543210');
  });

  it('normalizes a 0-prefixed domestic phone', () => {
    const parsed = lookupRequestSchema.parse({
      orderNumber: 'KK-48210',
      phone: '09876543210',
    });
    expect(parsed.phone).toBe('+919876543210');
  });

  it('normalizes a 91-prefixed phone', () => {
    const parsed = lookupRequestSchema.parse({
      orderNumber: 'KK-48210',
      phone: '919876543210',
    });
    expect(parsed.phone).toBe('+919876543210');
  });

  it('rejects a malformed order number (too few digits)', () => {
    expect(
      lookupRequestSchema.safeParse({
        orderNumber: 'KK-4821',
        phone: '9876543210',
      }).success,
    ).toBe(false);
  });

  it('rejects a malformed order number (missing prefix)', () => {
    expect(
      lookupRequestSchema.safeParse({
        orderNumber: '48210',
        phone: '9876543210',
      }).success,
    ).toBe(false);
  });

  it('rejects a phone that cannot be normalized (starts with 5)', () => {
    expect(
      lookupRequestSchema.safeParse({
        orderNumber: 'KK-48210',
        phone: '5876543210',
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown key (.strict)', () => {
    expect(
      lookupRequestSchema.safeParse({
        orderNumber: 'KK-48210',
        phone: '9876543210',
        channel: 'sms',
      }).success,
    ).toBe(false);
  });
});

describe('lookupVerifySchema', () => {
  it('accepts a valid order + phone + 6-digit code', () => {
    const parsed = lookupVerifySchema.parse({
      orderNumber: 'KK-48210',
      phone: '9876543210',
      code: '042917',
    });
    expect(parsed).toEqual({
      orderNumber: 'KK-48210',
      phone: '+919876543210',
      code: '042917',
    });
  });

  it('rejects a 5-digit code', () => {
    expect(
      lookupVerifySchema.safeParse({
        orderNumber: 'KK-48210',
        phone: '9876543210',
        code: '04291',
      }).success,
    ).toBe(false);
  });

  it('rejects a non-numeric code', () => {
    expect(
      lookupVerifySchema.safeParse({
        orderNumber: 'KK-48210',
        phone: '9876543210',
        code: '04a917',
      }).success,
    ).toBe(false);
  });
});

describe('cancelOrderSchema', () => {
  it('accepts a reason within bounds', () => {
    const parsed = cancelOrderSchema.parse({ reason: 'Changed my mind' });
    expect(parsed.reason).toBe('Changed my mind');
  });

  it('trims surrounding whitespace before measuring', () => {
    const parsed = cancelOrderSchema.parse({ reason: '   Too slow   ' });
    expect(parsed.reason).toBe('Too slow');
  });

  it(`rejects a reason below ${CANCEL_REASON_MIN} graphemes`, () => {
    expect(cancelOrderSchema.safeParse({ reason: 'no' }).success).toBe(false);
  });

  it('rejects an empty / whitespace-only reason', () => {
    expect(cancelOrderSchema.safeParse({ reason: '   ' }).success).toBe(false);
  });

  it(`accepts exactly ${CANCEL_REASON_MIN} graphemes (lower boundary)`, () => {
    expect(cancelOrderSchema.safeParse({ reason: 'abc' }).success).toBe(true);
  });

  it(`accepts exactly ${CANCEL_REASON_MAX} graphemes (upper boundary)`, () => {
    const reason = 'a'.repeat(CANCEL_REASON_MAX);
    expect(cancelOrderSchema.safeParse({ reason }).success).toBe(true);
  });

  it(`rejects ${CANCEL_REASON_MAX + 1} graphemes (over the boundary)`, () => {
    const reason = 'a'.repeat(CANCEL_REASON_MAX + 1);
    expect(cancelOrderSchema.safeParse({ reason }).success).toBe(false);
  });

  it('counts an emoji as a single grapheme, not UTF-16 code units', () => {
    // "👨‍👩‍👧" is 8 UTF-16 code units but ONE grapheme; padded to reach the min.
    const reason = `👨‍👩‍👧 ok`;
    expect(countGraphemes(reason)).toBe(4); // family, space, o, k
    expect(cancelOrderSchema.safeParse({ reason }).success).toBe(true);
  });

  it('rejects an unknown key (.strict)', () => {
    expect(
      cancelOrderSchema.safeParse({
        reason: 'Changed my mind',
        orderNumber: 'KK-48210',
      }).success,
    ).toBe(false);
  });
});

describe('countGraphemes', () => {
  it('counts ASCII by character', () => {
    expect(countGraphemes('hello')).toBe(5);
  });

  it('counts a combining sequence as one', () => {
    // "e" + combining acute accent U+0301 = one grapheme.
    expect(countGraphemes('é')).toBe(1);
  });
});
