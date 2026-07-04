/**
 * Unit tests for the pure range/bucketing helpers — IST boundaries, preset
 * resolution, custom-range validation (from>to, span cap), and bucket
 * auto-upgrade.
 */
import { describe, expect, it } from 'vitest';
import { bucketsFor, resolveRange, type ResolvedRange } from './analytics-range';

// 2026-07-05T10:00Z = 15:30 IST on 2026-07-05. IST day start = 2026-07-04T18:30Z.
const NOW = new Date('2026-07-05T10:00:00.000Z');
const TODAY_IST_START = '2026-07-04T18:30:00.000Z';
const TOMORROW_IST_START = '2026-07-05T18:30:00.000Z';

function range(input: Parameters<typeof resolveRange>[0]): ResolvedRange {
  const r = resolveRange(input, NOW);
  if (!r.ok) throw new Error(`expected ok: ${r.message}`);
  return r.range;
}

describe('resolveRange — presets (IST boundaries)', () => {
  it('defaults to 30d', () => {
    expect(resolveRange({}, NOW).ok && range({}).preset).toBe('30d');
  });

  it('toIso is start of tomorrow IST (today included)', () => {
    expect(range({ preset: '7d' }).toIso).toBe(TOMORROW_IST_START);
  });

  it('7d spans 7 IST days ending today', () => {
    const r = range({ preset: '7d' });
    expect(r.fromIso).toBe('2026-06-28T18:30:00.000Z');
    expect(r.bucketDefault).toBe('day');
  });

  it('30d starts 29 days before today', () => {
    expect(range({ preset: '30d' }).fromIso).toBe('2026-06-05T18:30:00.000Z');
  });

  it('mtd starts on the 1st of the month IST', () => {
    expect(range({ preset: 'mtd' }).fromIso).toBe('2026-06-30T18:30:00.000Z'); // 2026-07-01 00:00 IST
  });

  it('ytd starts on Jan 1 IST with a month default bucket', () => {
    const r = range({ preset: 'ytd' });
    expect(r.fromIso).toBe('2025-12-31T18:30:00.000Z'); // 2026-01-01 00:00 IST
    expect(r.bucketDefault).toBe('month');
  });

  it('all starts far in the past with a month default bucket', () => {
    const r = range({ preset: 'all' });
    expect(r.fromIso).toBe('1999-12-31T18:30:00.000Z'); // 2000-01-01 00:00 IST
    expect(r.bucketDefault).toBe('month');
    expect(r.toIso).toBe(TOMORROW_IST_START);
  });

  it('unknown preset falls back to 30d', () => {
    expect(range({ preset: 'bogus' }).preset).toBe('30d');
  });
});

describe('resolveRange — custom', () => {
  it('resolves a valid custom range (to is exclusive next-day start)', () => {
    const r = range({ from: '2026-06-01', to: '2026-06-30' });
    expect(r.preset).toBe('custom');
    expect(r.fromIso).toBe('2026-05-31T18:30:00.000Z'); // 2026-06-01 00:00 IST
    expect(r.toIso).toBe('2026-06-30T18:30:00.000Z'); // 2026-07-01 00:00 IST
    expect(r.bucketDefault).toBe('day');
  });

  it('rejects from > to', () => {
    const r = resolveRange({ from: '2026-06-30', to: '2026-06-01' }, NOW);
    expect(r.ok).toBe(false);
  });

  it('rejects a span over the cap', () => {
    const r = resolveRange({ from: '2020-01-01', to: '2026-01-01' }, NOW);
    expect(r.ok).toBe(false);
  });

  it('rejects a lone bound and bad dates', () => {
    expect(resolveRange({ from: '2026-06-01' }, NOW).ok).toBe(false);
    expect(resolveRange({ from: 'nope', to: 'nope' }, NOW).ok).toBe(false);
    expect(resolveRange({ from: '2026-13-40', to: '2026-13-41' }, NOW).ok).toBe(false);
  });

  it('a >92-day custom range defaults to week bucket', () => {
    expect(range({ from: '2026-01-01', to: '2026-06-01' }).bucketDefault).toBe('week');
  });
});

describe('bucketsFor — zero-fill list + auto-upgrade', () => {
  it('7d/day yields 7 ascending day starts, first === fromIso', () => {
    const r = range({ preset: '7d' });
    const plan = bucketsFor(r, 'day');
    expect(plan.bucket).toBe('day');
    expect(plan.startsIso).toHaveLength(7);
    expect(plan.startsIso[0]).toBe(r.fromIso);
    expect(plan.startsIso.at(-1)).toBe(TODAY_IST_START);
    // strictly ascending, 24h apart
    for (let i = 1; i < plan.startsIso.length; i += 1) {
      expect(new Date(plan.startsIso[i]!).getTime() - new Date(plan.startsIso[i - 1]!).getTime()).toBe(86_400_000);
    }
  });

  it('auto-upgrades day → week beyond ~92 days', () => {
    const r = range({ from: '2026-01-01', to: '2026-06-01' });
    expect(bucketsFor(r, 'day').bucket).toBe('week');
  });

  it('auto-upgrades to month on an all-time range', () => {
    const r = range({ preset: 'all' });
    expect(bucketsFor(r, 'day').bucket).toBe('month');
    expect(bucketsFor(r, 'week').bucket).toBe('month');
  });

  it('week buckets start on Mondays (IST)', () => {
    const r = range({ preset: '90d' });
    const plan = bucketsFor(r, 'week');
    expect(plan.bucket).toBe('week');
    for (const iso of plan.startsIso) {
      // Monday 00:00 IST == Sunday 18:30 UTC → UTC day is Sunday(0), hours 18:30.
      const d = new Date(iso);
      expect(d.getUTCDay()).toBe(0);
      expect(d.getUTCHours()).toBe(18);
      expect(d.getUTCMinutes()).toBe(30);
    }
  });
});
