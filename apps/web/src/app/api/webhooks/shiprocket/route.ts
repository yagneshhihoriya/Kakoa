/**
 * POST /api/webhooks/shiprocket — courier tracking auto-sync (HANDOFF-Shiprocket §6).
 *
 * Auth is a STATIC `x-api-key` header (no HMAC) compared constant-time to
 * `SHIPROCKET_WEBHOOK_TOKEN`. The handler is persist-then-ack, dedupe + forward-
 * only, and ALWAYS returns 200 on an accepted request (a non-200 makes Shiprocket
 * retry/flood). It maps the SR status code → our shipment status and applies it
 * via the shared `applyTrackingStatus` (records the scan, advances forward-only,
 * mirrors the order, notifies the customer).
 *
 * NOTE: this route is machine-facing — it is NOT behind the admin session guard
 * and returns terse codes, not copy.
 */
import { timingSafeEqual } from 'node:crypto';
import { parseServerEnv } from '@kakoa/config';
import { mapShiprocketStatus } from '@kakoa/integrations';
import type { ShipmentStatus } from '@kakoa/core';
import { applyTrackingStatus, findShipmentByAwb } from '@/lib/admin/shipping';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

function parseTimestamp(raw: unknown): Date | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request): Promise<Response> {
  // 1. Verify the shared secret (constant-time). Mismatch/absent → 401, nothing persisted.
  const secret = parseServerEnv().SHIPROCKET_WEBHOOK_TOKEN;
  const provided = req.headers.get('x-api-key') ?? '';
  if (secret === undefined || !safeEqual(provided, secret)) {
    return Response.json({ error: 'SIGNATURE_INVALID' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'BAD_BODY' }, { status: 200 });
  }
  const b = body as {
    awb?: unknown;
    current_status?: unknown;
    current_status_id?: unknown;
    shipment_status_id?: unknown;
    current_timestamp?: unknown;
    location?: unknown;
    scans?: unknown;
  };

  const awb = typeof b.awb === 'string' ? b.awb.trim() : '';
  if (awb === '') return Response.json({ ok: true, skipped: 'no_awb' }, { status: 200 });

  const shipment = await findShipmentByAwb(awb);
  if (shipment === null) {
    console.warn('tracking.unknown_awb', { awb });
    return Response.json({ ok: true, skipped: 'unknown_awb' }, { status: 200 });
  }

  // Prefer the lifecycle status id; fall back to the latest-scan id, then label.
  const code =
    typeof b.shipment_status_id === 'number' || typeof b.shipment_status_id === 'string'
      ? b.shipment_status_id
      : (b.current_status_id as number | string | undefined);
  const label = typeof b.current_status === 'string' ? b.current_status : null;
  const mapped = mapShiprocketStatus(code ?? null, label);
  if (mapped === null) {
    console.warn('tracking.unknown_sr_code', { awb, code, label });
    return Response.json({ ok: true, skipped: 'unmapped_code' }, { status: 200 });
  }

  const occurredAt = parseTimestamp(b.current_timestamp);
  try {
    const { advanced } = await applyTrackingStatus(shipment.id, {
      toStatus: mapped as ShipmentStatus,
      source: 'webhook',
      activity: label,
      location: typeof b.location === 'string' ? b.location : null,
      occurredAt,
    });
    return Response.json({ ok: true, advanced }, { status: 200 });
  } catch (cause) {
    // Never make Shiprocket retry on our internal error — log + ack.
    console.error('tracking.webhook_apply_failed', {
      awb,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return Response.json({ ok: true, error: 'apply_failed' }, { status: 200 });
  }
}
