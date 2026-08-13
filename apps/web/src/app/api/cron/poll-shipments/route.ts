/**
 * GET /api/cron/poll-shipments — scheduled reconciliation poller (Vercel Cron).
 *
 * The safety net that runs alongside the real-time delivery webhook: even if a
 * webhook is missed, tracking status auto-syncs on a schedule. Runs the SAME
 * shared `pollStaleShipments` reconcile loop as the admin manual trigger.
 *
 * Auth follows Vercel's cron pattern: when the CRON_SECRET env var is set, Vercel
 * attaches `Authorization: Bearer <CRON_SECRET>` to every cron invocation. We
 * compare it constant-time (mirroring the webhook route). Missing secret or
 * mismatch → 401, nothing runs. This route is machine-facing — NOT behind the
 * admin session guard, and returns terse JSON, not copy.
 */
import { timingSafeEqual } from 'node:crypto';
import { parseServerEnv } from '@kakoa/config';
import { pollStaleShipments } from '@/lib/admin/shipping';

// DB + provider calls: force the Node runtime and never cache the response.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function GET(req: Request): Promise<Response> {
  const secret = parseServerEnv().CRON_SECRET;
  const provided = req.headers.get('authorization') ?? '';
  if (secret === undefined || !safeEqual(provided, `Bearer ${secret}`)) {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { checked, advanced } = await pollStaleShipments();
  return Response.json({ ok: true, scanned: checked, advanced }, { status: 200 });
}
