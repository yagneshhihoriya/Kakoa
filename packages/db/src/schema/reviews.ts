/**
 * Reviews & wishlists — Contract §1.23–1.24 (DATABASE_ERD.md §3.23–3.24).
 * Reviews are post-purchase only: `order_item_id UNIQUE` is both proof of
 * purchase and the one-review-per-purchase constraint.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { adminUsers } from './admin';
import { products } from './catalog';
import { customers } from './customers';
import { reviewStatusEnum } from './enums';
import { timestamptz } from './helpers';
import { orderItems } from './orders';

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id')
      .notNull()
      .unique()
      .references(() => orderItems.id, { onDelete: 'cascade' }), // proof of purchase
    rating: integer('rating').notNull(),
    title: text('title'),
    body: text('body').notNull(),
    status: reviewStatusEnum('status').notNull().default('pending'),
    moderatedBy: uuid('moderated_by').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    moderatedAt: timestamptz('moderated_at'),
    moderationNote: text('moderation_note'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('reviews_rating_check', sql`${t.rating} BETWEEN 1 AND 5`),
    check('reviews_title_check', sql`char_length(${t.title}) <= 120`),
    check(
      'reviews_body_check',
      sql`char_length(${t.body}) BETWEEN 10 AND 2000`,
    ),
    // PDP only ever reads approved
    index('reviews_product_approved_idx')
      .on(t.productId, t.createdAt.desc())
      .where(sql`${t.status} = 'approved'`),
    index('reviews_moderation_queue_idx')
      .on(t.createdAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);

/** Product-level hearts. Composite PK — no surrogate needed. */
export const wishlistItems = pgTable(
  'wishlist_items',
  {
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: 'wishlist_items_pk',
      columns: [t.customerId, t.productId],
    }),
  ],
);
