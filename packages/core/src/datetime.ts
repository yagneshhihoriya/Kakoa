/**
 * IST datetime helpers — Contract §3.0 Global Conventions (PROJECT_PLAN.md).
 *
 * DB and app servers run UTC; **display is always Asia/Kolkata (IST)**.
 * Admin metric date ranges are interpreted as IST calendar days and
 * converted to UTC bounds server-side via `istDayToUtcRange()`.
 * Implemented with `Intl` only — no date library dependency.
 */

export const IST_TIME_ZONE = 'Asia/Kolkata';

export class DateTimeError extends Error {
  override readonly name = 'DateTimeError';
}

const PART_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function partsOf(date: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of PART_FORMATTER.formatToParts(date)) {
    out[part.type] = part.value;
  }
  return out;
}

/**
 * Format an instant for IST display: `"02 Jul 2026, 11:30 pm IST"`.
 * Assembled from `formatToParts` so the output is locale-drift-proof.
 */
export function formatIST(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new DateTimeError('formatIST received an invalid Date');
  }
  const p = partsOf(date);
  const day = (p['day'] ?? '').padStart(2, '0');
  const hour = (p['hour'] ?? '').padStart(2, '0');
  const minute = (p['minute'] ?? '').padStart(2, '0');
  const dayPeriod = (p['dayPeriod'] ?? '').toLowerCase();
  return `${day} ${p['month'] ?? ''} ${p['year'] ?? ''}, ${hour}:${minute} ${dayPeriod} IST`;
}

const UTC_WALL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: IST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Zone offset (ms) of Asia/Kolkata at the given UTC instant, via Intl. */
function istOffsetMs(utcMs: number): number {
  const p: Record<string, string> = {};
  for (const part of UTC_WALL_FORMATTER.formatToParts(new Date(utcMs))) {
    p[part.type] = part.value;
  }
  const wallAsUtc = Date.UTC(
    Number(p['year']),
    Number(p['month']) - 1,
    Number(p['day']),
    Number(p['hour']),
    Number(p['minute']),
    Number(p['second']),
  );
  return wallAsUtc - utcMs;
}

/** UTC instant of IST midnight starting the given IST calendar date. */
function istMidnightUtcMs(year: number, month: number, day: number): number {
  const naive = Date.UTC(year, month - 1, day);
  // First guess assumes zero offset; one correction suffices (IST has no DST).
  return naive - istOffsetMs(naive - istOffsetMs(naive));
}

export interface UtcRange {
  /** Inclusive start: IST midnight of the day, as a UTC instant. */
  start: Date;
  /** Exclusive end: IST midnight of the next day, as a UTC instant. */
  end: Date;
}

/**
 * Convert an IST calendar day (`"yyyy-mm-dd"`) to its UTC bounds:
 * `istDayToUtcRange('2026-07-02')` →
 * `{ start: 2026-07-01T18:30:00.000Z, end: 2026-07-02T18:30:00.000Z }`
 * (start inclusive, end exclusive).
 */
export function istDayToUtcRange(istDay: string): UtcRange {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(istDay);
  if (!match) {
    throw new DateTimeError(
      `istDayToUtcRange expects "yyyy-mm-dd", got "${istDay}"`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Reject impossible calendar dates (e.g. 2026-02-30) via UTC round-trip.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new DateTimeError(`"${istDay}" is not a valid calendar date`);
  }
  const startMs = istMidnightUtcMs(year, month, day);
  const endMs = istMidnightUtcMs(year, month, day + 1);
  return { start: new Date(startMs), end: new Date(endMs) };
}
