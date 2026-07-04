/**
 * Pure date-range + bucketing helpers for Analytics — NO @kakoa/db import, so
 * they're unit-testable and the single source of truth for the IST calendar
 * boundaries the metrics queries bucket on.
 *
 * All boundaries are **Asia/Kolkata (IST, UTC+5:30, no DST) day starts**,
 * returned as UTC instants (ISO strings) so they compare directly against
 * `orders.placed_at` (timestamptz). Ranges are HALF-OPEN `[fromIso, toIso)` — the
 * upper bound is the start of the day AFTER the last included day, so "today" is
 * always included without an off-by-one.
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type RangePreset = '7d' | '30d' | '90d' | 'mtd' | 'ytd' | 'all';
export type Bucket = 'day' | 'week' | 'month';

const PRESETS: readonly RangePreset[] = ['7d', '30d', '90d', 'mtd', 'ytd', 'all'];

export function isRangePreset(v: string): v is RangePreset {
  return (PRESETS as readonly string[]).includes(v);
}

/** Max span (days) for a CUSTOM from/to range — bounds the query + zero-fill. */
export const MAX_SPAN_DAYS = 731;
const DAY_MS = 24 * 60 * 60 * 1000;

/* ── IST calendar helpers (work in "shifted" space = UTC + IST offset) ── */

/** UTC instant of IST-midnight for the IST day containing `d`. */
function istDayStart(d: Date): Date {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  const dayStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(dayStart - IST_OFFSET_MS);
}

/** UTC instant of the first day (IST) of the month containing `d`. */
function istMonthStart(d: Date): Date {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  const monthStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
  return new Date(monthStart - IST_OFFSET_MS);
}

/** UTC instant of Jan 1 (IST) of the year containing `d`. */
function istYearStart(d: Date): Date {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  const yearStart = Date.UTC(shifted.getUTCFullYear(), 0, 1);
  return new Date(yearStart - IST_OFFSET_MS);
}

/** UTC instant of the Monday (IST) of the ISO week containing `d` (matches PG date_trunc('week')). */
function istWeekStart(d: Date): Date {
  const dayStart = istDayStart(d);
  const shifted = new Date(dayStart.getTime() + IST_OFFSET_MS);
  const dow = shifted.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7;
  return new Date(dayStart.getTime() - daysSinceMonday * DAY_MS);
}

/** Add whole days to an IST day start (DST-free, so a fixed ms add is exact). */
function addDaysIst(dayStart: Date, days: number): Date {
  return istDayStart(new Date(dayStart.getTime() + days * DAY_MS + DAY_MS / 2));
}

/** Add whole months to an IST month start. */
function addMonthsIst(monthStart: Date, months: number): Date {
  const shifted = new Date(monthStart.getTime() + IST_OFFSET_MS);
  const next = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + months, 1);
  return new Date(next - IST_OFFSET_MS);
}

/** Parse a `YYYY-MM-DD` (or ISO) string to its IST day start, or null. */
function parseIstDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const utcGuess = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12, 0, 0));
  if (Number.isNaN(utcGuess.getTime())) return null;
  // Guard against overflow (e.g. 2026-13-40 → rolled over).
  const shifted = new Date(utcGuess.getTime());
  if (shifted.getUTCMonth() !== Number(mo) - 1 || shifted.getUTCDate() !== Number(d)) return null;
  return istDayStart(utcGuess);
}

export interface ResolvedRange {
  fromIso: string;
  /** Exclusive upper bound (start of the day after the last included IST day). */
  toIso: string;
  preset: RangePreset | 'custom';
  bucketDefault: Bucket;
}

export interface RangeInput {
  preset?: string;
  from?: string;
  to?: string;
}

export type ResolveRangeResult =
  | { ok: true; range: ResolvedRange }
  | { ok: false; message: string };

/**
 * Resolve a range request to IST day boundaries. A custom `from`/`to` (both
 * required together) is validated (parseable, `from <= to`, span ≤ MAX_SPAN_DAYS)
 * and takes precedence; otherwise the `preset` (default `30d`) is used.
 */
