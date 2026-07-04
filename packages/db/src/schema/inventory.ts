/**
 * `inventory_adjustments` — Contract §1.22 (DATABASE_ERD.md §3.22).
 * Append-only stock ledger. `product_variants.stock_quantity` is the
 * authoritative counter; every change writes a ledger row in the same
 * transaction with the resulting balance. The partial unique index makes
 * cancel/RTO restocks idempotent — a webhook replay can never restock twice.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { adminUsers } from './admin';
import { productVariants } from './catalog';
import { inventoryReasonEnum } from './enums';
import { timestamptz } from './helpers';
import { orders } from './orders';

export const inventoryAdjustments = pgTable(
  'inventory_adjustments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    delta: integer('delta').notNull(),
    reason: inventoryReasonEnum('reason').notNull(),
    orderId: uuid('order_id').references(() => orders.id, {
      onDelete: 'set null',
    }),
    adminUserId: uuid('admin_user_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    stockAfter: integer('stock_after').notNull(), // resulting balance
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('inv_adj_delta_check', sql`${t.delta} <> 0`),
    check('inv_adj_stock_after_check', sql`${t.stockAfter} >= 0`),
    index('inv_adj_variant_idx').on(t.variantId, t.createdAt.desc()),
    // idempotent order-caused stock moves
    uniqueIndex('inv_adj_once_per_cause_idx')
      .on(t.orderId, t.variantId, t.reason)
      .where(
        sql`${t.reason} IN ('order_placed', 'order_cancelled', 'payment_expired', 'rto_restock', 'return_restock')`,
      ),
  ],
);
