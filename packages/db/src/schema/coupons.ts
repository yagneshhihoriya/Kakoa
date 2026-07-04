/**
 * Coupons — Contract §1.12–1.13 (DATABASE_ERD.md §3.12–3.13).
 * Percent XOR flat discounts; `redemption_count` enables the atomic
 * exhaustion check (§1.28.2).
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
  uuid,
} from 'drizzle-orm/pg-core';
import { adminUsers } from './admin';
import { customers } from './customers';
import { citext, timestamptz } from './helpers';
import { orders } from './orders';

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    code: citext('code').notNull().unique(), // stored uppercase
    description: text('description').notNull().default(''),
    percentBp: integer('percent_bp'), // 1000 = 10%
    flatPaise: integer('flat_paise'),
    maxDiscountPaise: integer('max_discount_paise'), // cap for percent coupons
    minSubtotalPaise: integer('min_subtotal_paise').notNull().default(0),
    startsAt: timestamptz('starts_at').notNull().defaultNow(),
    endsAt: timestamptz('ends_at'),
    usageLimit: integer('usage_limit'), // global
    perCustomerLimit: integer('per_customer_limit').notNull().default(1),
    firstOrderOnly: boolean('first_order_only').notNull().default(false),
    redemptionCount: integer('redemption_count').notNull().default(0), // atomic exhaustion counter
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'coupons_code_length_check',
      sql`char_length(${t.code}::text) BETWEEN 3 AND 24`,
    ),
    check('coupons_percent_bp_check', sql`${t.percentBp} BETWEEN 1 AND 10000`),
    check('coupons_flat_paise_check', sql`${t.flatPaise} > 0`),
    check('coupons_max_discount_check', sql`${t.maxDiscountPaise} > 0`),
    check('coupons_usage_limit_check', sql`${t.usageLimit} > 0`),
    // exactly one of percent_bp / flat_paise
    check(
      'coupons_kind_check',
      sql`num_nonnulls(${t.percentBp}, ${t.flatPaise}) = 1`,
    ),
  ],
);

/**
 * Per-order audit + per-customer/per-phone limit enforcement (guests
 * tracked by phone so limits survive account-less checkouts).
 */
export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    contactPhone: text('contact_phone').notNull(), // guest limit tracking
    discountPaise: integer('discount_paise').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('coupon_redemptions_coupon_order_uq').on(t.couponId, t.orderId),
    check('coupon_redemptions_discount_check', sql`${t.discountPaise} >= 0`),
    index('coupon_redemptions_phone_idx').on(t.couponId, t.contactPhone),
  ],
);
