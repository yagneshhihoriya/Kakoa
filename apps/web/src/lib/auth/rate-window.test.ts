/**
 * Unit tests for the pure Class C rate-window math (auth-otp.md §6, §9). No DB.
 */
import { describe, expect, it } from 'vitest';

import {
  DESTINATION_WINDOWS,
  IP_WINDOW,
  decide,
  type WindowSpec,
} from './rate-window';

const NOW = 1_000_000;

/** Build the per-destination + per-IP check set at the given counts. */
function checks(counts: {
  d60: number;
  d600: number;
  dDay: number;
  ip: number;
}): { spec: WindowSpec; count: number }[] {
  return [
    { spec: DESTINATION_WINDOWS[0]!, count: counts.d60 },
    { spec: DESTINATION_WINDOWS[1]!, count: counts.d600 },
    { spec: DESTINATION_WINDOWS[2]!, count: counts.dDay },
    { spec: IP_WINDOW, count: counts.ip },
  ];
}

describe('window specs match the spec §6 limits', () => {
  it('per-destination: 1/60s, 3/10min, 10/day', () => {
    expect(DESTINATION_WINDOWS.map((w) => [w.seconds, w.limit])).toEqual([
      [60, 1],
      [600, 3],
      [86400, 10],
    ]);
  });
  it('per-IP: 20/hr', () => {
    expect([IP_WINDOW.seconds, IP_WINDOW.limit]).toEqual([3600, 20]);
  });
});

describe('decide — under limit', () => {
  it('a fresh destination (all zero) is allowed with tightest headroom', () => {
    const r = decide(checks({ d60: 0, d600: 0, dDay: 0, ip: 0 }), NOW);
    expect(r.ok).toBe(true);
    expect(r.retryAfterSec).toBe(0);
    // tightest window is the 60s/limit-1 → remaining 1
    expect(r.limit).toBe(1);
    expect(r.remaining).toBe(1);
    expect(r.reset).toBe(NOW + 60);
  });
});

describe('decide — 60s cooldown (1/60s)', () => {
  it('a second request within 60s is blocked with Retry-After 60', () => {
    const r = decide(checks({ d60: 1, d600: 1, dDay: 1, ip: 1 }), NOW);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBe(60);
    expect(r.remaining).toBe(0);
    expect(r.reset).toBe(NOW + 60);
  });
});

describe('decide — 3/10min', () => {
  it('the 4th request in 10min is blocked (10min binds over 60s)', () => {
    // 60s window free (0), but 10min window at its limit (3).
    const r = decide(checks({ d60: 0, d600: 3, dDay: 3, ip: 3 }), NOW);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBe(600);
    expect(r.reset).toBe(NOW + 600);
  });
});

describe('decide — 10/day', () => {
  it('the 11th request in a day is blocked with the day window binding', () => {
    const r = decide(checks({ d60: 0, d600: 0, dDay: 10, ip: 10 }), NOW);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBe(86400);
    expect(r.reset).toBe(NOW + 86400);
  });
});

describe('decide — per-IP 20/hr', () => {
  it('the 21st request from one IP is blocked even with a fresh destination', () => {
    const r = decide(checks({ d60: 0, d600: 0, dDay: 0, ip: 20 }), NOW);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBe(3600);
    expect(r.reset).toBe(NOW + 3600);
  });
});

describe('decide — multiple windows exceeded', () => {
  it('the longest exceeded window binds Retry-After (conservative)', () => {
    // Both 60s and day exceeded → day (86400) binds.
    const r = decide(checks({ d60: 1, d600: 0, dDay: 10, ip: 0 }), NOW);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBe(86400);
  });
});

describe('decide — IP gate skipped', () => {
  it('with only destination windows, headroom comes from those alone', () => {
    const r = decide(
      [
        { spec: DESTINATION_WINDOWS[0]!, count: 0 },
        { spec: DESTINATION_WINDOWS[1]!, count: 0 },
        { spec: DESTINATION_WINDOWS[2]!, count: 0 },
      ],
      NOW,
    );
    expect(r.ok).toBe(true);
    expect(r.limit).toBe(1); // 60s window tightest
  });
});
