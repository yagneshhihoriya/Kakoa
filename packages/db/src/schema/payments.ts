/**
 * Payments & refunds — Contract §1.17–1.18 (DATABASE_ERD.md §3.17–3.18).
 * One payment row per attempt (retries create new rows, never mutate old).
 * COD money is tracked through collection → remittance.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { adminUsers } from './admin';
import {
  paymentMethodEnum,
  paymentProviderEnum,
  paymentStatusEnum,
  refundDestinationEnum,
  refundStatusEnum,
} from './enums';
import { timestamptz } from './helpers';
import { orders } from './orders';
import { returnRequests } from './returns';

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum('provider').notNull(),
    providerOrderId: text('provider_order_id'), // razorpay_order_id ('order_xxx')
    providerPaymentId: text('provider_payment_id'), // razorpay_payment_id ('pay_xxx')
    method: paymentMethodEnum('method').notNull().default('unknown'),
    status: paymentStatusEnum('status').notNull().default('created'),
    amountPaise: integer('amount_paise').notNull(),
    amountRefundedPaise: integer('amount_refunded_paise').notNull().default(0),
    signatureVerified: boolean('signature_verified').notNull().default(false),
    failureCode: text('failure_code'),
    failureReason: text('failure_reason'),
    codRemittedAt: timestamptz('cod_remitted_at'),
    codRemittanceRef: text('cod_remittance_ref'), // Shiprocket COD remittance batch id
    rawPayload: jsonb('raw_payload'), // last provider payload for debugging
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('payments_amount_check', sql`${t.amountPaise} > 0`),
    check(
      'payments_refunded_check',
      sql`${t.amountRefundedPaise} <= ${t.amountPaise}`,
    ),
    // webhook correlation keys
    uniqueIndex('payments_provider_payment_idx')
      .on(t.provider, t.providerPaymentId)
      .where(sql`${t.providerPaymentId} IS NOT NULL`),
    uniqueIndex('payments_provider_order_idx')
      .on(t.provider, t.providerOrderId)
      .where(sql`${t.providerOrderId} IS NOT NULL`),
    index('payments_order_idx').on(t.orderId),
    // COD remittance queue
    index('payments_cod_remit_idx')
      .on(t.status)
      .where(sql`${t.status} IN ('cod_collected', 'cod_pending_remittance')`),
  ],
);

/**
 * One row per refund instruction. Prepaid via Razorpay; COD refunds are
 * manual bank/UPI payouts with an operator-entered reference.
 */
export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    paymentId: uuid('payment_id').references(() => payments.id, {
      onDelete: 'set null',
    }),
    returnRequestId: uuid('return_request_id').references(
      () => returnRequests.id,
      { onDelete: 'set null' },
    ),
    providerRefundId: text('provider_refund_id'), // 'rfnd_xxx'
    destination: refundDestinationEnum('destination').notNull(),
    amountPaise: integer('amount_paise').notNull(),
    status: refundStatusEnum('status').notNull().default('initiated'),
    reason: text('reason').notNull(),
    payoutReference: text('payout_reference'), // UTR / UPI ref for manual COD refunds
    initiatedBy: uuid('initiated_by').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    processedAt: timestamptz('processed_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('refunds_amount_check', sql`${t.amountPaise} > 0`),
    uniqueIndex('refunds_provider_idx')
      .on(t.providerRefundId)
      .where(sql`${t.providerRefundId} IS NOT NULL`),
    index('refunds_order_idx').on(t.orderId),
  ],
);
