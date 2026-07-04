/**
 * Class C rate limiting by counting `otp_challenges` rows — auth-otp.md §6,
 * Contract §2.1. Postgres is the authority (no Redis at launch): the middleware
 * per-IP token bucket is the first gate, but these row counts are the truth.
 *
 * Per destination: 1 / 60s, 3 / 10min, 10 / day.
 * Per IP:          20 / hour.
 *
 * All windows count `created_at` within the window against DB `now()` — the app
 * clock is never consulted (matches TTL/consume, §7 edge case 3). The pure
 * window/decision math lives in `rate-window.ts`; this module only supplies the
 * live row counts.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { db, otpChallenges } from '@kakoa/db';
import { eq, sql } from 'drizzle-orm';

import {
  DESTINATION_WINDOWS,
  IP_WINDOW,
  decide,
  type RateLimitResult,
  type WindowSpec,
} from './rate-window';

export type { RateLimitResult } from './rate-window';

/**
 * Count challenge rows for `destination` in each window in a single round-trip
 * (`count(*) FILTER (WHERE …)` per window). Keyed by window seconds.
 */
async function countDestinationWindows(
  destination: string,
): Promise<Map<number, number>> {
  const [row] = await db
    .select({
      w60: sql<number>`count(*) FILTER (WHERE ${otpChallenges.createdAt} > now() - interval '60 seconds')`.mapWith(
        Number,
      ),
      w600: sql<number>`count(*) FILTER (WHERE ${otpChallenges.createdAt} > now() - interval '600 seconds')`.mapWith(
        Number,
      ),
      wDay: sql<number>`count(*) FILTER (WHERE ${otpChallenges.createdAt} > now() - interval '86400 seconds')`.mapWith(
        Number,
      ),
    })
    .from(otpChallenges)
    .where(eq(otpChallenges.destination, destination));

  return new Map<number, number>([
    [60, row?.w60 ?? 0],
    [600, row?.w600 ?? 0],
    [86400, row?.wDay ?? 0],
  ]);
}

/** Count challenge rows from `ip` in the per-IP hour window. */
async function countIpWindow(ip: string): Promise<number> {
  const [row] = await db
    .select({
      c: sql<number>`count(*) FILTER (WHERE ${otpChallenges.createdAt} > now() - interval '3600 seconds')`.mapWith(
        Number,
      ),
    })
    .from(otpChallenges)
    .where(sql`${otpChallenges.ip} = ${ip}::inet`);
  return row?.c ?? 0;
}

/**
 * Full Class C check for an OTP request: per-destination (1/60s, 3/10min,
 * 10/day) AND per-IP (20/hr). Returns the blocking (or tightest-headroom)
 * result for the response headers. A missing/unparseable IP skips the IP gate
 * (per-destination limits still apply).
 */
export async function checkOtpRequestRateLimit(input: {
  destination: string;
  ip: string | null;
}): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);

  const destCounts = await countDestinationWindows(input.destination);
  const checks: { spec: WindowSpec; count: number }[] = DESTINATION_WINDOWS.map(
    (spec) => ({ spec, count: destCounts.get(spec.seconds) ?? 0 }),
  );

  if (input.ip !== null && input.ip.length > 0) {
    const ipCount = await countIpWindow(input.ip);
    checks.push({ spec: IP_WINDOW, count: ipCount });
  }

  return decide(checks, nowSec);
}
