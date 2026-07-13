/**
 * POST /api/webhooks/razorpay — Razorpay webhook · persist-then-ack (checkout.md §3, payments.md).
 *
 * NO session middleware; `Cache-Control: no-store`. The truth-of-record for
 * payment confirmation (verify is only the fast path). Flow:
 *
 *   1. Read the RAW body via `req.text()` BEFORE any parse (HMAC is over bytes).
 *   2. If `RAZORPAY_WEBHOOK_SECRET` is set, verify `x-razorpay-signature` =
 *      HMAC-SHA256(rawBody) in constant time — mismatch ⇒ 401 SIGNATURE_INVALID.
 *      If unset (mock/local), log `webhook.mock_accept` and continue.
 *   3. `event_id = x-razorpay-event-id`; INSERT `webhook_events`
 *      (provider='razorpay') ON CONFLICT (provider,event_id) DO NOTHING —
 *      a conflict ⇒ 200 `{ duplicate: true }` (already ledgered, replay).
 *   4. ACK 200 immediately (<1s).
 *   5. AFTER the ack decision, best-effort: `payment.captured` ⇒ `confirmPayment`
 *      idempotently. A processing failure never un-acks (Razorpay would retry;
 *      the sweep also converges) — we mark the ledger row `failed` and still 200.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { parseServerEnv } from '@kakoa/config';
import { db, webhookEvents } from '@kakoa/db';
import { and, eq, ne, sql } from 'drizzle-orm';

import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { confirmPayment } from '@/lib/checkout/confirm';

export const dynamic = 'force-dynamic';

const SIGNATURE_MESSAGE = 'Invalid webhook signature.';

/** Constant-time hex compare (unequal lengths ⇒ false without throwing). */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Razorpay payment.captured payload → the ids `confirmPayment` needs. */
interface RazorpayEvent {
  event?: string;
  payload?: {
    payment?: {
      entity?: { id?: string; order_id?: string };
    };
  };
}

export async function POST(req: Request): Promise<Response> {
  // 1. RAW body first — the HMAC is over the exact bytes Razorpay signed.
  const rawBody = await req.text();

  const env = parseServerEnv();
  const secret = env.RAZORPAY_WEBHOOK_SECRET;

  // 2. Signature (only when a secret is configured).
  if (secret !== undefined) {
    const provided = req.headers.get('x-razorpay-signature') ?? '';
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!safeEqualHex(expected, provided)) {
      console.info('webhook.signature_invalid', { provider: 'razorpay' });
      return jsonErr('SIGNATURE_INVALID', SIGNATURE_MESSAGE);
    }
  } else {
    console.info('webhook.mock_accept', { provider: 'razorpay' });
  }

  // Parse AFTER the signature gate.
  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    // Malformed body that nonetheless passed HMAC (or mock) — ack so Razorpay
    // stops retrying an un-parseable event; nothing to process.
    return jsonOk({ received: true }, { cacheControl: NO_STORE });
  }

  const eventType = event.event ?? 'unknown';
  // Razorpay sends the event id in this header; fall back to a content hash so
  // the dedupe key is never empty.
  const eventId =
    req.headers.get('x-razorpay-event-id') ??
    createHmac('sha256', 'razorpay_event')
      .update(rawBody)
      .digest('hex');

  // 3. Persist — the dedupe gate. ON CONFLICT DO NOTHING returns zero rows on a
  //    replay of the same (provider, event_id).
  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: 'razorpay',
      eventId,
      eventType,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing({
      target: [webhookEvents.provider, webhookEvents.eventId],
    })
    .returning({ id: webhookEvents.id });

  let ledgerId: string;
  if (inserted.length === 0) {
    // Duplicate delivery. If the FIRST attempt already succeeded ('processed'),
    // ack and stop. But if it FAILED or is still 'received', a PAID order may be
    // stranded pending_payment — so reprocess (confirmPayment is idempotent) and
    // let this retried webhook converge it. Without this, one transient DB blip
    // during capture confirmation permanently strands a paid order.
    const [existing] = await db
      .select({ id: webhookEvents.id, status: webhookEvents.status })
      .from(webhookEvents)
      .where(
        and(eq(webhookEvents.provider, 'razorpay'), eq(webhookEvents.eventId, eventId)),
      )
      .limit(1);
    if (!existing || existing.status === 'processed') {
      return jsonOk({ duplicate: true }, { cacheControl: NO_STORE });
    }
    ledgerId = existing.id;
    console.info('webhook.reprocess_unprocessed', {
      provider: 'razorpay',
      event_id: eventId,
      prior_status: existing.status,
    });
  } else {
    ledgerId = inserted[0]!.id;
  }

  // 4 + 5. Process best-effort (still within this request, but a failure here
  // never turns the ack into a non-200 — Razorpay retries + the sweep converge).
  if (eventType === 'payment.captured') {
    const entity = event.payload?.payment?.entity;
    const providerOrderId = entity?.order_id;
    const providerPaymentId = entity?.id;

    if (providerOrderId && providerPaymentId) {
      try {
        const result = await confirmPayment({ providerOrderId, providerPaymentId });
        await markProcessed(ledgerId);
        console.info('webhook.processed', {
          provider: 'razorpay',
          event_type: eventType,
          order_number: result.orderNumber,
          duplicate: result.duplicate,
        });
      } catch (cause) {
        await markFailed(
          ledgerId,
          cause instanceof Error ? cause.message : 'unknown',
        );
        console.error('webhook.process_failed', {
          provider: 'razorpay',
          event_type: eventType,
          cause: cause instanceof Error ? cause.message : 'unknown',
        });
        // Still ack — do not signal Razorpay to hammer us; the sweep reconciles.
      }
    } else {
      await markProcessed(ledgerId); // nothing actionable in the payload
    }
  } else {
    await markProcessed(ledgerId); // event we don't act on (still ledgered)
  }

  return jsonOk({ received: true }, { cacheControl: NO_STORE });
}

/** Mark a ledger row processed (advisory only — never blocks the ack). */
async function markProcessed(id: string): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ status: 'processed', processedAt: sql`now()` })
    // `!= processed` (not `= received`) so a REPROCESSED 'failed' row also promotes.
    .where(and(eq(webhookEvents.id, id), ne(webhookEvents.status, 'processed')));
}

/** Mark a ledger row failed with the cause (the sweep will reconcile). */
async function markFailed(id: string, error: string): Promise<void> {
  await db
    .update(webhookEvents)
    .set({
      status: 'failed',
      error,
      attempts: sql`${webhookEvents.attempts} + 1`,
    })
    .where(eq(webhookEvents.id, id));
}
