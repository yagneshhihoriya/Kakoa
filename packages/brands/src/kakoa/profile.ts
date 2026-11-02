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

  // Cocoa / cream — manifest + <meta theme-color>.
  themeColor: '#2A1D12',
  backgroundColor: '#FBF6EF',

  seo: {
    description:
      'Small-batch bean-to-bar chocolate, crafted in India. Bars, pralines, and signature collections.',
  },
  organization: {
    addressRegion: 'Maharashtra',
  },

  features: { journal: true, locator: true, gifting: true, giftWrap: true },
  nav: {
    primary: [
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
    seller_legal_name: 'Kakao Chocolates Private Limited',
    seller_gstin: '27AABCK4321M1Z5',
    seller_state_code: '27',
    seller_address:
      'Unit 12, Veera Desai Industrial Estate, Andheri West, Mumbai 400053, Maharashtra, India',
    origin_pincode: '400053',
    fssai_license_number: '11525023000841',
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
  },
  content: {
    announcementSegments: [
      'Complimentary shipping on qualifying orders',
      'Hand-made in small batches',
      'Ships cold & safe',
    ],
    newsletterOffer: '15% off your first box',
    legalEffectiveDate: '12 July 2026',
  },
} as const satisfies BrandProfile;
