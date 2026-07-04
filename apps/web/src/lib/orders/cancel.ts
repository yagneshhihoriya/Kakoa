/**
 * Customer order cancellation — order-tracking.md §5.4, §8, Contract §1.27/§1.28.
 *
 * `cancelOrder` is the shared FOR-UPDATE executor for the ONE transition this
 * module performs: `→ cancelled`, pre-dispatch. It runs the §1.28 pattern in a
 * single transaction:
 *
 *   1. `SELECT … FOR UPDATE` on the order (serializes against a racing
 *      admin `confirmed → packed`, §7 case 5).
 *   2. `assertTransition(status → cancelled)` — anything outside the cancellable
 *      set ({pending_payment, payment_failed, cod_pending_confirmation,
 *      confirmed}) throws `IllegalTransitionError` → 422 `INVALID_TRANSITION`.
 *      (`packed`+ is admin-only: the GST invoice is assigned at packed.)
 *   3. `UPDATE orders` → `cancelled` + `cancelled_at` + `cancel_reason`.
 *   4. Restock every line via `inventory_adjustments` (reason `order_cancelled`)
 *      + bump `product_variants.stock_quantity`. The partial unique index
 *      `inv_adj_once_per_cause_idx` makes this idempotent.
 *   5. `INSERT order_status_history` (`actor_type='customer'`, `actor_id` =
 *      customer id or NULL for a guest-via-JWT cancel).
 *   6. If a payment is `captured` (prepaid), initiate an auto-refund. A refund
 *      row is inserted (`status='initiated'`) and logged; the actual gateway
 *      call is the payments module's job — never blocks the cancel.
 *
 * Returns `ApiResult<OrderSummary>`: a typed discriminated union so the route
 * maps `ok` → 200 and each error `code` straight to its HTTP status.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  assertTransition,
  IllegalTransitionError,
  maskPhone,
  type ErrorCode,
  type OrderStatus,
  type OrderSummary,
} from '@kakoa/core';
import {
  db,
  inventoryAdjustments,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
  productVariants,
  refunds,
} from '@kakoa/db';
import { getPaymentProvider } from '@kakoa/integrations';
import { and, eq, sql } from 'drizzle-orm';

import { sendOrderCancellation } from '@/lib/email/send';

/** A success/typed-failure result the route maps 1:1 to the envelope. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; details?: unknown };

/** Who is driving the cancel — a session owner (customer id) or a guest via JWT. */
export interface CancelActor {
  /** `customers.id` for a logged-in owner; `null` for a guest-via-tracking-JWT. */
  customerId: string | null;
}

const NOT_FOUND_MESSAGE = "We couldn't find that order.";
const ALREADY_PACKED_MESSAGE =
  "This order is already packed and on its way to dispatch, so it can't be " +
  "cancelled online. Please contact support if you need help.";

/**
 * Cancel an order by id. The caller has ALREADY resolved auth to this order id
 * (session-owner or Bearer tracking JWT — `access_token` is NOT accepted for a
 * mutation, enforced at the route). Idempotent-ish: a second cancel of an
 * already-`cancelled` order hits the same 422 (the UI treats it as settled).
 */
