/**
 * Capability catalog — opt-in feature flags a business enables (seeded by its
 * vertical preset, tunable in admin). Modules and fields REQUIRE capabilities;
 * they never ask for a business type (docs/admin-platform §2.3). This is the
 * mechanism that lets food/beverage specifics and general retail coexist in one
 * codebase with zero `if (chocolate)` branches.
 */

export const CAPABILITY_KEYS = [
  /** Multi-variant products (size/weight/pack). */
  'variants',
  /** Shelf-life, storage instructions, use-by handling. */
  'perishable',
  /** Batch/lot tracking with per-batch expiry (FEFO). */
  'batch-expiry',
  /** Temperature handling + seasonal shipping rules + melt policy. */
  'cold-chain',
  /** Veg / non-veg mark (India FSSAI). */
  'veg-mark',
  /** Allergen declarations. */
  'allergens',
  /** Weight/dimension-driven shipping rates. */
  'weight-shipping',
  /** Pincode/zone serviceability checks. */
  'serviceability',
  /** Tax-inclusive pricing with extraction + split (e.g. India GST). */
  'tax-inclusive',
  /** Tax classification codes (e.g. HSN). */
  'hsn-codes',
  /** Menu items (restaurant). */
  'menu',
  /** Add-on / modifier groups (restaurant). */
  'modifiers',
  /** Dine-in tables + KOT (restaurant). */
  'table-orders',
  /** Engraving / gift messages / personalisation. */
  'personalization',
  /** Recurring / subscription orders. */
  'subscriptions',
] as const;

export type Capability = (typeof CAPABILITY_KEYS)[number];

export function isCapability(value: string): value is Capability {
  return (CAPABILITY_KEYS as readonly string[]).includes(value);
}

export interface CapabilityMeta {
  readonly key: Capability;
  readonly label: string;
  readonly description: string;
}

export const CAPABILITY_CATALOG: readonly CapabilityMeta[] = [
  { key: 'variants', label: 'Variants', description: 'Products have multiple variants (size, weight, pack).' },
  { key: 'perishable', label: 'Perishable', description: 'Shelf-life, storage instructions and use-by handling.' },
  { key: 'batch-expiry', label: 'Batch & expiry', description: 'Batch/lot tracking with per-batch expiry (FEFO).' },
  { key: 'cold-chain', label: 'Cold chain', description: 'Temperature handling and seasonal shipping rules.' },
  { key: 'veg-mark', label: 'Veg / non-veg mark', description: 'Vegetarian / non-vegetarian mark (India FSSAI).' },
  { key: 'allergens', label: 'Allergens', description: 'Allergen declarations on products.' },
  { key: 'weight-shipping', label: 'Weight-based shipping', description: 'Shipping rates derived from weight and dimensions.' },
  { key: 'serviceability', label: 'Serviceability', description: 'Pincode / zone delivery serviceability checks.' },
  { key: 'tax-inclusive', label: 'Tax-inclusive pricing', description: 'Prices include tax; tax is extracted and split.' },
  { key: 'hsn-codes', label: 'Tax classification codes', description: 'Products carry tax classification codes (e.g. HSN).' },
  { key: 'menu', label: 'Menu', description: 'Menu items (restaurant / food service).' },
  { key: 'modifiers', label: 'Modifiers', description: 'Add-on and modifier groups.' },
  { key: 'table-orders', label: 'Table orders', description: 'Dine-in tables and kitchen order tickets.' },
  { key: 'personalization', label: 'Personalisation', description: 'Engraving, gift messages, custom options.' },
  { key: 'subscriptions', label: 'Subscriptions', description: 'Recurring / subscription orders.' },
];
