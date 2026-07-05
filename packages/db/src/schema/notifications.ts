/**
 * Notifications — editable transactional templates (DB overrides over the code
 * defaults) + an append-only send log (HANDOFF-Notifications). The CODE templates
 * remain the fallback; a row here overrides the copy for one (key, channel).
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { adminUsers } from './admin';
import { orders } from './orders';
import { timestamptz } from './helpers';

/** Per-event×channel copy override. Absent / inactive ⇒ the code default is used. */
export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    key: text('key').notNull(), // event key, e.g. 'order_confirmed', 'order_shipped'
    channel: text('channel').notNull(), // 'email' | 'sms'
    subject: text('subject'), // email only
    body: text('body').notNull(), // template with {{placeholders}}
    isActive: boolean('is_active').notNull().default(true),
    updatedBy: uuid('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('notification_templates_key_channel_uq').on(t.key, t.channel),
    check('notification_templates_channel_check', sql`${t.channel} IN ('email', 'sms')`),
  ],
);

/** Append-only send history. Recipient is stored MASKED (never full PII). */
export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    channel: text('channel').notNull(), // 'email' | 'sms'
    templateKey: text('template_key').notNull(),
    recipient: text('recipient').notNull(), // MASKED
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    status: text('status').notNull(), // 'sent' | 'failed' | 'skipped'
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('notification_log_channel_check', sql`${t.channel} IN ('email', 'sms')`),
    check('notification_log_status_check', sql`${t.status} IN ('sent', 'failed', 'skipped')`),
    index('notification_log_created_idx').on(t.createdAt.desc()),
  ],
);
