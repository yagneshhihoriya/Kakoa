/**
 * POST /api/checkout/quote — public (cart cookie) · Class D (checkout.md §5.2).
 *
 * Recomputes the whole quote from live prices, stock, coupon state, and
 * `store_settings` — never cached, never trusts a client-sent figure. Maps the
 * typed `QuoteError.code` straight onto the registry HTTP status via `jsonErr`.
 */
import { quoteRequestSchema } from '@kakoa/core';

import { jsonErr, jsonOk, NO_STORE, toFieldErrors } from '@/lib/api/http';
import { computeQuote, QuoteError } from '@/lib/checkout/quote';

export const dynamic = 'force-dynamic';

const VALIDATION_MESSAGE = 'Please check your input and try again.';
const INTERNAL_MESSAGE = 'Something went wrong on our side.';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE);
  }

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE, {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    });
  }

  try {
    const quote = await computeQuote(parsed.data);
    return jsonOk({ quote }, { cacheControl: NO_STORE });
  } catch (cause) {
    if (cause instanceof QuoteError) {
      return jsonErr(cause.code, cause.message, {
        ...(cause.details !== undefined ? { details: cause.details } : {}),
      });
    }
    console.error('checkout.quote_internal', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
