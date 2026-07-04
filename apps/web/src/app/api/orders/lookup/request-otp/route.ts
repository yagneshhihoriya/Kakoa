/**
 * POST /api/orders/lookup/request-otp — public · Class C (order-tracking.md
 * §5.1, §6).
 *
 * The module's defining property is NO ENUMERATION: the response is byte-
 * identical whether or not the `(order_number, contact_phone)` pair matches an
 * order, behind a constant-time floor so DB-hit vs no-hit timing never leaks.
 *
 *   validate + normalize (400) → Class C rate check (429) → look up orders by
 *   (order_number, contact_phone). MATCH ⇒ create an `order_lookup` challenge
 *   (context {order_number}) + send SMS; NO MATCH ⇒ do nothing. BOTH paths ⇒
 *   settle to a constant-time floor, then 200 { sent: true, resendAfterSec }.
 *
 * A provider hard-fail on a REAL match ⇒ 502 (the challenge row is kept). The
 * 502 itself is only reachable on a real match, so timing-wise it sits behind
 * the same floor as the success path.
 *
 * NEVER logs the raw code / phone — only `sha256(destination)` (§6).
 */
import { lookupRequestSchema } from '@kakoa/core';
import { db, orders } from '@kakoa/db';
import { getSmsProvider } from '@kakoa/integrations';
import { and, eq } from 'drizzle-orm';

import { jsonErr, jsonOk, NO_STORE, toFieldErrors } from '@/lib/api/http';
import { createChallenge, hashDestination } from '@/lib/auth/otp';
import {
  checkOtpRequestRateLimit,
  type RateLimitResult,
} from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/auth/request-context';

export const dynamic = 'force-dynamic';

const RESEND_AFTER_SEC = 60;

/** Constant-time floor (~250ms) so a DB hit and a miss are indistinguishable. */
const RESPONSE_FLOOR_MS = 250;

const VALIDATION_MESSAGE = 'Enter a valid order number and mobile number.';
const UPSTREAM_MESSAGE = "We couldn't send the code. Try again in a minute.";
const INTERNAL_MESSAGE = 'Something went wrong on our side.';

/** Attach Class C headers to any response (§6 / Contract §2.1). */
function withRateHeaders(res: Response, rl: RateLimitResult): Response {
  res.headers.set('X-RateLimit-Limit', String(rl.limit));
  res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  res.headers.set('X-RateLimit-Reset', String(rl.reset));
  if (!rl.ok) res.headers.set('Retry-After', String(rl.retryAfterSec));
  return res;
}

/** Settle the response no sooner than `RESPONSE_FLOOR_MS` after `startedAt`. */
async function settleFloor(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < RESPONSE_FLOOR_MS) {
    await new Promise((resolve) => setTimeout(resolve, RESPONSE_FLOOR_MS - elapsed));
  }
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = Date.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE);
  }

  const parsed = lookupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE, {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    });
  }
  // `phone` is already normalized to E.164 by the schema transform.
  const { orderNumber, phone } = parsed.data;
  const ip = clientIp(req);
  const destinationHash = hashDestination(phone);

  try {
    // Class C: per-destination (1/60s, 3/10min, 10/day) + per-IP (20/hr),
    // counted from `otp_challenges` rows on the NORMALIZED phone.
    const rl = await checkOtpRequestRateLimit({ destination: phone, ip });
    if (!rl.ok) {
      await settleFloor(startedAt);
      return withRateHeaders(
        jsonErr('RATE_LIMITED', 'Too many requests — please try again shortly.'),
        rl,
      );
    }

    // Look up the pair. No result ⇒ silently do nothing (no enumeration).
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.orderNumber, orderNumber), eq(orders.contactPhone, phone)),
      )
      .limit(1);

    if (order) {
      // Real match: mint the challenge (counts toward limits even if delivery
      // fails) then send. A send failure is the only 502 — reachable only here.
      const { code } = await createChallenge({
        channel: 'sms',
        destination: phone,
        purpose: 'order_lookup',
        context: { order_number: orderNumber },
        ip,
      });
      try {
        const result = await getSmsProvider().sendOtp({
          phoneE164: phone,
          code,
          purpose: 'order_lookup',
        });
        console.info('order.lookup_otp_sent', {
          destination_hash: destinationHash,
          provider_message_id: result.providerMessageId,
        });
      } catch (cause) {
        console.error('order.lookup_otp_send_failed', {
          destination_hash: destinationHash,
          cause: cause instanceof Error ? cause.message : 'unknown',
        });
        await settleFloor(startedAt);
        return withRateHeaders(jsonErr('UPSTREAM_ERROR', UPSTREAM_MESSAGE), rl);
      }
    } else {
      console.info('order.lookup_no_match', { destination_hash: destinationHash });
    }

    // Constant-time floor for BOTH the match and no-match paths (§6).
    await settleFloor(startedAt);
    return withRateHeaders(
      jsonOk(
        { sent: true, resendAfterSec: RESEND_AFTER_SEC },
        { cacheControl: NO_STORE },
      ),
      rl,
    );
  } catch (cause) {
    console.error('order.lookup_request_internal', {
      destination_hash: destinationHash,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
