/**
 * POST /api/orders/lookup/verify — public · Class C verify (order-tracking.md
 * §5.2, §6).
 *
 *   validate (400) → find the LATEST open `order_lookup` challenge for
 *   (phone, order_number) → verifyCode. Wrong ⇒ 401 `OTP_INCORRECT`
 *   {attemptsLeft}; expired / consumed / exhausted / NO CHALLENGE (unmatched
 *   pair) ⇒ 410 `OTP_EXPIRED` (one unified message, no oracle). Success ⇒
 *   consume the challenge, resolve the order id, mint a 30-min tracking JWT,
 *   return { trackingToken, order: OrderSummary }.
 *
 * "No challenge exists" (the guest never matched a real order, or posts codes
 * directly) returns the SAME 410 an honest user with a stale code gets — no
 * response distinguishes "wrong order/phone" from "expired code" (§7 case 2).
 *
 * NEVER logs the raw code / phone / token (§6).
 */
import { lookupVerifySchema } from '@kakoa/core';
import { db, orders } from '@kakoa/db';
import { and, eq } from 'drizzle-orm';

import { jsonErr, jsonOk, NO_STORE, toFieldErrors } from '@/lib/api/http';
import {
  consumeChallenge,
  findOpenChallengeId,
  verifyCode,
} from '@/lib/auth/otp';
import { getOrderTracking } from '@/lib/orders/tracking';
import { signTrackingToken } from '@/lib/orders/lookup-jwt';

export const dynamic = 'force-dynamic';

const VALIDATION_MESSAGE = 'Enter the 6-digit code we sent you.';
const EXPIRED_MESSAGE = 'This code has expired. Request a new one.';
const INTERNAL_MESSAGE = 'Something went wrong — request a new code.';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE);
  }

  const parsed = lookupVerifySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE, {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    });
  }
  // `phone` is normalized to E.164 by the schema transform.
  const { orderNumber, phone, code } = parsed.data;

  try {
    // Resolve the latest open challenge for this (phone, order_number). Missing
    // ⇒ the unified 410 (unmatched pair is indistinguishable from expired, §6).
    const challengeId = await findOpenChallengeId({
      destination: phone,
      purpose: 'order_lookup',
      orderNumber,
    });
    if (challengeId === null) {
      return jsonErr('OTP_EXPIRED', EXPIRED_MESSAGE);
    }

    const outcome = await verifyCode({ challengeId, code });
    if (outcome.status === 'incorrect') {
      return jsonErr(
        'OTP_INCORRECT',
        `Incorrect code. ${String(outcome.attemptsLeft)} attempts left.`,
        { details: { attemptsLeft: outcome.attemptsLeft } },
      );
    }
    if (outcome.status === 'expired') {
      return jsonErr('OTP_EXPIRED', EXPIRED_MESSAGE);
    }

    // Success — atomically consume the challenge. A lost race ⇒ same 410.
    const consumed = await consumeChallenge(challengeId, db);
    if (!consumed) {
      return jsonErr('OTP_EXPIRED', EXPIRED_MESSAGE);
    }

    // Resolve the order id for the verified (order_number, phone) pair. The
    // challenge context already binds the order_number; re-check the phone so a
    // token is only ever minted for the exact matched order.
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.orderNumber, orderNumber), eq(orders.contactPhone, phone)),
      )
      .limit(1);
    if (!order) {
      // The order vanished between request and verify — same 410 (no oracle).
      return jsonErr('OTP_EXPIRED', EXPIRED_MESSAGE);
    }

    const tracking = await getOrderTracking(order.id);
    if (tracking === null) {
      return jsonErr('OTP_EXPIRED', EXPIRED_MESSAGE);
    }

    const trackingToken = signTrackingToken(order.id);
    console.info('order.lookup_verified', { order_number: orderNumber });

    return jsonOk(
      { trackingToken, order: tracking.order },
      { cacheControl: NO_STORE },
    );
  } catch (cause) {
    console.error('order.lookup_verify_internal', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
