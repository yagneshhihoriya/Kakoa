/**
 * POST /api/admin/shipping/poll — reconciliation poller (safety net for missed
 * webhooks, HANDOFF-Shiprocket §7). Scans stale active non-terminal shipments,
 * calls `track(awb)` for each, maps the status, and applies it via the SAME
 * forward-only `applyTrackingStatus` as the webhook.
 *
 * Guard `shipping:manage` so an admin can trigger the reconcile manually. The
 * reconcile loop itself lives in the shared `pollStaleShipments` lib function,
 * which the scheduled `GET /api/cron/poll-shipments` (Vercel Cron) also calls.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { pollStaleShipments } from '@/lib/admin/shipping';

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('shipping:manage');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const olderThanMinutes = Number(url.searchParams.get('olderThanMinutes') ?? '30') || 30;
  const limit = Number(url.searchParams.get('limit') ?? '100') || 100;

  const summary = await pollStaleShipments({ olderThanMinutes, limit });
  return jsonOk(summary, { cacheControl: NO_STORE });
}
