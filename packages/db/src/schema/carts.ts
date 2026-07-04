/**
 * Carts — Contract §1.10–1.11 (DATABASE_ERD.md §3.10–3.11).
 * Guest carts keyed by httpOnly cookie token; owned carts by customer.
 * Cart lines are NEVER price snapshots — pricing is always live.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { productVariants } from './catalog';
import { coupons } from './coupons';
import { customers } from './customers';
import { cartStatusEnum } from './enums';
import { timestamptz } from './helpers';

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    token: uuid('token').notNull().unique().default(sql`gen_random_uuid()`), // cookie value for guests
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'cascade',
    }),
    status: cartStatusEnum('status').notNull().default('active'),
    couponId: uuid('coupon_id').references(() => coupons.id, {
      onDelete: 'set null',
    }), // applied pre-checkout, revalidated at quote/place
    mergedIntoCartId: uuid('merged_into_cart_id').references(
      (): AnyPgColumn => carts.id,
    ),
    expiresAt: timestamptz('expires_at')
      .notNull()
      .default(sql`now() + interval '30 days'`),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // at most one active cart per customer
    uniqueIndex('carts_one_active_per_customer_idx')
      .on(t.customerId)
      .where(sql`${t.status} = 'active' AND ${t.customerId} IS NOT NULL`),
    index('carts_abandoned_sweep_idx')
      .on(t.updatedAt)
      .where(sql`${t.status} = 'active'`),
  ],
);

/** One line per variant per cart; gift wrap/message attach to the line. */
export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    giftWrap: boolean('gift_wrap').notNull().default(false),
    giftMessage: text('gift_message'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('cart_items_cart_variant_uq').on(t.cartId, t.variantId),
    check('cart_items_quantity_check', sql`${t.quantity} BETWEEN 1 AND 20`),
    check(
      'cart_items_gift_message_check',
      sql`char_length(${t.giftMessage}) <= 300`,
    ),
  ],
);
