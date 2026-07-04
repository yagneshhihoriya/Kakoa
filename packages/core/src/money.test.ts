import { describe, expect, it } from 'vitest';

import {
  MoneyError,
  addPaise,
  formatPaise,
  multiplyPaise,
  toPaise,
} from './money';

describe('toPaise', () => {
  it('brands safe integers (incl. zero and negatives)', () => {
    expect(toPaise(0)).toBe(0);
    expect(toPaise(49900)).toBe(49900);
    expect(toPaise(-2376)).toBe(-2376);
    expect(toPaise(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('throws on non-integer / non-finite input', () => {
    expect(() => toPaise(1.5)).toThrow(MoneyError);
    expect(() => toPaise(0.1)).toThrow(MoneyError);
    expect(() => toPaise(Number.NaN)).toThrow(MoneyError);
    expect(() => toPaise(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
    expect(() => toPaise(Number.MAX_SAFE_INTEGER + 1)).toThrow(MoneyError);
  });
});

describe('addPaise', () => {
  it('sums amounts', () => {
    expect(addPaise(toPaise(1), toPaise(2), toPaise(3))).toBe(6);
    expect(addPaise()).toBe(0);
    expect(addPaise(toPaise(49900), toPaise(-2376))).toBe(47524);
  });

  it('throws when the sum overflows safe-integer range', () => {
    expect(() =>
      addPaise(toPaise(Number.MAX_SAFE_INTEGER), toPaise(1)),
    ).toThrow(MoneyError);
  });
});

describe('multiplyPaise', () => {
  it('multiplies by a non-negative integer quantity', () => {
    expect(multiplyPaise(toPaise(49900), 3)).toBe(149700);
    expect(multiplyPaise(toPaise(1), 1)).toBe(1); // 1-paisa line item
    expect(multiplyPaise(toPaise(49900), 0)).toBe(0);
  });

  it('throws on negative, fractional, or non-finite factors', () => {
    expect(() => multiplyPaise(toPaise(100), -1)).toThrow(MoneyError);
    expect(() => multiplyPaise(toPaise(100), 1.5)).toThrow(MoneyError);
    expect(() => multiplyPaise(toPaise(100), Number.NaN)).toThrow(MoneyError);
  });

  it('throws when the product overflows safe-integer range', () => {
    expect(() =>
      multiplyPaise(toPaise(Number.MAX_SAFE_INTEGER), 2),
    ).toThrow(MoneyError);
  });
});

describe('formatPaise — Indian grouping', () => {
  it('formats the canonical example ₹1,11,100.00', () => {
    expect(formatPaise(toPaise(11110000))).toBe('₹1,11,100.00');
  });

  it.each([
    [0, '₹0.00'],
    [1, '₹0.01'], // single paisa
    [99, '₹0.99'],
    [100, '₹1.00'],
    [49900, '₹499.00'],
    [100000, '₹1,000.00'],
    [9999900, '₹99,999.00'],
    [10000000, '₹1,00,000.00'], // 1 lakh
    [123456789, '₹12,34,567.89'],
    [1000000000, '₹1,00,00,000.00'], // 1 crore
    [123456789012, '₹1,23,45,67,890.12'],
  ] as Array<[number, string]>)('%d paise -> %s', (paise, expected) => {
    expect(formatPaise(toPaise(paise))).toBe(expected);
  });

  it('renders negatives with a leading minus', () => {
    expect(formatPaise(toPaise(-100))).toBe('-₹1.00');
    expect(formatPaise(toPaise(-11110000))).toBe('-₹1,11,100.00');
  });

  it('throws on non-integer amounts (no float money, ever)', () => {
    expect(() => formatPaise(499.5)).toThrow(MoneyError);
    expect(() => formatPaise(Number.NaN)).toThrow(MoneyError);
  });
});
