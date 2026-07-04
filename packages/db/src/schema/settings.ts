/**
 * `store_settings` — Contract §1.1 (DATABASE_ERD.md §3.1).
 *
 * Singleton key/value config for legally required display data and fee
 * policy. Keys: 'fssai_license_number', 'seller_gstin', 'seller_state_code',
 * 'seller_legal_name', 'seller_address', 'origin_pincode',
 * 'shipping_fee_standard_paise', 'shipping_fee_express_paise',
 * 'free_shipping_threshold_paise', 'cod_fee_paise', 'gift_wrap_fee_paise',
 * 'payment_expiry_minutes', 'support_phone', 'support_email'.
 * Orders snapshot every fee value at placement — changes are never retroactive.
 */
import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { adminUsers } from './admin';
import { timestamptz } from './helpers';

export const storeSettings = pgTable('store_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => adminUsers.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