export async function cancelOrder(input: {
  orderId: string;
  reason: string;
  actor: CancelActor;
}): Promise<ApiResult<OrderSummary>> {
  try {
    // Captured-payment refund intent surfaced out of the tx, executed post-commit.
    let refundIntent: RefundIntent | null = null;
    const summary = await db.transaction(async (tx) => {
      // 1. Lock the order row (serialize vs admin pack, §7 case 5).
      const [order] = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          paymentMode: orders.paymentMode,
          totalPaise: orders.totalPaise,
          placedAt: orders.placedAt,
          contactPhone: orders.contactPhone,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for('update')
        .limit(1);

      if (!order) throw new CancelNotFound();

      // 2. Gate on the state machine — cancellable set only (throws otherwise).
      assertTransition(order.status as OrderStatus, 'cancelled');

      // 3. Flip the order to cancelled with the reason + timestamp.
      await tx
        .update(orders)
        .set({
          status: 'cancelled',
          cancelledAt: sql`now()`,
          cancelReason: input.reason,
          updatedAt: sql`now()`,
        })
        .where(eq(orders.id, order.id));

      // 4. Restock every line, idempotently (unique cause index guards replays).
      const lines = await tx
        .select({
          variantId: orderItems.variantId,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      for (const line of lines) {
        const [restored] = await tx
          .update(productVariants)
          .set({
            stockQuantity: sql`${productVariants.stockQuantity} + ${line.quantity}`,
            updatedAt: sql`now()`,
          })
          .where(eq(productVariants.id, line.variantId))
          .returning({ stockAfter: productVariants.stockQuantity });
        if (restored) {
          await tx.insert(inventoryAdjustments).values({
            variantId: line.variantId,
            delta: line.quantity,
            reason: 'order_cancelled',
            orderId: order.id,
            stockAfter: restored.stockAfter,
          });
        }
      }

      // 5. Append the transition to the history (customer actor).
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.status as OrderStatus,
        toStatus: 'cancelled',
        actorType: 'customer',
        actorId: input.actor.customerId,
        note: 'Customer cancellation',
      });

      // 6. Auto-refund for a captured (prepaid) payment. We record the refund
      //    instruction (`initiated`) INSIDE the tx so no captured payment is ever
      //    silently stranded, and surface a `refundIntent` so the actual gateway
      //    call runs AFTER commit (outside the tx) — the cancel never blocks or
      //    fails on the gateway. A missing captured payment (COD, or already-
      //    failed) yields no intent and is simply skipped.
      const [captured] = await tx
        .select({
          id: payments.id,
          amountPaise: payments.amountPaise,
          providerPaymentId: payments.providerPaymentId,
        })
        .from(payments)
        .where(
          and(eq(payments.orderId, order.id), eq(payments.status, 'captured')),
        )
        .limit(1);

      if (captured) {
        const [refundRow] = await tx
          .insert(refunds)
          .values({
            orderId: order.id,
            paymentId: captured.id,
            destination: 'original_method',
            amountPaise: captured.amountPaise,
            status: 'initiated',
            reason: 'order_cancelled',
          })
          .returning({ id: refunds.id });
        await tx
          .update(payments)
          .set({ updatedAt: sql`now()` })
          .where(eq(payments.id, captured.id));
        console.info('order.cancel_refund_initiated', {
          order_number: order.orderNumber,
          amount_paise: captured.amountPaise,
        });
        if (refundRow) {
          refundIntent = {
            refundId: refundRow.id,
            paymentId: captured.id,
            providerPaymentId: captured.providerPaymentId,
            amountPaise: captured.amountPaise,
            orderNumber: order.orderNumber,
          };
        }
      }

      const summary: OrderSummary = {
        orderNumber: order.orderNumber,
        status: 'cancelled',
        paymentMode: order.paymentMode,
        totalPaise: order.totalPaise,
        placedAt: new Date(order.placedAt).toISOString(),
        itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
        contactPhoneMasked: maskPhone(order.contactPhone),
      };
      return summary;
    });

    console.info('order.cancelled', {
      order_number: summary.orderNumber,
      actor: input.actor.customerId !== null ? 'session' : 'jwt',
    });
    // Execute the prepaid refund AFTER the cancel tx commits and OUTSIDE it —
    // best-effort: a gateway failure leaves the `refunds` row `initiated` for a
    // sweep/admin retry and never rethrows (the cancel is already committed).
    if (refundIntent !== null) {
      await executeCancelRefund(refundIntent);
    }
    // Best-effort cancellation email, AFTER the cancel tx commits and OUTSIDE
    // it — never blocks or fails the cancel.
    void sendOrderCancellation(input.orderId).catch(() => {});
    return { ok: true, data: summary };
  } catch (cause) {
    if (cause instanceof CancelNotFound) {
      return { ok: false, code: 'NOT_FOUND', message: NOT_FOUND_MESSAGE };
    }
    if (cause instanceof IllegalTransitionError) {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        message: ALREADY_PACKED_MESSAGE,
        details: { currentStatus: cause.from },
      };
    }
    throw cause;
  }
}

