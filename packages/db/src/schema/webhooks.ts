/**
 * `webhook_events` — Contract §1.21 (DATABASE_ERD.md §3.21).
 * The idempotency ledger for all inbound webhooks — the "persist" half of
 * persist-then-ack. `UNIQUE (provider, event_id)` is the dedupe gate.
 * No FKs by design — correlation happens via payload lookup.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { webhookProviderEnum, webhookStatusEnum } from './enums';
import { timestamptz } from './helpers';

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    provider: webhookProviderEnum('provider').notNull(),
    // Razorpay: x-razorpay-event-id header. Shiprocket sends no event id, so
    // event_id = sha256(awb || '|' || current_status || '|' || current_timestamp).
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(), // 'payment.captured' / SR status label
    payload: jsonb('payload').notNull(), // raw body, verbatim
    headers: jsonb('headers'),
    status: webhookStatusEnum('status').notNull().default('received'),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    receivedAt: timestamptz('received_at').notNull().defaultNow(),
    processedAt: timestamptz('processed_at'),
  },
  (t) => [
    unique('webhook_events_provider_event_uq').on(t.provider, t.eventId),
    // worker + ops dashboard only see unfinished
    index('webhook_events_pending_idx')
      .on(t.receivedAt)
      .where(sql`${t.status} IN ('received', 'failed')`),
  ],
);
