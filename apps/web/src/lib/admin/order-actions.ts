/**
 * Admin order actions (admin-orders.md, Phase 1C). Confirm COD, advance status,
 * and cancel (with restock + refund, reusing the cancel/refund path). Every
 * action runs in a FOR-UPDATE transaction, appends an `order_status_history`
 * row (actor `admin`), and writes an `admin_audit_log` row IN THE SAME TX
 * (audit-in-tx rule). Money movement (refund) runs after commit, best-effort.
 *
 * SERVER-ONLY.
 */
import {
  adminAuditLog,
  db,
  inventoryAdjustments,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
  productVariants,
  refunds,
} from '@kakoa/db';
import {
  assertTransition,
  IllegalTransitionError,
  type ErrorCode,
  type OrderStatus,
} from '@kakoa/core';
import { and, eq, sql } from 'drizzle-orm';
import { executeCancelRefund, type RefundIntent } from '@/lib/orders/cancel';
import { sendOrderCancellation, sendOrderShipped } from '@/lib/email/send';

export type AdminActionResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; code: ErrorCode; message: string };

/**
 * Forward statuses an admin may advance an order to. ONLY the admin-actor edges
 * per the state machine + admin-orders.md: `confirmed→packed`, `packed→shipped`.
 * `out_for_delivery` and `delivered` are courier-only (actors webhook/system) —
 * the shipping integration is the source of truth, so admin must never drive
 * them manually (would mask non-delivery / RTO / COD reconciliation).
 */
export const ADMIN_ADVANCE_TARGETS: readonly OrderStatus[] = ['packed', 'shipped'];

/** Timestamp column to stamp when moving to a given status. */
const STAMP: Partial<Record<OrderStatus, 'confirmedAt' | 'packedAt' | 'shippedAt' | 'deliveredAt'>> = {
  confirmed: 'confirmedAt',
  packed: 'packedAt',
  shipped: 'shippedAt',
  delivered: 'deliveredAt',
};

class ActionNotFound extends Error {}

function mapError(cause: unknown, toStatus: OrderStatus): AdminActionResult | never {
  if (cause instanceof ActionNotFound) {
    return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that order." };
  }
  if (cause instanceof IllegalTransitionError) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `This order can't move to ${toStatus.replace(/_/g, ' ')} from its current state.`,
    };
  }
  throw cause;
}

/** A transaction handle (drizzle tx) — kept loose to avoid leaking the generic. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The order-write CORE, inside a caller-provided tx: assert legality against the
 * state machine, update `status` + its timestamp, append `order_status_history`,
 * and write the audit row. The caller MUST have locked the order row `FOR UPDATE`
 * and pass its current `{ id, status }`. Throws `IllegalTransitionError` on an
 * illegal move (the caller maps it to 422). This is the single order-status write
 * path — the shipment module reuses it to mirror shipment → order transitions.
 */
export async function applyOrderTransitionTx(
  tx: Tx,
  order: { id: string; status: OrderStatus },
  toStatus: OrderStatus,
  opts: {
    /** `null` for a system/webhook-driven transition (courier tracking). */
    adminUserId: string | null;
    action: string;
    note: string;
    actorType?: 'admin' | 'system' | 'webhook';
  },
): Promise<void> {
  assertTransition(order.status, toStatus);

  const stampCol = STAMP[toStatus];
  await tx
    .update(orders)
    .set({
      status: toStatus,
      ...(stampCol ? { [stampCol]: sql`now()` } : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(orders.id, order.id));
  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus,
    actorType: opts.actorType ?? 'admin',
    actorId: opts.adminUserId,
    note: opts.note,
  });
  await tx.insert(adminAuditLog).values({
    adminUserId: opts.adminUserId,
    action: opts.action,
    entityType: 'order',
    entityId: order.id,
    before: { status: order.status },
    after: { status: toStatus },
  });
}

/**
 * Pure status transition (confirm-COD / advance): lock the order, assert
 * legality, update the status + its timestamp, append history + audit.
 * `expectedFrom` guards actions that are only valid from one state (e.g.
 * confirm-COD only from cod_pending).
 */
