/**
 * Orders — Contract §1.14–1.16 (DATABASE_ERD.md §3.14–3.16).
 * The aggregate root. Guest-first (`customer_id` nullable, contact fields
 * NOT NULL). Every money figure and the address are SNAPSHOTS (§1.29).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { productVariants } from './catalog';
import { carts } from './carts';
import { coupons } from './coupons';
import { customers } from './customers';
import {
  actorTypeEnum,
  deliveryOptionEnum,
  orderStatusEnum,
  paymentModeEnum,
} from './enums';
import { citext, timestamptz } from './helpers';

/** Snapshot of the shipping/billing address at placement (Contract §1.14). */
export interface AddressSnapshot {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
}

/** Human order number: 'KK-' || lpad(nextval, 5, '0') → 'KK-48210'. */
export const orderNumberSeq = pgSequence('order_number_seq', {
  startWith: 48210,
});

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderNumber: text('order_number')
      .notNull()
      .unique()
      .default(sql`'KK-' || lpad(nextval('order_number_seq')::text, 5, '0')`),
    invoiceNumber: text('invoice_number').unique(), // GST serial 'KK/25-26/00042'; assigned at packed
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }), // NULL = guest
    cartId: uuid('cart_id').references(() => carts.id, {
      onDelete: 'set null',
    }),
    status: orderStatusEnum('status').notNull(),
    paymentMode: paymentModeEnum('payment_mode').notNull(),
    currency: char('currency', { length: 3 }).notNull().default('INR'),
    contactPhone: text('contact_phone').notNull(),
    contactEmail: citext('contact_email'),
    codPhoneVerifiedAt: timestamptz('cod_phone_verified_at'),
    shippingAddress: jsonb('shipping_address')
      .$type<AddressSnapshot>()
      .notNull(), // SNAPSHOT
    billingAddress: jsonb('billing_address').$type<AddressSnapshot>(), // NULL = same as shipping
    shipToStateCode: char('ship_to_state_code', { length: 2 }).notNull(), // CGST/SGST vs IGST
    deliveryOpt: deliveryOptionEnum('delivery_opt').notNull(),
    subtotalPaise: integer('subtotal_paise').notNull(), // sum of line totals (GST-incl)
    discountPaise: integer('discount_paise').notNull().default(0),
    shippingFeePaise: integer('shipping_fee_paise').notNull().default(0), // SNAPSHOT of settings
    codFeePaise: integer('cod_fee_paise').notNull().default(0), // SNAPSHOT
    giftWrapTotalPaise: integer('gift_wrap_total_paise').notNull().default(0),
    totalPaise: integer('total_paise').notNull(),
    cgstPaise: integer('cgst_paise').notNull().default(0), // informational extraction
    sgstPaise: integer('sgst_paise').notNull().default(0),
    igstPaise: integer('igst_paise').notNull().default(0),
    couponId: uuid('coupon_id').references(() => coupons.id, {
      onDelete: 'set null',
    }),
    couponCode: text('coupon_code'), // SNAPSHOT: survives coupon edits/deletes
    idempotencyKey: text('idempotency_key').unique(), // retry-safe placement
    accessToken: uuid('access_token')
      .notNull()
      .unique()
      .default(sql`gen_random_uuid()`), // guest success-page auth, 24h honored
    customerNote: text('customer_note'),
    cancelReason: text('cancel_reason'),
    placedAt: timestamptz('placed_at').notNull().defaultNow(),
    confirmedAt: timestamptz('confirmed_at'),
    packedAt: timestamptz('packed_at'),
    shippedAt: timestamptz('shipped_at'),
    deliveredAt: timestamptz('delivered_at'),
    cancelledAt: timestamptz('cancelled_at'),
    rtoDeliveredAt: timestamptz('rto_delivered_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'orders_contact_phone_check',
      sql`${t.contactPhone} ~ '^\\+91[6-9][0-9]{9}$'`,
    ),
    check('orders_subtotal_check', sql`${t.subtotalPaise} >= 0`),
    check('orders_discount_check', sql`${t.discountPaise} >= 0`),
    check('orders_shipping_fee_check', sql`${t.shippingFeePaise} >= 0`),
    check('orders_cod_fee_check', sql`${t.codFeePaise} >= 0`),
    check('orders_gift_wrap_total_check', sql`${t.giftWrapTotalPaise} >= 0`),
    check('orders_total_check', sql`${t.totalPaise} >= 0`),
    check(
      'orders_total_math_check',
      sql`${t.totalPaise} = ${t.subtotalPaise} - ${t.discountPaise} + ${t.shippingFeePaise} + ${t.codFeePaise} + ${t.giftWrapTotalPaise}`,
    ),
    index('orders_customer_idx')
      .on(t.customerId, t.placedAt.desc())
      .where(sql`${t.customerId} IS NOT NULL`),
    index('orders_status_idx').on(t.status, t.placedAt.desc()),
    // admin ops queue: partial, tiny & hot
    index('orders_open_ops_idx')
      .on(t.placedAt)
      .where(
        sql`${t.status} IN ('cod_pending_confirmation', 'confirmed', 'packed')`,
      ),
    // guest lookup + COD abuse checks
    index('orders_phone_idx').on(t.contactPhone),
    // stuck-payment expiry sweep
    index('orders_pending_expiry_idx')
      .on(t.placedAt)
      .where(sql`${t.status} = 'pending_payment'`),
  ],
);

/**
 * Immutable invoice lines. Everything the GST invoice needs is denormalized
 * here so history renders identically forever. `variant_id` is RESTRICT —
 * variants are archived, never deleted.
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    productName: text('product_name').notNull(), // SNAPSHOT
    variantName: text('variant_name').notNull(), // SNAPSHOT
    sku: text('sku').notNull(), // SNAPSHOT
    imageUrl: text('image_url'), // SNAPSHOT
    hsnCode: text('hsn_code').notNull(), // SNAPSHOT
    gstRateBp: integer('gst_rate_bp').notNull(), // SNAPSHOT
    unitPricePaise: integer('unit_price_paise').notNull(), // SNAPSHOT (GST-inclusive)
    quantity: integer('quantity').notNull(),
    lineTotalPaise: integer('line_total_paise').notNull(), // unit*qty + gift_wrap_fee
    taxableValuePaise: integer('taxable_value_paise').notNull(), // line_total − line tax
    cgstPaise: integer('cgst_paise').notNull().default(0),
    sgstPaise: integer('sgst_paise').notNull().default(0),
    igstPaise: integer('igst_paise').notNull().default(0),
    giftWrap: boolean('gift_wrap').notNull().default(false),
    giftWrapFeePaise: integer('gift_wrap_fee_paise').notNull().default(0), // SNAPSHOT of settings
    giftMessage: text('gift_message'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('order_items_unit_price_check', sql`${t.unitPricePaise} > 0`),
    check('order_items_quantity_check', sql`${t.quantity} > 0`),
    check(
      'order_items_gift_message_check',
      sql`char_length(${t.giftMessage}) <= 300`,
    ),
    index('order_items_order_idx').on(t.orderId),
    // "customers also bought" + sales-by-SKU
    index('order_items_variant_idx').on(t.variantId),
  ],
);

/** Append-only transition log: every state change with actor and cause. */
export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatusEnum('from_status'), // NULL for creation
    toStatus: orderStatusEnum('to_status').notNull(),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: uuid('actor_id'), // admin_users.id / customers.id / NULL
    note: text('note'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('osh_order_idx').on(t.orderId, t.createdAt)],
);
