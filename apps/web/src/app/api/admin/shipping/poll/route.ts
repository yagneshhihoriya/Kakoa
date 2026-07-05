/**
 * POST /api/admin/shipping/poll — reconciliation poller (safety net for missed
 * webhooks, HANDOFF-Shiprocket §7). Scans stale active non-terminal shipments,
 * calls `track(awb)` for each, maps the status, and applies it via the SAME
 * forward-only `applyTrackingStatus` as the webhook.
 *
 * Guard `shipping:manage` so an external cron can hit it with an admin session
 * (productionizing this as a real cron/Inngest is the next step). Best-effort per
 * shipment — one failure never aborts the batch.
 */
import { mapShiprocketStatus } from '@kakoa/integrations';
import { getShippingProvider } from '@kakoa/integrations';
import type { ShipmentStatus } from '@kakoa/core';
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { applyTrackingStatus, listStalePollShipments } from '@/lib/admin/shipping';

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('shipping:manage');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const olderThan = Number(url.searchParams.get('olderThanMinutes') ?? '30') || 30;
  const limit = Number(url.searchParams.get('limit') ?? '100') || 100;

  const stale = await listStalePollShipments(olderThan, limit);
  const provider = getShippingProvider();

  let advanced = 0;
  let checked = 0;
  let failed = 0;
  for (const s of stale) {
    checked += 1;
    try {
      const tr = await provider.track(s.awbCode);
      const mapped = mapShiprocketStatus(tr.statusCode, tr.statusLabel);
      if (mapped === null) continue;
      const last = tr.scans[tr.scans.length - 1];
      const { advanced: didAdvance } = await applyTrackingStatus(s.id, {
        toStatus: mapped as ShipmentStatus,
        source: 'poll',
        activity: last?.activity ?? tr.statusLabel ?? null,
        location: last?.location ?? null,
        occurredAt: last?.occurredAtIso ? new Date(last.occurredAtIso) : null,
      });
      if (didAdvance) advanced += 1;
    } catch (cause) {
      failed += 1;
      console.error('tracking.poll_failed', {
        shipment_id: s.id,
        cause: cause instanceof Error ? cause.message : 'unknown',
      });
    }
  }

  return jsonOk({ checked, advanced, failed }, { cacheControl: NO_STORE });
}
