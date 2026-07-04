/**
 * Pure Class C rate-window math — auth-otp.md §6. Dependency-free so the
 * window/decision logic is unit-testable without a DB. `rate-limit.ts` supplies
 * the live row counts and calls {@link decide}.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the client may retry (0 when under limit). */
  retryAfterSec: number;
  /** The limit of the binding window (the one that produced `remaining`). */
  limit: number;
  /** Requests left in the binding window (0 when blocked). */
  remaining: number;
  /** Unix seconds at which the binding window frees up. */
  reset: number;
}

export interface WindowSpec {
  /** Human label for logs/debugging. */
  name: string;
  /** Window length in seconds. */
  seconds: number;
  /** Max rows allowed within the window (inclusive). */
  limit: number;
}

/** Per-destination windows (§6): 1/60s, 3/10min, 10/day. */
export const DESTINATION_WINDOWS: readonly WindowSpec[] = [
  { name: '60s', seconds: 60, limit: 1 },
  { name: '10min', seconds: 10 * 60, limit: 3 },
  { name: 'day', seconds: 24 * 60 * 60, limit: 10 },
] as const;

/** Per-IP window (§6): 20/hr. */
export const IP_WINDOW: WindowSpec = { name: 'ip-hr', seconds: 60 * 60, limit: 20 };

/**
 * Decide over a set of (window, currentCount) pairs. A window is exceeded when
 * `count >= limit` (the next request would exceed it). When multiple windows
 * are exceeded the longest one binds `Retry-After` (conservative); when none is
 * exceeded the window with the least headroom drives the advisory headers.
 */
export function decide(
  checks: readonly { spec: WindowSpec; count: number }[],
  nowSec: number,
): RateLimitResult {
  const exceeded = checks.filter(({ spec, count }) => count >= spec.limit);

  if (exceeded.length > 0) {
    let binding = exceeded[0]!;
    for (const c of exceeded) if (c.spec.seconds > binding.spec.seconds) binding = c;
    return {
      ok: false,
      retryAfterSec: binding.spec.seconds,
      limit: binding.spec.limit,
      remaining: 0,
      reset: nowSec + binding.spec.seconds,
    };
  }

  let tightest = checks[0]!;
  let tightestRemaining = tightest.spec.limit - tightest.count;
  for (const c of checks) {
    const remaining = c.spec.limit - c.count;
    if (remaining < tightestRemaining) {
      tightest = c;
      tightestRemaining = remaining;
    }
  }
  return {
    ok: true,
    retryAfterSec: 0,
    limit: tightest.spec.limit,
    remaining: Math.max(0, tightestRemaining),
    reset: nowSec + tightest.spec.seconds,
  };
}
