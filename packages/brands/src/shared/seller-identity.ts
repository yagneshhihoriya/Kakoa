/**
 * The ONE legal entity behind every brand this codebase ships. KAKOA and
 * Khakhra House are trade names of the same company (owner decision,
 * 2026-11-02): same registered name, GSTIN, address, state code, origin
 * pincode, FSSAI licence and support desk. Each brand profile spreads these
 * blocks into its own `seedLegalIdentity` / `defaults` so the literals exist
 * exactly once — a correction here reaches every brand seed.
 *
 * SEED-ONLY data, like `seedLegalIdentity` itself: nothing at runtime reads
 * this module; runtime identity comes from store_settings alone.
 */
import type { BrandLegalIdentity, BrandSettingsDefaults } from '../contract';

export const SELLER_LEGAL_IDENTITY = {
  seller_legal_name: 'Kakao Chocolates Private Limited',
  seller_gstin: '27AABCK4321M1Z5',
  seller_state_code: '27',
  seller_address:
    'Unit 12, Veera Desai Industrial Estate, Andheri West, Mumbai 400053, Maharashtra, India',
  origin_pincode: '400053',
  fssai_license_number: '11525023000841',
} as const satisfies BrandLegalIdentity;

/** The shared support desk (store_settings support_* rows). */
export const SELLER_SUPPORT_CONTACT = {
  support_phone: '+919820012345',
  support_email: 'support@kakoa.in',
  support_hours: 'Monday to Saturday, 10:00–18:00 IST',
} as const satisfies Pick<BrandSettingsDefaults, 'support_phone' | 'support_email' | 'support_hours'>;
