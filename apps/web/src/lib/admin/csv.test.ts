/**
 * Unit tests for the pure CSV serializer — RFC-4180 quoting/escaping + the
 * spreadsheet formula-injection defense.
 */
import { describe, expect, it } from 'vitest';
import { paiseToRupeeString, toCsv } from './csv';

describe('toCsv — RFC-4180', () => {
  it('emits a header + rows joined by CRLF', () => {
    const csv = toCsv(['a', 'b'], [[1, 'x'], [2, 'y']]);
    expect(csv).toBe('a,b\r\n1,x\r\n2,y');
  });

  it('quotes cells with commas, quotes or newlines and doubles quotes', () => {
    expect(toCsv(['h'], [['a,b']])).toBe('h\r\n"a,b"');
    expect(toCsv(['h'], [['he said "hi"']])).toBe('h\r\n"he said ""hi"""');
    expect(toCsv(['h'], [['line1\nline2']])).toBe('h\r\n"line1\nline2"');
  });

  it('emits null as an empty cell and numbers verbatim', () => {
    expect(toCsv(['a', 'b'], [[null, 42]])).toBe('a,b\r\n,42');
  });
});

describe('toCsv — injection defense', () => {
  it("prefixes formula-triggering cells with a single quote", () => {
    expect(toCsv(['h'], [['=1+1']])).toBe("h\r\n'=1+1");
    expect(toCsv(['h'], [['+SUM(A1)']])).toBe("h\r\n'+SUM(A1)");
    expect(toCsv(['h'], [['-2']])).toBe("h\r\n'-2");
    expect(toCsv(['h'], [['@cmd']])).toBe("h\r\n'@cmd");
  });

  it('combines injection prefix with quoting when needed', () => {
    // starts with '=' AND contains a comma → prefixed then quoted.
    expect(toCsv(['h'], [['=A,B']])).toBe('h\r\n"\'=A,B"');
  });

  it('does not touch safe strings or negative NUMBERS', () => {
    expect(toCsv(['h'], [['SAVE10']])).toBe('h\r\nSAVE10');
    // numeric -2 is a number, not a string → not prefixed.
    expect(toCsv(['h'], [[-2]])).toBe('h\r\n-2');
  });
});

describe('paiseToRupeeString', () => {
  it('formats paise as rupees with 2 decimals', () => {
    expect(paiseToRupeeString(4900)).toBe('49.00');
    expect(paiseToRupeeString(199900)).toBe('1999.00');
    expect(paiseToRupeeString(0)).toBe('0.00');
  });
});