/** The captured-payment refund to run after the cancel tx commits. */
export interface RefundIntent {
  /** `refunds.id` — also the gateway idempotency key. */
  refundId: string;
  /** `payments.id` of the captured payment — reconciled to `refunded` on success. */
  paymentId: string;
  /** Razorpay `pay_…` id from the captured payment; NULL ⇒ leave for a sweep. */
  providerPaymentId: string | null;
  /** The full captured amount; a cancel refunds the whole order. */
  amountPaise: number;
  orderNumber: string;
}

/**
 * Execute a prepaid cancellation refund against the gateway and reconcile the
 * `refunds` row. Best-effort and NEVER throws: the cancel has already committed
 * and is irreversible, so a gateway error just leaves the row `initiated` for a
 * later sweep/admin retry. Idempotent via the gateway's idempotency key
 * (`refunds.id`) — a re-run returns the same refund, never a second payout.
 */
export async function executeCancelRefund(intent: RefundIntent): Promise<void> {
  // No gateway payment id (shouldn't happen for a `captured` row) → cannot call
  // the gateway; leave the row `initiated` for reconciliation.
  if (intent.providerPaymentId === null || intent.providerPaymentId === '') {
    console.warn('order.cancel_refund_no_provider_payment_id', {
      refund_id: intent.refundId,
      order_number: intent.orderNumber,
    });
    return;
  }
  try {
    const result = await getPaymentProvider().refund({
      providerPaymentId: intent.providerPaymentId,
      amountPaise: intent.amountPaise,
      idempotencyKey: intent.refundId,
      notes: { order_number: intent.orderNumber, reason: 'order_cancelled' },
    });
    // Razorpay 'pending' → keep 'initiated' (the refund.processed webhook/poll
    // confirms it later); 'processed' → processed; 'failed' → failed.
    const nextStatus =
      result.status === 'processed'
        ? 'processed'
        : result.status === 'failed'
          ? 'failed'
          : 'initiated';
    await db
      .update(refunds)
      .set({
        providerRefundId: result.providerRefundId,
        status: nextStatus,
        ...(nextStatus === 'processed' ? { processedAt: sql`now()` } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(refunds.id, intent.refundId));
    // Reconcile the PAYMENT ledger too — a cancel refunds the full captured
    // amount, so on a processed refund the payment becomes fully `refunded`.
    // Without this the payments row stays `captured`/amount_refunded=0 (a false
    // ledger) and a future returns/admin-refund path that selects `captured`
    // payments could re-refund money already returned. Guarded to the captured
    // amount so the `amount_refunded_paise <= amount_paise` check always holds.
    if (nextStatus === 'processed') {
      await db
        .update(payments)
        .set({
          status: 'refunded',
          amountRefundedPaise: intent.amountPaise,
          updatedAt: sql`now()`,
        })
        .where(eq(payments.id, intent.paymentId));
    }
    console.info('order.cancel_refund_reconciled', {
      refund_id: intent.refundId,
      order_number: intent.orderNumber,
      provider_refund_id: result.providerRefundId,
      status: nextStatus,
      amount_paise: intent.amountPaise,
    });
  } catch (cause) {
    // Gateway hard failure — row stays 'initiated' for a sweep/admin retry.
    console.error('order.cancel_refund_failed', {
      refund_id: intent.refundId,
      order_number: intent.orderNumber,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}

/** Sentinel: the locked order row disappeared (→ 404). */
class CancelNotFound extends Error {
  constructor() {
    super('order not found for cancel');
    this.name = 'CancelNotFound';
  }
}
