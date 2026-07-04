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

/**
 * Permission-based roles (docs/admin-platform §4, Decision A4). A role is a set
 * of `resource:action` permission strings (`'*'` = all, the Owner preset). System
 * presets (owner/admin/manager/staff/viewer) are seeded from `@platform/kernel`
 * SYSTEM_ROLES and marked `is_system`; businesses may add custom roles.
 */
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  /** Stable machine key, unique per instance. */
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  /** Seeded presets cannot be deleted (still editable per policy). */
  isSystem: boolean('is_system').notNull().default(false),
  /** Permission grants; holds `'*'` for the Owner preset. */
  permissions: text('permissions')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

/** Passwordless admin users (email OTP, purpose `admin_login`). */
export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: citext('email').notNull().unique(),
  name: text('name').notNull(),
  /**
   * Legacy coarse role — kept for back-compat during the RBAC migration. The
   * authoritative grant source is `roleId → roles.permissions`; this column is
   * retired once every admin_user has a `role_id`.
   */
  role: adminRoleEnum('role').notNull().default('staff'),
  /** FK to the granular role (nullable during migration; backfilled from `role`). */
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'set null' }),
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
