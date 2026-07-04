/**
 * POST /api/auth/otp/request — public · Class C (auth-otp.md §5.1).
 *
 * Validate + normalize (invalid ⇒ 400 BEFORE any rate count) → Class C rate
 * check (429 + Retry-After) → create challenge → send via SmsProvider (hard
 * fail ⇒ 502, challenge row kept) → 200 { challengeId, resendAfterSec: 60 }.
 *
 * The 200 body is byte-identical whether or not a `customers` row exists for
 * the destination (no enumeration, §6). NEVER logs the raw code/phone — only
 * `sha256(destination)` (§6).
 */
import {
  otpRequestInputSchema,
  normalizePhoneE164,
} from '@kakoa/core';
import { getSmsProvider } from '@kakoa/integrations';

import { jsonErr, jsonOk, NO_STORE, toFieldErrors } from '@/lib/api/http';
import { clientIp } from '@/lib/auth/request-context';
import { createChallenge, hashDestination } from '@/lib/auth/otp';
import { checkOtpRequestRateLimit, type RateLimitResult } from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

const RESEND_AFTER_SEC = 60;

const INVALID_PHONE_MESSAGE = 'Enter a valid 10-digit Indian mobile number.';
const INVALID_EMAIL_MESSAGE = 'Enter a valid email address.';
const UPSTREAM_MESSAGE = "Couldn't send the code — try again shortly.";
const INTERNAL_MESSAGE = 'Something went wrong on our side.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Attach Class C headers to any response (§5 / Contract §2.1). */
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

  const parsed = otpRequestInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('VALIDATION_ERROR', INVALID_PHONE_MESSAGE, {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    });
  }
  const { channel, destination, purpose } = parsed.data;

  // Channel-specific normalization → authoritative format (§1.1). Invalid ⇒
  // 400 with the channel-appropriate message, BEFORE any rate counting (§2 step
  // 2: an invalid request is never logged against rate limits).
  let normalized: string;
  if (channel === 'sms') {
    const e164 = normalizePhoneE164(destination);
    if (e164 === null) {
      return jsonErr('VALIDATION_ERROR', INVALID_PHONE_MESSAGE, {
        fieldErrors: { destination: [INVALID_PHONE_MESSAGE] },
      });
    }
    normalized = e164;
  } else {
    const email = destination.trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return jsonErr('VALIDATION_ERROR', INVALID_EMAIL_MESSAGE, {
        fieldErrors: { destination: [INVALID_EMAIL_MESSAGE] },
      });
    }
    normalized = email;
  }

  const ip = clientIp(req);
  const destinationHash = hashDestination(normalized);

  try {
    // Rate check on the NORMALIZED destination — all spacing/prefix variants
    // share one bucket (§1.1).
    const rl = await checkOtpRequestRateLimit({ destination: normalized, ip });
    if (!rl.ok) {
      console.info('auth.otp_rate_limited', {
        destination_hash: destinationHash,
        retry_after_sec: rl.retryAfterSec,
      });
      return withRateHeaders(
        jsonErr('RATE_LIMITED', 'Too many requests — please try again shortly.'),
        rl,
      );
    }

    // Create the challenge FIRST (it counts toward limits even if delivery
    // fails — cost was attempted, §2 step 4).
    const { challengeId, code } = await createChallenge({
      channel,
      destination: normalized,
      purpose,
      ip,
    });

    try {
      const result = await getSmsProvider().sendOtp({
        phoneE164: normalized,
        code,
        purpose,
      });
      console.info('auth.otp_requested', {
        destination_hash: destinationHash,
        channel,
        provider_message_id: result.providerMessageId,
      });
    } catch (cause) {
      // Provider hard-fail: challenge row is intentionally kept. 502 UPSTREAM.
      console.error('auth.otp_send_failed', {
        destination_hash: destinationHash,
        channel,
        cause: cause instanceof Error ? cause.message : 'unknown',
      });
      return withRateHeaders(jsonErr('UPSTREAM_ERROR', UPSTREAM_MESSAGE), rl);
    }

    return withRateHeaders(
      jsonOk(
        { challengeId, resendAfterSec: RESEND_AFTER_SEC },
        { cacheControl: NO_STORE },
      ),
      rl,
    );
  } catch (cause) {
    console.error('auth.otp_request_internal', {
      destination_hash: destinationHash,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
