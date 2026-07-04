/**
 * Shipments — Contract §1.19–1.20 (DATABASE_ERD.md §3.19–3.20).
 * One ACTIVE shipment per order (partial unique on `superseded_at IS NULL`).
 * Holds all Shiprocket handles: SR order/shipment ids, AWB, courier, label.
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
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { shipmentStatusEnum } from './enums';
import { timestamptz } from './helpers';
import { orders } from './orders';

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    shiprocketOrderId: text('shiprocket_order_id'),
    shiprocketShipmentId: text('shiprocket_shipment_id'),
    awbCode: text('awb_code').unique(), // courier tracking number; webhook correlation key
    courierCompanyId: integer('courier_company_id'),
    courierName: text('courier_name'),
    labelUrl: text('label_url'),
    manifestUrl: text('manifest_url'),
    status: shipmentStatusEnum('status').notNull().default('pending'),
    cod: boolean('cod').notNull().default(false),
    pickupScheduledAt: timestamptz('pickup_scheduled_at'),
    expectedDeliveryAt: timestamptz('expected_delivery_at'), // courier ETD
    lastSyncedAt: timestamptz('last_synced_at'), // polling reconciliation watermark
    supersededAt: timestamptz('superseded_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shipments_one_active_idx')
      .on(t.orderId)
      .where(sql`${t.supersededAt} IS NULL`),
    // 30-min reconciliation cron scans this
    index('shipments_stale_poll_idx')
      .on(t.lastSyncedAt)
      .where(
        sql`${t.supersededAt} IS NULL AND ${t.status} IN ('awb_assigned', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'rto_initiated', 'rto_in_transit')`,
      ),
  ],
);

/**
 * Append-only courier scan log from webhooks AND polling; `source`
 * disambiguates. Dedup by natural key so retried webhooks and poll overlap
 * never double-insert.
 */
export const shipmentEvents = pgTable(
  'shipment_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    status: shipmentStatusEnum('status').notNull(), // mapped from SR status code
    srStatusCode: text('sr_status_code'), // raw Shiprocket code, e.g. '17'
    activity: text('activity'),
    location: text('location'),
    occurredAt: timestamptz('occurred_at').notNull(),
    source: text('source').notNull(),
    raw: jsonb('raw'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('shipment_events_dedup_uq').on(t.shipmentId, t.status, t.occurredAt),
    check(
      'shipment_events_source_check',
      sql`${t.source} IN ('webhook', 'poll', 'manual')`,
    ),
    index('shipment_events_shipment_idx').on(t.shipmentId, t.occurredAt),
  ],
);
