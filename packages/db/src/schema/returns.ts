/**
 * Returns — Contract §1.25 (DATABASE_ERD.md §3.25–3.26).
 * Item-level returns with photo evidence (7-day window post-delivery).
 * One OPEN request per order enforced by partial unique index.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { adminUsers } from './admin';
import { customers } from './customers';
import {
  returnReasonEnum,
  returnResolutionEnum,
  returnStatusEnum,
} from './enums';
import { timestamptz } from './helpers';
import { orderItems, orders } from './orders';

export const returnRequests = pgTable(
  'return_requests',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }), // NULL = guest via OTP token
    status: returnStatusEnum('status').notNull().default('requested'),
    reason: returnReasonEnum('reason').notNull(),
    resolution: returnResolutionEnum('resolution').notNull().default('refund'),
    comment: text('comment'),
    photoUrls: text('photo_urls')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    decidedBy: uuid('decided_by').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    decidedAt: timestamptz('decided_at'),
    decisionNote: text('decision_note'),
    receivedAt: timestamptz('received_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'return_requests_comment_check',
      sql`char_length(${t.comment}) <= 1000`,
    ),
    uniqueIndex('return_requests_one_open_idx')
      .on(t.orderId)
      .where(sql`${t.status} IN ('requested', 'approved', 'pickup_scheduled')`),
    index('return_requests_queue_idx')
      .on(t.createdAt)
      .where(sql`${t.status} = 'requested'`),
  ],
);

export const returnRequestItems = pgTable(
  'return_request_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    returnRequestId: uuid('return_request_id')
      .notNull()
      .references(() => returnRequests.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
  },
  (t) => [
    unique('return_request_items_request_item_uq').on(
      t.returnRequestId,
      t.orderItemId,
    ),
    check('return_request_items_quantity_check', sql`${t.quantity} > 0`),
  ],
);
