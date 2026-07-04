/**
 * POST /api/checkout/orders/[orderId]/retry-payment — guest-token | customer-owner · Class D
 * (checkout.md §5.5).
 *
 * Resurrect a stalled prepaid order within the 24h window. Ownership is enforced
 * by the `access_token` query param (guest) OR the owning customer session; a
 * forged id / wrong token gets 404 (no existence oracle).
 *
 *   - order not prepaid, or already paid (confirmed+) ⇒ 409 CONFLICT
 *   - order cancelled / window elapsed ⇒ 410 GONE
 *   - `payment_failed` ⇒ transition back to `pending_payment` (FOR UPDATE +
 *     history row); `pending_payment` stays as-is (a retry of an unpaid order)
 *   - create a FRESH Razorpay order (new receipt), INSERT a new `payments` row
 *     (`created`), return the `{ razorpay }` handoff (same shape as §5.3 prepaid)
 *
 * Razorpay create failure ⇒ 502 UPSTREAM_ERROR; the order stays retryable.
 */
import { randomUUID } from 'node:crypto';

import { assertTransition, IllegalTransitionError } from '@kakoa/core';
import { db, orders, orderStatusHistory, payments } from '@kakoa/db';
import { getPaymentProvider } from '@kakoa/integrations';
import { and, eq, sql } from 'drizzle-orm';

import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { getCurrentCustomer } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const NOT_FOUND_MESSAGE = 'We could not find this order.';
const UPSTREAM_MESSAGE = 'Payment setup failed — your card was not charged. Please try again.';
const INTERNAL_MESSAGE = 'Something went wrong. Please try again.';

/** RFC-4122 uuid shape for the `orderId` path segment + `token` query. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) {
    return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
  }

  const token = new URL(req.url).searchParams.get('token');
  const customer = await getCurrentCustomer();

  try {
    // Load the order, scoped by ownership: the access_token OR the owning
    // customer. A miss on both is indistinguishable from a missing order (404).
    const [order] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentMode: orders.paymentMode,
        totalPaise: orders.totalPaise,
        contactPhone: orders.contactPhone,
        contactEmail: orders.contactEmail,
        accessToken: orders.accessToken,
        customerId: orders.customerId,
        placedAt: orders.placedAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    const owns =
      order !== undefined &&
      ((token !== null && UUID_RE.test(token) && order.accessToken === token) ||
        (customer !== null && order.customerId === customer.id));
    if (!order || !owns) {
      return jsonErr('NOT_FOUND', NOT_FOUND_MESSAGE);
    }

    if (order.paymentMode !== 'prepaid') {
      return jsonErr('CONFLICT', 'This order does not support online payment.');
    }

    // Terminal / non-retryable states.
    if (order.status === 'cancelled') {
      return jsonErr('GONE', 'This order has been cancelled.');
    }
    if (order.status !== 'pending_payment' && order.status !== 'payment_failed') {
      // confirmed / packed / shipped / … — already paid.
      return jsonErr('CONFLICT', 'This order has already been paid.');
    }

    // 24h retry window (checkout.md §5.5).
    const placedMs = new Date(order.placedAt).getTime();
    if (Date.now() - placedMs > 24 * 60 * 60 * 1000) {
      return jsonErr('GONE', 'The payment window for this order has closed.');
    }

    // Fresh gateway order (new receipt keyed to a new attempt).
    const receipt = randomUUID();
    let providerOrder: {
      providerOrderId: string;
      amountPaise: number;
      currency: string;
      keyId: string;
    };
    try {
      providerOrder = await getPaymentProvider().createOrder({
        orderNumber: order.orderNumber,
        amountPaise: order.totalPaise,
        receipt,
      });
    } catch (cause) {
      console.error('checkout.retry_razorpay_failed', {
        order_number: order.orderNumber,
        cause: cause instanceof Error ? cause.message : 'unknown',
      });
      return jsonErr('UPSTREAM_ERROR', UPSTREAM_MESSAGE);
    }

    // Transition payment_failed → pending_payment + fresh payment row, one tx.
    await db.transaction(async (tx) => {
      // Retire any still-open ('created'/'failed') payment rows for this order
      // before opening a new attempt, so reconciliation/refund never sees more
      // than one non-terminal 'created' row per order. Idempotent: a re-run
      // with no open rows matches nothing.
      await tx
        .update(payments)
        .set({ status: 'failed', updatedAt: sql`now()` })
        .where(
          and(
            eq(payments.orderId, order.id),
            sql`${payments.status} in ('created', 'failed')`,
          ),
        );

      if (order.status === 'payment_failed') {
        assertTransition('payment_failed', 'pending_payment');
        await tx
          .update(orders)
          .set({ status: 'pending_payment', updatedAt: sql`now()` })
          .where(and(eq(orders.id, order.id), eq(orders.status, 'payment_failed')));
        await tx.insert(orderStatusHistory).values({
          orderId: order.id,
          fromStatus: 'payment_failed',
          toStatus: 'pending_payment',
          actorType: 'customer',
          actorId: customer?.id ?? null,
          note: 'retry-payment',
        });
      }

      await tx.insert(payments).values({
        orderId: order.id,
        provider: 'razorpay',
        providerOrderId: providerOrder.providerOrderId,
        status: 'created',
        amountPaise: order.totalPaise,
      });
    });

    return jsonOk(
      {
        razorpay: {
          orderId: providerOrder.providerOrderId,
          keyId: providerOrder.keyId,
          amountPaise: providerOrder.amountPaise,
          currency: 'INR' as const,
          prefill: {
            contact: order.contactPhone,
            ...(order.contactEmail !== null ? { email: order.contactEmail } : {}),
          },
        },
      },
      { cacheControl: NO_STORE },
    );
  } catch (cause) {
    if (cause instanceof IllegalTransitionError) {
      return jsonErr('CONFLICT', 'This order can no longer be retried.');
    }
    console.error('checkout.retry_internal', {
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}
