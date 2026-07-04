import { describe, expect, it } from 'vitest';

import {
  DateTimeError,
  IST_TIME_ZONE,
  formatIST,
  istDayToUtcRange,
} from './datetime';

describe('constants', () => {
  it('uses Asia/Kolkata', () => {
    expect(IST_TIME_ZONE).toBe('Asia/Kolkata');
  });
});

describe('formatIST', () => {
  it('formats a UTC instant as IST wall time', () => {
    // 2026-07-02T18:00:00Z = 23:30 IST on 02 Jul 2026 (UTC+5:30)
    expect(formatIST(new Date('2026-07-02T18:00:00Z'))).toBe(
      '02 Jul 2026, 11:30 pm IST',
    );
  });

  it('23:30 IST order lands on the correct IST calendar day', () => {
    // 18:00 UTC on Jul 2 is STILL Jul 2 in IST (23:30) ...
    expect(formatIST(new Date('2026-07-02T18:00:00Z'))).toContain(
      '02 Jul 2026',
    );
    // ... but 18:30 UTC on Jul 2 is ALREADY Jul 3 in IST (00:00)
    expect(formatIST(new Date('2026-07-02T18:30:00Z'))).toBe(
      '03 Jul 2026, 12:00 am IST',
    );
  });

  it('formats morning times with zero-padded 12h clock', () => {
    // 2026-01-15T04:05:00Z = 09:35 IST
    expect(formatIST(new Date('2026-01-15T04:05:00Z'))).toBe(
      '15 Jan 2026, 09:35 am IST',
    );
  });

  it('throws on invalid Date', () => {
    expect(() => formatIST(new Date('nonsense'))).toThrow(DateTimeError);
  });
});

describe('istDayToUtcRange', () => {
  it('converts an IST calendar day to UTC bounds (start inclusive, end exclusive)', () => {
    const { start, end } = istDayToUtcRange('2026-07-02');
    expect(start.toISOString()).toBe('2026-07-01T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-07-02T18:30:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('boundary: a 23:30 IST order falls inside its IST day, midnight falls in the next', () => {
    const jul2 = istDayToUtcRange('2026-07-02');
    const jul3 = istDayToUtcRange('2026-07-03');

    const lateNightOrder = new Date('2026-07-02T18:00:00Z'); // 23:30 IST Jul 2
    expect(lateNightOrder.getTime()).toBeGreaterThanOrEqual(
      jul2.start.getTime(),
    );
    expect(lateNightOrder.getTime()).toBeLessThan(jul2.end.getTime());

    const midnightOrder = new Date('2026-07-02T18:30:00Z'); // 00:00 IST Jul 3
    expect(midnightOrder.getTime()).toBeGreaterThanOrEqual(
      jul3.start.getTime(),
    );
    expect(midnightOrder.getTime()).toBeLessThan(jul3.end.getTime());
    // end is EXCLUSIVE: midnight does NOT belong to Jul 2
    expect(midnightOrder.getTime()).toBe(jul2.end.getTime());
  });

  it('consecutive days tile perfectly (no gap, no overlap)', () => {
    const a = istDayToUtcRange('2026-12-31');
    const b = istDayToUtcRange('2027-01-01');
    expect(a.end.getTime()).toBe(b.start.getTime());
  });

  it('handles month/year rollovers and leap days', () => {
    expect(istDayToUtcRange('2028-02-29').start.toISOString()).toBe(
      '2028-02-28T18:30:00.000Z',
    );
    expect(istDayToUtcRange('2026-01-01').start.toISOString()).toBe(
      '2025-12-31T18:30:00.000Z',
    );
  });

  it('rejects malformed strings and impossible dates', () => {
    expect(() => istDayToUtcRange('02-07-2026')).toThrow(DateTimeError);
    expect(() => istDayToUtcRange('2026/07/02')).toThrow(DateTimeError);
    expect(() => istDayToUtcRange('2026-7-2')).toThrow(DateTimeError);
    expect(() => istDayToUtcRange('garbage')).toThrow(DateTimeError);
    expect(() => istDayToUtcRange('2026-02-30')).toThrow(DateTimeError);
    expect(() => istDayToUtcRange('2026-13-01')).toThrow(DateTimeError);
    expect(() => istDayToUtcRange('2027-02-29')).toThrow(DateTimeError); // not a leap year
  });
});
