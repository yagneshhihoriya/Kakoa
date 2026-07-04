/**
 * Admin identity, sessions, and audit log — Contract §1.26
 * (DATABASE_ERD.md §3.27–3.29).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  inet,
  jsonb,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { adminRoleEnum } from './enums';
import { citext, timestamptz } from './helpers';

/** Passwordless admin users (email OTP, purpose `admin_login`). */
export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: citext('email').notNull().unique(),
  name: text('name').notNull(),
  role: adminRoleEnum('role').notNull().default('staff'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamptz('last_login_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

/** Separate session table from customers — different cookie, 12h lifetime. */
export const adminSessions = pgTable('admin_sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: uuid('admin_user_id')
    .notNull()
    .references(() => adminUsers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamptz('expires_at').notNull(),
  revokedAt: timestamptz('revoked_at'),
  ip: inet('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

/** Append-only record of every mutating admin action. */
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    adminUserId: uuid('admin_user_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(), // 'order.transition', 'refund.initiate', ...
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('admin_audit_entity_idx').on(
      t.entityType,
      t.entityId,
      t.createdAt.desc(),
    ),
  ],
);
