/**
 * Request-context extraction for auth Route Handlers — the client IP and
 * user-agent that get stamped on `otp_challenges` / `customer_sessions` rows
 * (auth-otp.md §6: per-IP rate limits, `ua_hash` logging).
 *
 * On Vercel the edge sets `x-forwarded-for` (client is the FIRST hop);
 * `x-real-ip` is a fallback. Neither is trusted for authz — only for
 * best-effort rate bucketing and audit. Returns `null` when unparseable so the
 * per-IP gate degrades open (per-destination limits still bind).
 */

/** First public client IP from the proxy chain, or `null`. */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first && first.length > 0) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real && real.trim().length > 0) return real.trim();
  return null;
}

/** Raw user-agent (stored on the session row; logged only as a hash). */
export function userAgent(req: Request): string | null {
  const ua = req.headers.get('user-agent');
  return ua && ua.length > 0 ? ua : null;
}
