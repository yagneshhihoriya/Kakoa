/**
 * POST /api/checkout/orders — public (cart cookie) | customer · Class D.
 * PLACE ORDER (checkout.md §5.3, Contract §2.5).
 *
 * Parse `placeOrderInputSchema` (400 VALIDATION_ERROR on any drift) → `placeOrder`
 * (the money-truthful placement transaction) → 201 with the discriminated result
 * body. Every expected failure is a typed error carrying an `ErrorCode`; this
 * handler maps that code straight to the registry HTTP status:
 *
 *   401 OTP_INCORRECT · 410 OTP_EXPIRED / CART_EXPIRED
 *   409 OUT_OF_STOCK / PRICE_CHANGED / DUPLICATE_REQUEST
 *   422 COUPON_* / PINCODE_UNSERVICEABLE / COD_UNAVAILABLE
 *   502 UPSTREAM_ERROR
 *
 * Both the quote engine (Backend A `computeQuote`, thrown mid-placement) and the
 * placement itself raise `{ code: ErrorCode, message, details? }`-shaped errors,
 * so one mapper covers both. An idempotent replay returns the ORIGINAL 201 body
 * (with `meta.duplicate`), never a 409 — DUPLICATE_REQUEST is reserved for a
 * key collision on a DIFFERENT payload, which the UNIQUE constraint surfaces.
 *
 * Rate limiting (Class D, 10/min/session) is middleware-owned.
 */
import {
  ERROR_CODES,
  placeOrderInputSchema,
  type ErrorCode,
} from '@kakoa/core';

import { jsonErr, jsonOk, NO_STORE, toFieldErrors } from '@/lib/api/http';
import { clientIp, userAgent } from '@/lib/auth/request-context';
import { placeOrder } from '@/lib/checkout/place';

export const dynamic = 'force-dynamic';

const VALIDATION_MESSAGE = 'Please check your details and try again.';
const INTERNAL_MESSAGE = 'Something went wrong placing your order. Please try again.';

/** A typed, expected failure from the quote engine or placement transaction. */
interface CodedError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/** Narrow an unknown throwable to a `{ code: ErrorCode, ... }` shape. */
function asCodedError(cause: unknown): CodedError | null {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    typeof (cause as { code: unknown }).code === 'string' &&
    (ERROR_CODES as readonly string[]).includes((cause as { code: string }).code)
  ) {
    const e = cause as { code: ErrorCode; message?: unknown; details?: unknown };
    return {
      code: e.code,
      message: typeof e.message === 'string' ? e.message : INTERNAL_MESSAGE,
      details: e.details,
    };
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE);
  }

  const parsed = placeOrderInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE, {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    });
  }

  try {
    const result = await placeOrder(parsed.data, {
      ip: clientIp(req),
      ua: userAgent(req),
    });

    const { duplicate, ...payload } = result;
    return jsonOk(payload, {
      cacheControl: NO_STORE,
      status: 201,
      meta: { duplicate },
    });
  } catch (cause) {
    const coded = asCodedError(cause);
    if (coded !== null) {
      return jsonErr(coded.code, coded.message, {
        ...(coded.details !== undefined ? { details: coded.details } : {}),
      });
    }
    console.error('checkout.place_internal', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
