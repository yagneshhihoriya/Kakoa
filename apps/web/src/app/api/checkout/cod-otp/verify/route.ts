/**
 * POST /api/checkout/cod-otp/verify — public (checkout.md §1.3, cod.md).
 *
 * Step-3 pre-check of the COD phone OTP so the customer gets immediate
 * feedback before reaching Review. It calls the shared `verifyCode`, which is
 * NON-consuming: it validates the code (incrementing `attempts` on a wrong
 * guess to enforce the 5-attempt cap) and returns `ok` WITHOUT marking the
 * challenge consumed. The authoritative consume happens later inside the
 * placement transaction (`place.ts`), so the same code can be pre-checked here
 * and then consumed exactly once at order placement.
 *
 * NEVER logs the raw code.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { verifyCode } from '@/lib/auth/otp';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^\d{6}$/;

const INVALID_MESSAGE = 'Enter the 6-digit code we sent you.';
const EXPIRED_MESSAGE = 'This code has expired. Request a new one.';
const INTERNAL_MESSAGE = 'Something went wrong on our side.';

/** Read `{ challengeId, code }` from an untyped JSON body. */
function readBody(body: unknown): { challengeId: string; code: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { challengeId, code } = body as {
    challengeId?: unknown;
    code?: unknown;
  };
  if (typeof challengeId !== 'string' || !UUID_RE.test(challengeId)) return null;
  const trimmed = typeof code === 'string' ? code.trim() : '';
  if (!CODE_RE.test(trimmed)) return null;
  return { challengeId, code: trimmed };
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', INVALID_MESSAGE);
  }

  const parsed = readBody(body);
  if (parsed === null) {
    return jsonErr('VALIDATION_ERROR', INVALID_MESSAGE);
  }

  try {
    const outcome = await verifyCode(parsed);
    if (outcome.status === 'ok') {
      return jsonOk({ verified: true }, { cacheControl: NO_STORE });
    }
    if (outcome.status === 'incorrect') {
      return jsonErr(
        'OTP_INCORRECT',
        `Incorrect code — ${outcome.attemptsLeft} ${
          outcome.attemptsLeft === 1 ? 'attempt' : 'attempts'
        } left.`,
        { details: { attemptsLeft: outcome.attemptsLeft } },
      );
    }
    // 'expired' — the umbrella for expired / consumed / exhausted / unknown.
    return jsonErr('OTP_EXPIRED', EXPIRED_MESSAGE);
  } catch (cause) {
    console.error('checkout.cod_otp_verify_internal', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