async function applyStatusTransition(
  orderNumber: string,
  toStatus: OrderStatus,
  opts: {
    adminUserId: string;
    action: string;
    note: string;
    expectedFrom?: OrderStatus;
  },
): Promise<AdminActionResult> {
  try {
    const status = await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(eq(orders.orderNumber, orderNumber))
        .for('update')
        .limit(1);
      if (!order) throw new ActionNotFound();
      if (opts.expectedFrom !== undefined && order.status !== opts.expectedFrom) {
        throw new IllegalTransitionError(order.status, toStatus);
      }
      await applyOrderTransitionTx(tx, order, toStatus, {
        adminUserId: opts.adminUserId,
        action: opts.action,
        note: opts.note,
      });
      return toStatus;
    });
    return { ok: true, status };
  } catch (cause) {
    return mapError(cause, toStatus);
  }
}

export function adminConfirmCod(
  orderNumber: string,
  adminUserId: string,
): Promise<AdminActionResult> {
  return applyStatusTransition(orderNumber, 'confirmed', {
    adminUserId,
    action: 'order.confirm_cod',
    note: 'Admin confirmed COD',
    expectedFrom: 'cod_pending_confirmation',
  });
}

export async function adminAdvanceStatus(
  orderNumber: string,
  toStatus: OrderStatus,
  adminUserId: string,
): Promise<AdminActionResult> {
  if (!ADMIN_ADVANCE_TARGETS.includes(toStatus)) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Unsupported status transition.',
    };
  }
  const result = await applyStatusTransition(orderNumber, toStatus, {
    adminUserId,
    action: 'order.transition',
    note: `Admin advanced to ${toStatus.replace(/_/g, ' ')}`,
  });

  // Gap C — the manual "Mark shipped" path fires the customer shipped email
  // (best-effort, AFTER the transition, idempotent via the send's key).
  if (result.ok && toStatus === 'shipped') {
    void notifyShipped(orderNumber);
  }
  return result;
}

/** Best-effort: resolve the order id by number and fire the shipped email. */
async function notifyShipped(orderNumber: string): Promise<void> {
  try {
    const [o] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);
    if (o) await sendOrderShipped(o.id);
  } catch {
    /* best-effort */
  }
}

/**
 * Admin cancel (→ cancelled): restock lines, append history + audit IN the tx,
 * then run the prepaid refund AFTER commit via the shared `executeCancelRefund`
 * (same money path as customer cancel). Only legal pre-dispatch (state machine).
 */
export async function adminCancelOrder(
  orderNumber: string,
  reason: string,
  adminUserId: string,
): Promise<AdminActionResult> {
  try {
    let refundIntent: RefundIntent | null = null;
    let orderIdForEmail: string | null = null;

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status })
        .from(orders)
        .where(eq(orders.orderNumber, orderNumber))
        .for('update')
        .limit(1);
      if (!order) throw new ActionNotFound();
      assertTransition(order.status, 'cancelled');
      orderIdForEmail = order.id;

      await tx
        .update(orders)
        .set({
          status: 'cancelled',
          cancelledAt: sql`now()`,
          cancelReason: reason,
          updatedAt: sql`now()`,
        })
        .where(eq(orders.id, order.id));

      // Restock every line, idempotently (partial-unique cause index guards replays).
      const lines = await tx
        .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
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

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: 'cancelled',
        actorType: 'admin',
        actorId: adminUserId,
        note: 'Admin cancellation',
      });
      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'order.cancel',
        entityType: 'order',
        entityId: order.id,
        before: { status: order.status },
        after: { status: 'cancelled' },
      });

      // Capture the captured-payment refund intent (executed after commit).
      const [captured] = await tx
        .select({
          id: payments.id,
          amountPaise: payments.amountPaise,
          providerPaymentId: payments.providerPaymentId,
        })
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.status, 'captured')))
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
    });

    // Money + email AFTER commit, best-effort (never rethrow).
    if (refundIntent !== null) await executeCancelRefund(refundIntent);
    if (orderIdForEmail !== null) {
      void sendOrderCancellation(orderIdForEmail).catch(() => {});
    }
    return { ok: true, status: 'cancelled' };
  } catch (cause) {
    return mapError(cause, 'cancelled');
  }
}
