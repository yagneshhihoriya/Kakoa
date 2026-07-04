/**
 * POST /api/checkout/verify — public · Class D (checkout.md §5.4).
 * Razorpay Standard Checkout JS success handler — the FAST path to `confirmed`.
 *
 * Body `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }`:
 *   1. Load the payment by `provider_order_id` (404 NOT_FOUND if unknown).
 *   2. `getPaymentProvider().verifySignature(...)` — false ⇒ 401 SIGNATURE_INVALID
 *      (never throws for a bad signature — it is an attacker-reachable path).
 *   3. Assert amount + currency (the payment row was created with amount = order
 *      total; a drift holds-and-alerts rather than confirming — payments.md).
 *   4. `confirmPayment(...)` idempotently → 200 `{ orderNumber, status:'confirmed' }`.
 *      A duplicate (webhook already confirmed) is still a 200 with `meta.duplicate`.
 *
 * The `payment.captured` webhook + stuck-payment sweep are the guarantee; this
 * is only the fast path. All three converge on the shared `confirmPayment`.
 */
import { verifyPaymentInputSchema } from '@kakoa/core';
import { db, orders, payments } from '@kakoa/db';
import { getPaymentProvider } from '@kakoa/integrations';
import { eq } from 'drizzle-orm';

import { jsonErr, jsonOk, NO_STORE, toFieldErrors } from '@/lib/api/http';
import { confirmPayment, OrderNotFoundError } from '@/lib/checkout/confirm';

export const dynamic = 'force-dynamic';

const VALIDATION_MESSAGE = 'Payment confirmation failed. Please try again.';
const SIGNATURE_MESSAGE = 'We could not verify this payment.';
const NOT_FOUND_MESSAGE = 'We could not find this payment.';
const INTERNAL_MESSAGE = 'Something went wrong confirming your payment. Please try again.';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE);
  }

  const parsed = verifyPaymentInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('VALIDATION_ERROR', VALIDATION_MESSAGE, {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    });
  }
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  try {
    // Load the payment + its order total for the amount assertion.
    const [row] = await db
      .select({
        amountPaise: payments.amountPaise,
        orderTotalPaise: orders.totalPaise,
        currency: orders.currency,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(eq(payments.providerOrderId, razorpayOrderId))
      .limit(1);

    if (!row) {
      return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
    }

    // Signature check — constant-time, never throws for a mismatch.
    const valid = getPaymentProvider().verifySignature({
      providerOrderId: razorpayOrderId,
      providerPaymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    if (!valid) {
      console.info('checkout.signature_invalid', {
        provider_order_id: razorpayOrderId,
      });
      return jsonErr('SIGNATURE_INVALID', SIGNATURE_MESSAGE);
    }

    // Amount + currency must match the order (defense-in-depth: the gateway
    // order was created with amount = total, so this only fails on tampering).
    if (row.amountPaise !== row.orderTotalPaise || row.currency !== 'INR') {
      console.error('checkout.amount_mismatch', {
        provider_order_id: razorpayOrderId,
        payment_amount: row.amountPaise,
        order_total: row.orderTotalPaise,
      });
      return jsonErr('SIGNATURE_INVALID', SIGNATURE_MESSAGE);
    }

    const confirmed = await confirmPayment({
      providerOrderId: razorpayOrderId,
      providerPaymentId: razorpayPaymentId,
    });

    return jsonOk(
      { orderNumber: confirmed.orderNumber, status: confirmed.status },
      { cacheControl: NO_STORE, meta: { duplicate: confirmed.duplicate } },
    );
  } catch (cause) {
    if (cause instanceof OrderNotFoundError) {
      return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
    }
    // IllegalTransitionError (order already cancelled/failed) or any fault.
    if (
      typeof cause === 'object' &&
      cause !== null &&
      'code' in cause &&
      (cause as { code: unknown }).code === 'INVALID_TRANSITION'
    ) {
      return jsonErr(
        'CONFLICT',
        'This order can no longer be confirmed.',
      );
    }
    console.error('checkout.verify_internal', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
