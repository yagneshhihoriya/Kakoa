/**
 * Idempotent payment confirmation — checkout.md §5.4, §8, Contract §1.27.
 *
 * `confirmPayment` is the ONE convergence point for `pending_payment → confirmed`.
 * Both the fast path (`/checkout/verify`, Razorpay JS success handler) and the
 * source of truth (`payment.captured` webhook + stuck-payment sweep) call it, so
 * whichever arrives first wins and the rest are no-ops. Every call runs in a
 * single transaction with a `SELECT … FOR UPDATE` on the order:
 *
 *   1. Load the order via `payments.provider_order_id` FOR UPDATE.
 *   2. Already `confirmed` ⇒ return `{ duplicate: true }` (idempotent).
 *   3. `assertTransition(pending_payment → confirmed)` — anything else is a
 *      state-machine violation (already cancelled/failed) → thrown.
 *   4. UPDATE orders `confirmed` + `confirmed_at`; UPDATE payments `captured` +
 *      `provider_payment_id` + `signature_verified`; INSERT status-history
 *      (`actor_type='system'`).
 *
 * Amount/currency assertion (verify also checks this) lives at the call site so
 * a mismatch can hold-and-alert without confirming — this function trusts that
 * the caller verified the signature and amount.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import { assertTransition } from '@kakoa/core';
import { db, orders, orderStatusHistory, payments } from '@kakoa/db';
import { and, eq, sql } from 'drizzle-orm';

import { sendOrderConfirmation } from '@/lib/email/send';

export interface ConfirmPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
}

export interface ConfirmPaymentResult {
  orderId: string;
  orderNumber: string;
  status: 'confirmed';
  /** True when the order was ALREADY confirmed — this call was a no-op. */
  duplicate: boolean;
}

/** Thrown when no order is found for a provider order id (verify → 404). */
export class OrderNotFoundError extends Error {
  override readonly name = 'OrderNotFoundError';
  readonly code = 'NOT_FOUND' as const;
  constructor(readonly providerOrderId: string) {
    super(`No order for provider order ${providerOrderId}`);
  }
}

/**
 * Confirm a captured payment idempotently. Returns the confirmed order (with a
 * `duplicate` flag); throws `OrderNotFoundError` for an unknown provider order,
 * or `IllegalTransitionError` when the order is not in `pending_payment` (and
 * not already `confirmed`) — e.g. a webhook for a cancelled order.
 */
export async function confirmPayment(
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentResult> {
  const result = await db.transaction(async (tx) => {
    // Lock the payment + its order together. Razorpay order ids are unique per
    // provider (partial UNIQUE index), so this resolves at most one row.
    const [row] = await tx
      .select({
        paymentId: payments.id,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        orderStatus: orders.status,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(eq(payments.providerOrderId, input.providerOrderId))
      .for('update')
      .limit(1);

    if (!row) throw new OrderNotFoundError(input.providerOrderId);

    // Already confirmed ⇒ idempotent no-op (webhook + verify converge here).
    if (row.orderStatus === 'confirmed') {
      return {
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        status: 'confirmed' as const,
        duplicate: true,
      };
    }

    // Any state other than pending_payment → confirmed is illegal (throws).
    assertTransition(row.orderStatus, 'confirmed');

    await tx
      .update(orders)
      .set({ status: 'confirmed', confirmedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(orders.id, row.orderId));

    await tx
      .update(payments)
      .set({
        status: 'captured',
        providerPaymentId: input.providerPaymentId,
        signatureVerified: true,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(payments.id, row.paymentId),
          eq(payments.providerOrderId, input.providerOrderId),
        ),
      );

    await tx.insert(orderStatusHistory).values({
      orderId: row.orderId,
      fromStatus: 'pending_payment',
      toStatus: 'confirmed',
      actorType: 'system',
    });

    return {
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      status: 'confirmed' as const,
      duplicate: false,
    };
  });

  // Best-effort "Payment received" email, AFTER the commit and OUTSIDE the tx.
  // Only on the transition (not a duplicate) — and the `order-confirm-<id>`
  // idempotency key dedups against the send fired at prepaid placement, so the
  // customer is mailed at most once whichever confirm trigger arrives first.
  if (!result.duplicate) {
    void sendOrderConfirmation(result.orderId).catch(() => {});
  }

  return result;
}
