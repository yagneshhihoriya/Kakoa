/**
 * Admin payments (HANDOFF-Payments.md). Financial VISIBILITY + a money-safe
 * refund + COD remittance marking. Read-heavy. Correctness beats features:
 *
 *  - Over-refund is impossible: the remaining balance is computed under a
 *    `SELECT … FOR UPDATE` and the amount reserved on the ledger IN the tx, so a
 *    concurrent refund (also FOR UPDATE) sees the reduced remaining.
 *  - There is ONE money path. Prepaid refunds reuse `PaymentProvider.refund`
 *    (the same gateway pipe `executeCancelRefund` calls), keyed by `refunds.id`
 *    for gateway idempotency. We do NOT write a second gateway integration.
 *  - COD refunds are MANUAL bank/UPI payouts — no gateway call; the refund row
 *    records the operator's payout reference.
 *  - Every mutation is `isUuid`-guarded, `withConstraintMapping`-wrapped, and
 *    writes an `admin_audit_log` row IN THE SAME TX.
 *  - `rawPayload` (provider PII/tokens) is NEVER selected for the client.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  adminAuditLog,
  adminUsers,
  db,
  orders,
  payments,
  refunds,
  type AddressSnapshot,
} from '@kakoa/db';
import { maskPhone } from '@kakoa/core';
import { getPaymentProvider } from '@kakoa/integrations';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { withConstraintMapping } from './db-errors';
import { isUuid } from './product-validation';
import {
  COD_REMIT_QUEUE_STATUSES,
  isCodPayment,
  isCodRemittable,
  isRefundableStatus,
  nextStatusAfterRefund,
  remainingRefundablePaise,
  validateRefundAmount,
  validateRefundDestination,
} from './payment-format';

export const PAYMENTS_PAGE_SIZE = 30;

/** Escape LIKE wildcards so search is a literal substring (default `\` escape). */
function likeParam(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function clampPage(raw: number | undefined): number {
  const n = Math.floor(Number(raw ?? 1));
  return Number.isFinite(n) ? Math.min(1_000_000, Math.max(1, n)) : 1;
}

export interface PaymentRow {
  id: string;
  orderNumber: string;
  contactPhoneMasked: string;
  provider: string;
  method: string;
  status: string;
  amountPaise: number;
  amountRefundedPaise: number;
  signatureVerified: boolean;
  createdAt: string;
}

export interface PaymentList {
  rows: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listPayments(input: {
  search?: string;
  status?: string;
  method?: string;
  page?: number;
}): Promise<PaymentList> {
  const page = clampPage(input.page);
  const pageSize = PAYMENTS_PAGE_SIZE;

  const conds: SQL[] = [];
  if (input.status !== undefined && input.status !== '') {
    conds.push(sql`${payments.status} = ${input.status}`);
  }
  if (input.method !== undefined && input.method !== '') {
    conds.push(sql`${payments.method} = ${input.method}`);
  }
  const search = input.search?.trim();
  if (search !== undefined && search !== '') {
    const p = likeParam(search);
    conds.push(
      sql`(${orders.orderNumber} ilike ${p} or ${payments.providerPaymentId} ilike ${p})`,
    );
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      id: payments.id,
      orderNumber: orders.orderNumber,
      contactPhone: orders.contactPhone,
      provider: payments.provider,
      method: payments.method,
      status: payments.status,
      amountPaise: payments.amountPaise,
      amountRefundedPaise: payments.amountRefundedPaise,
      signatureVerified: payments.signatureVerified,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      contactPhoneMasked: maskPhone(r.contactPhone),
      provider: r.provider,
      method: r.method,
      status: r.status,
      amountPaise: Number(r.amountPaise),
      amountRefundedPaise: Number(r.amountRefundedPaise),
      signatureVerified: r.signatureVerified,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface PaymentRefundHistoryRow {
  id: string;
  amountPaise: number;
  status: string;
  destination: string;
  payoutReference: string | null;
  providerRefundId: string | null;
  reason: string;
  initiatedByEmail: string | null;
  createdAt: string;
}

export interface PaymentDetail {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentMode: string;
  customerName: string;
  contactPhoneMasked: string;
  provider: string;
  method: string;
  status: string;
  amountPaise: number;
  amountRefundedPaise: number;
  remainingRefundablePaise: number;
  signatureVerified: boolean;
  isCod: boolean;
  /** Non-sensitive failure surface only — `rawPayload` is NEVER exposed. */
  failureCode: string | null;
  failureReason: string | null;
  codRemittedAt: string | null;
  codRemittanceRef: string | null;
  createdAt: string;
  refunds: PaymentRefundHistoryRow[];
}

/**
 * A payment + its order summary + the list of refunds against it. `isUuid`
 * guarded (a malformed id → `null` → the route returns NOT_FOUND). Deliberately
 * omits `rawPayload` (provider PII/tokens) — only `failureCode`/`failureReason`
 * are surfaced.
 */
export async function getPaymentDetail(id: string): Promise<PaymentDetail | null> {
  if (!isUuid(id)) return null;

  const [row] = await db
    .select({
      id: payments.id,
      orderId: payments.orderId,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      paymentMode: orders.paymentMode,
      shippingAddress: orders.shippingAddress,
      contactPhone: orders.contactPhone,
      provider: payments.provider,
      method: payments.method,
      status: payments.status,
      amountPaise: payments.amountPaise,
      amountRefundedPaise: payments.amountRefundedPaise,
      signatureVerified: payments.signatureVerified,
      failureCode: payments.failureCode,
      failureReason: payments.failureReason,
      codRemittedAt: payments.codRemittedAt,
      codRemittanceRef: payments.codRemittanceRef,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(eq(payments.id, id))
    .limit(1);
  if (!row) return null;

  const refundRows = await db
    .select({
      id: refunds.id,
      amountPaise: refunds.amountPaise,
      status: refunds.status,
      destination: refunds.destination,
      payoutReference: refunds.payoutReference,
      providerRefundId: refunds.providerRefundId,
      reason: refunds.reason,
      initiatedByEmail: adminUsers.email,
      createdAt: refunds.createdAt,
    })
    .from(refunds)
    .leftJoin(adminUsers, eq(adminUsers.id, refunds.initiatedBy))
    .where(eq(refunds.paymentId, id))
    .orderBy(desc(refunds.createdAt));

  const amountPaise = Number(row.amountPaise);
  const amountRefundedPaise = Number(row.amountRefundedPaise);

  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    orderStatus: row.orderStatus,
    paymentMode: row.paymentMode,
    customerName:
      (row.shippingAddress as AddressSnapshot | null)?.fullName ?? '—',
    contactPhoneMasked: maskPhone(row.contactPhone),
    provider: row.provider,
    method: row.method,
    status: row.status,
    amountPaise,
    amountRefundedPaise,
    remainingRefundablePaise: remainingRefundablePaise(
      amountPaise,
      amountRefundedPaise,
    ),
    signatureVerified: row.signatureVerified,
    isCod: isCodPayment(row.provider, row.method),
    failureCode: row.failureCode,
    failureReason: row.failureReason,
    codRemittedAt: row.codRemittedAt
      ? new Date(row.codRemittedAt).toISOString()
      : null,
    codRemittanceRef: row.codRemittanceRef,
    createdAt: new Date(row.createdAt).toISOString(),
    refunds: refundRows.map((r) => ({
      id: r.id,
      amountPaise: Number(r.amountPaise),
      status: r.status,
      destination: r.destination,
      payoutReference: r.payoutReference,
      providerRefundId: r.providerRefundId,
      reason: r.reason,
      initiatedByEmail: r.initiatedByEmail,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
  };
}

export interface CodRemittanceRow {
  id: string;
  orderNumber: string;
  status: string;
  amountPaise: number;
  createdAt: string;
}

/** Collected-COD payments awaiting remittance marking (FIFO — oldest first). */
export async function listCodRemittanceQueue(): Promise<CodRemittanceRow[]> {
  const rows = await db
    .select({
      id: payments.id,
      orderNumber: orders.orderNumber,
      status: payments.status,
      amountPaise: payments.amountPaise,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(inArray(payments.status, [...COD_REMIT_QUEUE_STATUSES]))
    .orderBy(payments.createdAt)
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    status: r.status,
    amountPaise: Number(r.amountPaise),
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}

export type RefundResult =
  | {
      ok: true;
      refundId: string;
      paymentStatus: string;
      amountRefundedPaise: number;
      remainingPaise: number;
      gatewayStatus: 'processed' | 'pending' | 'failed' | 'manual' | 'skipped';
    }
  | { ok: false; code: 'NOT_FOUND' | 'VALIDATION_ERROR'; message: string };

/** Post-commit gateway reconciliation intent for a PREPAID refund. */
interface PrepaidRefundIntent {
  refundId: string;
  paymentId: string;
  providerPaymentId: string | null;
  amountPaise: number;
  orderNumber: string;
}

/**
 * Refund a payment. Thin wrapper over the existing money path:
 *  - Validation + the ledger reservation + the `refunds` row + audit all run in
 *    ONE tx, with remaining computed under `FOR UPDATE` (over-refund impossible).
 *  - For PREPAID (`original_method`) the actual money move is the shared
 *    `PaymentProvider.refund` (keyed by `refunds.id` — a re-run never double-pays),
 *    executed AFTER the tx commits and reconciled back onto the refund row.
 *  - For COD it's a MANUAL payout: no gateway call, the operator reference is
 *    recorded and the refund row is `processed` immediately.
 */
export async function refundPayment(
  input: {
    paymentId: string;
    amountPaise: number;
    destination: string;
    reason: string;
    reference?: string;
  },
  adminUserId: string,
): Promise<RefundResult> {
  if (!isUuid(input.paymentId)) {
    return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that payment." };
  }
  const reason =
    typeof input.reason === 'string' ? input.reason.trim().slice(0, 500) : '';
  if (reason.length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a reason for this refund.' };
  }
  const reference =
    typeof input.reference === 'string' ? input.reference.trim().slice(0, 200) : '';

  let intent: PrepaidRefundIntent | null = null;

  const result = await withConstraintMapping(() =>
    db.transaction(async (tx): Promise<RefundResult> => {
      const [payment] = await tx
        .select({
          id: payments.id,
          orderId: payments.orderId,
          provider: payments.provider,
          method: payments.method,
          status: payments.status,
          amountPaise: payments.amountPaise,
          amountRefundedPaise: payments.amountRefundedPaise,
          providerPaymentId: payments.providerPaymentId,
        })
        .from(payments)
        .where(eq(payments.id, input.paymentId))
        .for('update')
        .limit(1);
      if (!payment) {
        return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that payment." };
      }

      // Reject refunding a payment that never captured money (created/authorized/
      // failed/cod_pending_collection) — there is nothing to reverse.
      if (!isRefundableStatus(payment.status)) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'This payment has no captured amount to refund.',
        };
      }

      const remaining = remainingRefundablePaise(
        payment.amountPaise,
        payment.amountRefundedPaise,
      );
      const amountCheck = validateRefundAmount(input.amountPaise, remaining);
      if (!amountCheck.ok) {
        return { ok: false, code: 'VALIDATION_ERROR', message: amountCheck.message };
      }
      const refundPaise = amountCheck.amountPaise;

      const cod = isCodPayment(payment.provider, payment.method);
      const destCheck = validateRefundDestination(input.destination, cod);
      if (!destCheck.ok) {
        return { ok: false, code: 'VALIDATION_ERROR', message: destCheck.message };
      }

      // COD refunds are manual payouts → an operator reference is mandatory.
      if (cod && reference.length === 0) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Enter the payout reference (UTR / UPI ref) for this manual refund.',
        };
      }

      const [ord] = await tx
        .select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(eq(orders.id, payment.orderId))
        .limit(1);
      const orderNumber = ord?.orderNumber ?? '';

      const newRefunded = payment.amountRefundedPaise + refundPaise;
      const paymentStatus = nextStatusAfterRefund(
        payment.amountPaise,
        payment.amountRefundedPaise,
        refundPaise,
      );

      // Record the refund instruction. Prepaid stays `initiated` until the
      // gateway reconciles post-commit; a COD manual payout is `processed` now.
      const [refundRow] = await tx
        .insert(refunds)
        .values({
          orderId: payment.orderId,
          paymentId: payment.id,
          destination: destCheck.destination,
          amountPaise: refundPaise,
          status: cod ? 'processed' : 'initiated',
          reason,
          payoutReference: cod ? reference : null,
          initiatedBy: adminUserId,
          processedAt: cod ? sql`now()` : null,
        })
        .returning({ id: refunds.id });
      if (!refundRow) {
        return { ok: false, code: 'VALIDATION_ERROR', message: 'Could not record the refund.' };
      }

      // Reserve the amount on the payment ledger IN the tx — this is what makes
      // over-refund impossible under a race: the next FOR-UPDATE refund sees the
      // reduced remaining. The `amount_refunded_paise <= amount_paise` CHECK is a
      // race-safe backstop (mapped by withConstraintMapping if ever tripped).
      await tx
        .update(payments)
        .set({
          amountRefundedPaise: newRefunded,
          status: paymentStatus,
          updatedAt: sql`now()`,
        })
        .where(eq(payments.id, payment.id));

      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'payment.refund',
        entityType: 'payment',
        entityId: payment.id,
        before: {
          status: payment.status,
          amountRefundedPaise: payment.amountRefundedPaise,
        },
        after: {
          status: paymentStatus,
          amountRefundedPaise: newRefunded,
          refundPaise,
          destination: destCheck.destination,
          cod,
        },
      });

      if (!cod) {
        intent = {
          refundId: refundRow.id,
          paymentId: payment.id,
          providerPaymentId: payment.providerPaymentId,
          amountPaise: refundPaise,
          orderNumber,
        };
      }

      return {
        ok: true,
        refundId: refundRow.id,
        paymentStatus,
        amountRefundedPaise: newRefunded,
        remainingPaise: payment.amountPaise - newRefunded,
        gatewayStatus: cod ? 'manual' : 'pending',
      };
    }),
  );

  if (!result.ok) return result;

  // PREPAID: run the gateway refund AFTER commit and OUTSIDE the tx (never blocks
  // or fails inside it). Reuses the same provider pipe + `refunds.id` idempotency
  // key as `executeCancelRefund` — no second money path.
  if (intent !== null) {
    const gatewayStatus = await reconcilePrepaidRefund(intent);
    return { ...result, gatewayStatus };
  }
  return result;
}

/**
 * Execute the prepaid refund against the gateway and reconcile the `refunds`
 * row. Best-effort, NEVER throws (the ledger reservation has already committed):
 *  - `processed` → mark the refund processed.
 *  - `pending`   → keep `initiated` (a webhook/poll confirms later); reservation holds.
 *  - `failed`    → mark failed AND RELEASE the reservation (money did not move).
 *  - throw / no gateway id → leave `initiated` (reserved) for a sweep/admin retry.
 */
async function reconcilePrepaidRefund(
  intent: PrepaidRefundIntent,
): Promise<'processed' | 'pending' | 'failed' | 'skipped'> {
  if (intent.providerPaymentId === null || intent.providerPaymentId === '') {
    console.warn('payment.refund_no_provider_payment_id', {
      refund_id: intent.refundId,
    });
    return 'skipped';
  }
  try {
    const res = await getPaymentProvider().refund({
      providerPaymentId: intent.providerPaymentId,
      amountPaise: intent.amountPaise,
      idempotencyKey: intent.refundId,
      notes: { order_number: intent.orderNumber, reason: 'admin_refund' },
    });
    const next =
      res.status === 'processed'
        ? 'processed'
        : res.status === 'failed'
          ? 'failed'
          : 'initiated';

    if (next === 'failed') {
      // Release the reserved amount — the gateway rejected the refund.
      await db.transaction(async (tx) => {
        await tx
          .update(refunds)
          .set({
            status: 'failed',
            providerRefundId: res.providerRefundId,
            updatedAt: sql`now()`,
          })
          .where(eq(refunds.id, intent.refundId));
        const [p] = await tx
          .select({
            amountPaise: payments.amountPaise,
            amountRefundedPaise: payments.amountRefundedPaise,
          })
          .from(payments)
          .where(eq(payments.id, intent.paymentId))
          .for('update')
          .limit(1);
        if (p) {
          const restored = Math.max(0, p.amountRefundedPaise - intent.amountPaise);
          // Prepaid collected state is `captured`; any remaining refund keeps it
          // `partially_refunded`.
          await tx
            .update(payments)
            .set({
              amountRefundedPaise: restored,
              status: restored === 0 ? 'captured' : 'partially_refunded',
              updatedAt: sql`now()`,
            })
            .where(eq(payments.id, intent.paymentId));
        }
      });
      return 'failed';
    }

    await db
      .update(refunds)
      .set({
        status: next,
        providerRefundId: res.providerRefundId,
        ...(next === 'processed' ? { processedAt: sql`now()` } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(refunds.id, intent.refundId));
    return next === 'processed' ? 'processed' : 'pending';
  } catch (cause) {
    // Gateway hard failure — the row stays `initiated` (reserved) for a sweep.
    console.error('payment.refund_gateway_failed', {
      refund_id: intent.refundId,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return 'pending';
  }
}

export type RemitResult =
  | { ok: true; alreadyRemitted: boolean }
  | { ok: false; code: 'NOT_FOUND' | 'VALIDATION_ERROR'; message: string };

/**
 * Mark a collected-COD payment as remitted (cash handed over / settled) with an
 * operator reference. Valid ONLY from a collected-COD state; idempotent — a
 * repeat on an already-remitted payment is a no-op success.
 */
export async function markCodRemitted(
  input: { paymentId: string; reference: string },
  adminUserId: string,
): Promise<RemitResult> {
  if (!isUuid(input.paymentId)) {
    return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that payment." };
  }
  const reference =
    typeof input.reference === 'string' ? input.reference.trim().slice(0, 200) : '';
  if (reference.length === 0) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Enter a remittance reference.' };
  }

  return withConstraintMapping(() =>
    db.transaction(async (tx): Promise<RemitResult> => {
      const [payment] = await tx
        .select({ id: payments.id, status: payments.status })
        .from(payments)
        .where(eq(payments.id, input.paymentId))
        .for('update')
        .limit(1);
      if (!payment) {
        return { ok: false, code: 'NOT_FOUND', message: "We couldn't find that payment." };
      }

      // Idempotent: already remitted → no-op success (no second audit row).
      if (payment.status === 'cod_remitted') {
        return { ok: true, alreadyRemitted: true };
      }
      if (!isCodRemittable(payment.status)) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'Only a collected COD payment can be marked remitted.',
        };
      }

      await tx
        .update(payments)
        .set({
          status: 'cod_remitted',
          codRemittedAt: sql`now()`,
          codRemittanceRef: reference,
          updatedAt: sql`now()`,
        })
        .where(eq(payments.id, payment.id));

      await tx.insert(adminAuditLog).values({
        adminUserId,
        action: 'payment.cod-remit',
        entityType: 'payment',
        entityId: payment.id,
        before: { status: payment.status },
        after: { status: 'cod_remitted', codRemittanceRef: reference },
      });

      return { ok: true, alreadyRemitted: false };
    }),
  );
}
