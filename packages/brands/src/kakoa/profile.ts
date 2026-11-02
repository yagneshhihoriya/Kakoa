/**
 * KAKOA — small-batch bean-to-bar chocolate (the original brand).
 *
 * Every literal here was MOVED out of the storefront/admin source so the app
 * is brand-neutral: the former `BRAND` const (lib/seo/site.ts), the admin
 * BusinessProfile identity (lib/admin/context.ts), SETTINGS_CATALOG defaults
 * (lib/admin/settings-schema.ts), the seed's store_settings rows
 * (packages/db/src/seed.ts), the root layout's site description + Organization
 * contact point, and the footer's social / newsletter / announcement copy.
 */
import type { BrandProfile } from '../contract';

export const KAKOA = {
  key: 'kakoa',
  name: 'KAKOA',
  shortName: 'KAKOA',
  identifierPrefix: 'KK',
  cookiePrefix: 'kakoa',

  vertical: 'chocolate',

  currency: 'INR',
  country: 'IN',
  locale: 'en-IN',
  availableLanguages: ['en', 'hi'],

  // Ink / cream — <meta theme-color> and the manifest background_color. The
  // background is the page field (`--color-cream` in the pack's theme.css).
  themeColor: '#2A1D12',
  backgroundColor: '#FEF6EB',

  seo: {
    description:
      'Small-batch bean-to-bar chocolate, crafted in India. Bars, pralines, and signature collections.',
  },
  organization: {
    addressRegion: 'Maharashtra',
  },

  features: { journal: true, locator: true, gifting: true, giftWrap: true },
  // Static pages + the brand's merchandising shortcut; category links come
  // from the catalogue at render time.
  nav: {
    primary: [
      { href: '/shop?category=gifts', label: 'Gifts' },
      { href: '/about', label: 'Our Story' },
      { href: '/journal', label: 'Journal' },
    ],
    footerCompany: [
      { href: '/about', label: 'Our story' },
      { href: '/journal', label: 'Journal' },
      { href: '/locator', label: 'Store locator' },
      { href: '/account', label: 'My account' },
    ],
  },
  social: {
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    pinterest: 'https://pinterest.com',
    youtube: 'https://youtube.com',
  },
  email: {
    fromName: 'KAKOA',
    subjectSuffix: ' · KAKOA',
    smsPrefix: 'KAKOA: ',
  },

  // Contract §1.1 v1 policy values — paise integers; NOT retroactive (fees are
  // snapshotted at placement).
  defaults: {
    grievance_officer_name: 'Grievance Officer',
    country_of_origin: 'India',
    shipping_fee_standard_paise: 4900, // ₹49; free ≥ threshold
    shipping_fee_express_paise: 14900, // ₹149 flat
    free_shipping_threshold_paise: 99900, // ₹999
    gift_wrap_fee_paise: 4900, // ₹49 per line
    cod_enabled: false, // prepaid/online-only launch; flip to true to enable COD
    cod_fee_paise: 4900, // ₹49
    payment_expiry_minutes: 30,
    support_phone: '+919820012345',
    support_email: 'support@kakoa.in',
    support_hours: 'Monday to Saturday, 10:00–18:00 IST',
    // Ribbon / club / policy lines the storefront rendered as literals before
    // the move; the owner overrides them in Admin → Settings.
    announcement_segments: [
      'Complimentary shipping on qualifying orders',
      'Hand-made in small batches',
      'Ships cold & safe',
    ],
    newsletter_offer: '15% off your first box',
    legal_effective_date: '12 July 2026',
    damage_report_window_hours: 48,
    refund_sla_days: '5–7',
    dispatch_sla_days: '1–2',
    delivery_eta_days: '2–7',
    shiprocket_pickup_location: 'Primary',
  },
  // Written by the KAKOA seed only; at runtime the legal identity is whatever
  // store_settings holds (no code fallback — see contract.ts).
  seedLegalIdentity: {
    seller_legal_name: 'Kakao Chocolates Private Limited',
    seller_gstin: '27AABCK4321M1Z5',
    seller_state_code: '27',
    seller_address:
      'Unit 12, Veera Desai Industrial Estate, Andheri West, Mumbai 400053, Maharashtra, India',
    origin_pincode: '400053',
    fssai_license_number: '11525023000841',
  },
} as const satisfies BrandProfile;
