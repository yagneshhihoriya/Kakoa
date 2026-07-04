/**
 * Customer identity & auth — Contract §1.6–1.9 (DATABASE_ERD.md §3.6–3.9).
 * customers, customer_sessions, otp_challenges, customer_addresses.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { otpChannelEnum, otpPurposeEnum } from './enums';
import { citext, timestamptz } from './helpers';

/** Passwordless identities; row created on first successful OTP verify. */
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    phone: text('phone').unique(),
    email: citext('email').unique(),
    phoneVerifiedAt: timestamptz('phone_verified_at'),
    emailVerifiedAt: timestamptz('email_verified_at'),
    name: text('name'),
    isBlocked: boolean('is_blocked').notNull().default(false), // serial-RTO abusers
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'customers_phone_format_check',
      sql`${t.phone} ~ '^\\+91[6-9][0-9]{9}$'`,
    ),
    check(
      'customers_contact_check',
      sql`${t.phone} IS NOT NULL OR ${t.email} IS NOT NULL`,
    ),
  ],
);

/** Opaque revocable sessions — DB stores only the SHA-256 of the token. */
export const customerSessions = pgTable(
  'customer_sessions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    userAgent: text('user_agent'),
    ip: inet('ip'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('customer_sessions_customer_idx')
      .on(t.customerId)
      .where(sql`${t.revokedAt} IS NULL`),
  ],
);

/**
 * One row per issued OTP code, all purposes. No FKs by design — keyed by
 * destination + purpose. Rate limits are enforced by counting rows here.
 */
export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    channel: otpChannelEnum('channel').notNull(),
    destination: text('destination').notNull(), // E.164 phone or lowercased email
    purpose: otpPurposeEnum('purpose').notNull(),
    codeHash: text('code_hash').notNull(), // sha256(code || pepper)
    context: jsonb('context'), // e.g. {"order_number":"KK-48210"}
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamptz('expires_at').notNull(),
    consumedAt: timestamptz('consumed_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    ip: inet('ip'),
  },
  (t) => [
    check('otp_challenges_attempts_check', sql`${t.attempts} <= 5`),
    // hot path only scans open challenges
    index('otp_open_idx')
      .on(t.destination, t.purpose, t.createdAt.desc())
      .where(sql`${t.consumedAt} IS NULL`),
    // send-rate window counts
    index('otp_rate_idx').on(t.destination, t.createdAt),
  ],
);

/** Saved address book. Orders snapshot — never reference — these rows. */
export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    label: text('label').notNull().default('Home'),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    line1: text('line1').notNull(),
    line2: text('line2'),
    landmark: text('landmark'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    stateCode: char('state_code', { length: 2 }).notNull(), // GST state code, e.g. '27'
    pincode: char('pincode', { length: 6 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'customer_addresses_phone_check',
      sql`${t.phone} ~ '^\\+91[6-9][0-9]{9}$'`,
    ),
    check(
      'customer_addresses_pincode_check',
      sql`${t.pincode} ~ '^[1-9][0-9]{5}$'`,
    ),
    uniqueIndex('customer_addresses_one_default_idx')
      .on(t.customerId)
      .where(sql`${t.isDefault}`),
  ],
);
