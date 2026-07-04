/**
 * POST /api/checkout/cod-otp/request — public · Class C (checkout.md §1.3, cod.md).
 *
 * Sends a COD phone-verification OTP. Reuses the auth OTP infrastructure with
 * `purpose='cod_verification'` — same generation, hashing, rate limits, and
 * atomic-consume path as customer login, differing only in purpose. The 200
 * body is identical whether or not a customer exists (no enumeration). NEVER
 * logs the raw code/phone.
 */
import { normalizePhoneE164 } from '@kakoa/core';
import { getSmsProvider } from '@kakoa/integrations';

import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { clientIp } from '@/lib/auth/request-context';
import { createChallenge } from '@/lib/auth/otp';
import {
  checkOtpRequestRateLimit,
  type RateLimitResult,
} from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

const RESEND_AFTER_SEC = 60;
const INVALID_PHONE_MESSAGE =
  'Enter a valid 10-digit Indian mobile number starting with 6–9.';
const RATE_LIMITED_MESSAGE = 'Too many requests — please try again shortly.';
const UPSTREAM_MESSAGE = "Couldn't send the code — try again shortly.";
const INTERNAL_MESSAGE = 'Something went wrong on our side.';

/** Extract a bounded `phone` string from an untyped JSON body. */
function readPhone(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const phone = (body as { phone?: unknown }).phone;
  return typeof phone === 'string' && phone.length <= 20 ? phone : null;
}

/** Attach Class C rate headers (Contract §2.1). */
function withRateHeaders(res: Response, rl: RateLimitResult): Response {
  res.headers.set('X-RateLimit-Limit', String(rl.limit));
  res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  res.headers.set('X-RateLimit-Reset', String(rl.reset));
  if (!rl.ok) res.headers.set('Retry-After', String(rl.retryAfterSec));
  return res;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', INVALID_PHONE_MESSAGE);
  }

  const rawPhone = readPhone(body);
  if (rawPhone === null) {
    return jsonErr('VALIDATION_ERROR', INVALID_PHONE_MESSAGE);
  }

  // Normalize BEFORE any rate counting so spacing variants share one bucket.
  const destination = normalizePhoneE164(rawPhone);
  if (destination === null) {
    return jsonErr('VALIDATION_ERROR', INVALID_PHONE_MESSAGE);
  }

  const ip = clientIp(req);
  const rl = await checkOtpRequestRateLimit({ destination, ip });
  if (!rl.ok) {
    return withRateHeaders(
      jsonErr('RATE_LIMITED', RATE_LIMITED_MESSAGE),
      rl,
    );
  }

  try {
    const { challengeId, code } = await createChallenge({
      channel: 'sms',
      destination,
      purpose: 'cod_verification',
      ip,
    });
    const provider = getSmsProvider();
    await provider.sendOtp({ phoneE164: destination, code, purpose: 'cod_verification' });
    return withRateHeaders(
      jsonOk({ challengeId, resendAfterSec: RESEND_AFTER_SEC }, { cacheControl: NO_STORE }),
      rl,
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'unknown';
    // SMS provider hard-failed — challenge row is kept (counts toward limits).
    if (/sms|msg91|provider|timeout|upstream/i.test(message)) {
      return withRateHeaders(jsonErr('UPSTREAM_ERROR', UPSTREAM_MESSAGE), rl);
    }
    console.error('checkout.cod_otp_internal', { cause: message });
    return withRateHeaders(jsonErr('INTERNAL', INTERNAL_MESSAGE), rl);
  }
}