export function resolveRange(input: RangeInput, now: Date = new Date()): ResolveRangeResult {
  const todayStart = istDayStart(now);
  const tomorrowStart = addDaysIst(todayStart, 1);

  // Custom range (both bounds required).
  if (input.from !== undefined || input.to !== undefined) {
    if (input.from === undefined || input.to === undefined) {
      return { ok: false, message: 'Both a start and end date are required for a custom range.' };
    }
    const from = parseIstDay(input.from);
    const to = parseIstDay(input.to);
    if (from === null || to === null) {
      return { ok: false, message: 'Enter valid dates (YYYY-MM-DD).' };
    }
    if (from.getTime() > to.getTime()) {
      return { ok: false, message: 'The start date must be on or before the end date.' };
    }
    const spanDays = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
    if (spanDays > MAX_SPAN_DAYS) {
      return { ok: false, message: `Choose a range of at most ${MAX_SPAN_DAYS} days.` };
    }
    const toExclusive = addDaysIst(to, 1);
    return {
      ok: true,
      range: {
        fromIso: from.toISOString(),
        toIso: toExclusive.toISOString(),
        preset: 'custom',
        bucketDefault: spanDays > 92 ? 'week' : 'day',
      },
    };
  }

  const preset: RangePreset = input.preset !== undefined && isRangePreset(input.preset) ? input.preset : '30d';

  let from: Date;
  let bucketDefault: Bucket;
  switch (preset) {
    case '7d':
      from = addDaysIst(todayStart, -6);
      bucketDefault = 'day';
      break;
    case '30d':
      from = addDaysIst(todayStart, -29);
      bucketDefault = 'day';
      break;
    case '90d':
      from = addDaysIst(todayStart, -89);
      bucketDefault = 'week';
      break;
    case 'mtd':
      from = istMonthStart(now);
      bucketDefault = 'day';
      break;
    case 'ytd':
      from = istYearStart(now);
      bucketDefault = 'month';
      break;
    case 'all':
      from = istDayStart(new Date(Date.UTC(2000, 0, 1, 12)));
      bucketDefault = 'month';
      break;
  }

  return {
    ok: true,
    range: {
      fromIso: from.toISOString(),
      toIso: tomorrowStart.toISOString(),
      preset,
      bucketDefault,
    },
  };
}

export interface BucketPlan {
  bucket: Bucket;
  /** IST period-start UTC instants (ISO) covering `[from, to)`, ascending. */
  startsIso: string[];
}

/**
 * The list of bucket-start instants to zero-fill across the range, with
 * auto-upgrade so a huge range never explodes into thousands of points:
 * `day` → `week` beyond ~92 days, and anything → `month` beyond the span cap.
 */
export function bucketsFor(range: ResolvedRange, requested: Bucket): BucketPlan {
  const from = new Date(range.fromIso);
  const to = new Date(range.toIso);
  const spanDays = Math.round((to.getTime() - from.getTime()) / DAY_MS);

  let bucket: Bucket = requested;
  if (bucket === 'day' && spanDays > 92) bucket = 'week';
  if (bucket !== 'month' && spanDays > MAX_SPAN_DAYS) bucket = 'month';

  const startsIso: string[] = [];
  if (bucket === 'day') {
    let cur = istDayStart(from);
    while (cur.getTime() < to.getTime()) {
      startsIso.push(cur.toISOString());
      cur = addDaysIst(cur, 1);
    }
  } else if (bucket === 'week') {
    let cur = istWeekStart(from);
    while (cur.getTime() < to.getTime()) {
      startsIso.push(cur.toISOString());
      cur = addDaysIst(cur, 7);
    }
  } else {
    let cur = istMonthStart(from);
    while (cur.getTime() < to.getTime()) {
      startsIso.push(cur.toISOString());
      cur = addMonthsIst(cur, 1);
    }
  }

  return { bucket, startsIso };
}

/** The Postgres `date_trunc` field for a bucket. */
export function truncField(bucket: Bucket): 'day' | 'week' | 'month' {
  return bucket;
}
