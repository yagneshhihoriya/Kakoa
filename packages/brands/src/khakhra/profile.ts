/**
 * Khakhra House — hand-roasted khakhra, the second brand (working name; the
 * owner has not chosen the trade name yet, see docs/brands/PROVISIONING.md).
 *
 * The SAME legal entity as KAKOA (owner decision, 2026-11-02): legal identity
 * and the support desk come from shared/seller-identity.ts; everything else —
 * identity, market, vertical tuning, nav, features and the policy defaults —
 * is this brand's own. Every placeholder business value here is listed under
 * "Values to confirm before launch" in docs/brands/PROVISIONING.md.
 */
import type { BrandProfile } from '../contract';
import { SELLER_LEGAL_IDENTITY, SELLER_SUPPORT_CONTACT } from '../shared/seller-identity';

export const KHAKHRA = {
  key: 'khakhra',
  name: 'Khakhra House',
  // PWA short_name — the contract caps it at 12 characters ("Khakhra House" is 13).
  shortName: 'Khakhra',
  identifierPrefix: 'KH',
  cookiePrefix: 'khakhra',

  vertical: 'snacks',
  // The snacks preset is the template; the brand tunes what it sells. Plain
  // khakhra is HSN 1905 at NIL (the preset's taxDefaults — unchanged here);
  // flavoured lines that attract GST are set per variant by the seed.
  presetOverrides: {
    label: 'Khakhra',
    attributeSchema: [
      { key: 'pack_size', label: 'Pack size', type: 'enum', options: ['200 g', '400 g', '1 kg'] },
      {
        key: 'flavour',
        label: 'Flavour',
        type: 'enum',
        options: ['Plain', 'Methi', 'Masala', 'Jeera', 'Pudina', 'Multigrain'],
      },
      { key: 'spice_level', label: 'Spice level', type: 'enum', options: ['Mild', 'Medium', 'Hot'] },
      {
        key: 'allergens',
        label: 'Allergens',
        type: 'multi-enum',
        options: ['Wheat (gluten)', 'Sesame', 'Milk', 'Nuts', 'Soy'],
      },
    ],
    categoryTaxonomy: [
      { slug: 'plain-classic', name: 'Plain & Everyday', description: 'The everyday staples — wheat, salt, oil and a long slow roast.' },
      { slug: 'masala-flavoured', name: 'Masala & Flavoured', description: 'Methi, jeera, pudina and masala — seasoned into the dough, not dusted on.' },
      { slug: 'multigrain-health', name: 'Multigrain & Millet', description: 'Whole grains, millets and lighter blends for every day.' },
      { slug: 'gift-packs', name: 'Gift Packs & Combos', description: 'Assorted boxes and bundles, ready to give.' },
    ],
    storefront: {
      noun: { one: 'khakhra', many: 'khakhras', collective: 'khakhra' },
      unitNoun: { one: 'pack', many: 'packs' },
      coldChain: false,
      // Room-temperature, shelf-stable parcels — the whole block, as the
      // contract requires; nothing here promises ice packs or insulation.
      packaging: {
        trustLabel: 'Packed crisp, ships anywhere in India',
        standardDelivery: 'Tracked, packed to arrive crisp',
        pdpBullet: 'Packed in a rigid carton so every {unit} arrives crisp and unbroken.',
        whatYoullGet:
          'Hand-roasted in small batches and sealed the same day. Every order travels in a rigid carton at room temperature so it arrives crisp and unbroken.',
      },
      searchPlaceholder: 'Search khakhra, flavours, gift packs…',
      popularSearches: ['Methi', 'Masala', 'Plain', 'Multigrain', 'Gift packs'],
      returnReasonLabels: { damaged_or_melted: 'Damaged or crushed' },
    },
  },

  currency: 'INR',
  country: 'IN',
  locale: 'en-IN',
  availableLanguages: ['en', 'gu', 'hi'],

  // Terracotta field / warm cream — <meta theme-color> and the manifest
  // background_color (`--color-field` / `--color-cream` in the pack's theme.css).
  themeColor: '#8C3B1C',
  backgroundColor: '#FFF7E6',

  seo: {
    description:
      'Hand-roasted khakhra, made in small batches — plain, methi, masala, jeera, pudina and multigrain — packed crisp and shipped anywhere in India.',
  },
  organization: {
    addressRegion: 'Maharashtra',
  },

  features: { journal: false, locator: false, gifting: true, giftWrap: true },
  // Static pages + the gifting shortcut; category links come from the
  // catalogue at render time. No Journal and no locator for this brand.
  nav: {
    primary: [
      { href: '/shop?category=gift-packs', label: 'Gift packs' },
      { href: '/about', label: 'Our story' },
      { href: '/support', label: 'Help' },
    ],
    footerCompany: [
      { href: '/about', label: 'Our story' },
      { href: '/support', label: 'Help centre' },
      { href: '/account/track', label: 'Track an order' },
      { href: '/account', label: 'My account' },
    ],
  },
  // No social profiles until the trade name is chosen.
  social: {},
  email: {
    fromName: 'Khakhra House',
    subjectSuffix: ' · Khakhra House',
    smsPrefix: 'Khakhra House: ',
  },

  // Mirrors KAKOA's fee policy (owner decision) — paise integers; fees are
  // snapshotted at placement, so a later change is not retroactive.
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
    ...SELLER_SUPPORT_CONTACT,
    announcement_segments: [
      'Free shipping on qualifying orders',
      'Hand-roasted in small batches',
      'Ships crisp, anywhere in India',
    ],
    newsletter_offer: '10% off your first order',
    legal_effective_date: '1 January 2027',
    damage_report_window_hours: 48,
    refund_sla_days: '5–7',
    dispatch_sla_days: '1–2',
    delivery_eta_days: '3–7',
    shiprocket_pickup_location: 'Primary',
  },
  // The shared entity's rows, written by the khakhra seed only (no code
  // fallback at runtime — see contract.ts).
  seedLegalIdentity: SELLER_LEGAL_IDENTITY,
} as const satisfies BrandProfile;
