/**
 * Vertical presets (docs/admin-platform §2.2, §2.4, Decision A5).
 *
 * A preset is a STARTING TEMPLATE for a kind of business — it seeds default
 * capabilities, a product attribute schema, tax defaults and starter categories.
 * Everything is overridable per business; a preset is never a code branch.
 *
 * "Kakao" = general commerce kernel + the `chocolate` preset + a Business
 * Profile. No chocolate logic lives in code — only in this preset's data.
 */
import type { Capability } from './capabilities';

/** A configurable product attribute — replaces hardcoded columns like `tone`. */
export interface AttributeDef {
  readonly key: string;
  readonly label: string;
  readonly type: 'text' | 'number' | 'enum' | 'multi-enum' | 'boolean' | 'rich';
  readonly options?: readonly string[];
  readonly required?: boolean;
  /** Only shown/validated when this capability is enabled. */
  readonly capability?: Capability;
  /** UI grouping ('Origin', 'Nutrition'). */
  readonly group?: string;
  readonly showOnPdp?: boolean;
  readonly unit?: string;
}

export interface TaxDefault {
  /** Human tax category ('Chocolate & cocoa', 'Bakery'). */
  readonly category: string;
  /** Rate in basis points (500 = 5%). */
  readonly rateBp: number;
  /** Classification code system, if any. */
  readonly codeSystem?: 'HSN';
  /** Default classification code (e.g. HSN '1806'). */
  readonly code?: string;
}

export interface CategorySeed {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
}

export type PresetKey =
  | 'chocolate'
  | 'bakery'
  | 'coffee'
  | 'tea'
  | 'snacks'
  | 'grocery'
  | 'restaurant'
  | 'food-delivery'
  | 'organic'
  | 'gifts'
  | 'general';

export interface VerticalPreset {
  readonly key: PresetKey;
  readonly label: string;
  /** Turned on by default for this vertical (business may tune). */
  readonly capabilities: readonly Capability[];
  /** Default product attribute schema. */
  readonly attributeSchema: readonly AttributeDef[];
  readonly taxDefaults: TaxDefault;
  /** Suggested starter categories (fully editable in admin). */
  readonly categoryTaxonomy?: readonly CategorySeed[];
  /** Default net-quantity unit family. */
  readonly units: 'weight' | 'volume' | 'count';
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

const CHOCOLATE: VerticalPreset = {
  key: 'chocolate',
  label: 'Chocolate & confectionery',
  capabilities: [
    'variants',
    'perishable',
    'veg-mark',
    'cold-chain',
    'weight-shipping',
    'serviceability',
    'tax-inclusive',
    'hsn-codes',
    'personalization',
  ],
  attributeSchema: [
    { key: 'cocoa_pct', label: 'Cocoa %', type: 'number', group: 'Origin', showOnPdp: true, unit: '%' },
    { key: 'origin', label: 'Origin', type: 'text', group: 'Origin', showOnPdp: true },
    { key: 'tasting_notes', label: 'Tasting notes', type: 'multi-enum', group: 'Flavour', showOnPdp: true,
      options: ['Cocoa', 'Caramel', 'Berry', 'Nutty', 'Citrus', 'Floral', 'Espresso', 'Spice'] },
    { key: 'tone', label: 'Tone (art direction)', type: 'enum', group: 'Presentation',
      options: ['dark', 'milk', 'caramel', 'ruby', 'white', 'matcha'] },
    { key: 'whatYoullGet', label: "What you'll get", type: 'rich', group: 'Storefront' },
    { key: 'shipping', label: 'Shipping', type: 'rich', group: 'Storefront' },
  ],
  taxDefaults: { category: 'Chocolate & cocoa', rateBp: 500, codeSystem: 'HSN', code: '1806' },
  categoryTaxonomy: [
    { slug: 'bars', name: 'Bars', description: 'Single-origin and flavoured bars.' },
    { slug: 'pralines', name: 'Pralines', description: 'Filled chocolates in small batches.' },
    { slug: 'signature', name: 'Signature', description: 'The signature boxes.' },
    { slug: 'gifts', name: 'Gifts', description: 'Hampers and keepsake boxes.' },
  ],
  units: 'weight',
};

const BAKERY: VerticalPreset = {
  key: 'bakery',
  label: 'Bakery',
  capabilities: ['perishable', 'veg-mark', 'allergens', 'weight-shipping', 'serviceability', 'tax-inclusive'],
  attributeSchema: [
    { key: 'allergens', label: 'Allergens', type: 'multi-enum', group: 'Nutrition', showOnPdp: true,
      capability: 'allergens', options: ['Gluten', 'Egg', 'Milk', 'Nuts', 'Soy', 'Sesame'] },
    { key: 'baked_on_daily', label: 'Baked fresh daily', type: 'boolean', group: 'Freshness' },
    { key: 'contains_egg', label: 'Contains egg', type: 'boolean', capability: 'veg-mark', group: 'Nutrition' },
  ],
  taxDefaults: { category: 'Bakery', rateBp: 500 },
  units: 'count',
};

const COFFEE: VerticalPreset = {
  key: 'coffee',
  label: 'Coffee',
  capabilities: ['variants', 'weight-shipping', 'serviceability', 'tax-inclusive'],
  attributeSchema: [
    { key: 'roast_level', label: 'Roast level', type: 'enum', group: 'Profile', showOnPdp: true,
      options: ['Light', 'Medium', 'Medium-dark', 'Dark'] },
    { key: 'origin', label: 'Origin', type: 'text', group: 'Profile', showOnPdp: true },
    { key: 'process', label: 'Process', type: 'enum', group: 'Profile',
      options: ['Washed', 'Natural', 'Honey', 'Anaerobic'] },
    { key: 'grind', label: 'Grind', type: 'enum', group: 'Format',
      options: ['Whole bean', 'Espresso', 'Filter', 'French press'] },
  ],
  taxDefaults: { category: 'Coffee', rateBp: 500 },
  units: 'weight',
};

const GROCERY: VerticalPreset = {
  key: 'grocery',
  label: 'Grocery',
  capabilities: ['perishable', 'veg-mark', 'batch-expiry', 'weight-shipping', 'serviceability', 'tax-inclusive'],
  attributeSchema: [
    { key: 'brand', label: 'Brand', type: 'text', group: 'Product', showOnPdp: true },
    { key: 'unit_size', label: 'Unit size', type: 'text', group: 'Product', showOnPdp: true },
  ],
  taxDefaults: { category: 'Grocery', rateBp: 500 },
  units: 'count',
};

const RESTAURANT: VerticalPreset = {
  key: 'restaurant',
  label: 'Restaurant',
  capabilities: ['menu', 'modifiers', 'table-orders', 'veg-mark', 'perishable'],
  attributeSchema: [
    { key: 'spice_level', label: 'Spice level', type: 'enum', group: 'Menu',
      options: ['Mild', 'Medium', 'Hot'] },
    { key: 'dietary', label: 'Dietary', type: 'multi-enum', group: 'Menu',
      options: ['Veg', 'Vegan', 'Jain', 'Gluten-free'] },
  ],
  taxDefaults: { category: 'Restaurant', rateBp: 500 },
  units: 'count',
};

const GIFTS: VerticalPreset = {
  key: 'gifts',
  label: 'Gifts',
  capabilities: ['variants', 'personalization', 'weight-shipping', 'serviceability', 'tax-inclusive'],
  attributeSchema: [
    { key: 'material', label: 'Material', type: 'text', group: 'Product' },
    { key: 'occasion', label: 'Occasion', type: 'multi-enum', group: 'Product',
      options: ['Birthday', 'Anniversary', 'Wedding', 'Festive', 'Corporate'] },
  ],
  taxDefaults: { category: 'Gifts', rateBp: 1200 },
  units: 'count',
};

const GENERAL: VerticalPreset = {
  key: 'general',
  label: 'General e-commerce',
  capabilities: ['variants', 'weight-shipping', 'serviceability', 'tax-inclusive'],
  attributeSchema: [],
  taxDefaults: { category: 'General', rateBp: 1800 },
  units: 'count',
};

/** Registry of shipped presets. Verticals not yet fleshed out fall back to GENERAL. */
export const PRESETS: Record<PresetKey, VerticalPreset> = {
  chocolate: CHOCOLATE,
  bakery: BAKERY,
  coffee: COFFEE,
  tea: { ...COFFEE, key: 'tea', label: 'Tea',
    attributeSchema: [
      { key: 'tea_type', label: 'Type', type: 'enum', group: 'Profile', showOnPdp: true,
        options: ['Black', 'Green', 'Oolong', 'White', 'Herbal', 'Chai'] },
      { key: 'caffeine', label: 'Caffeine', type: 'enum', group: 'Profile',
        options: ['None', 'Low', 'Medium', 'High'] },
    ],
    taxDefaults: { category: 'Tea', rateBp: 500 } },
  snacks: { ...GROCERY, key: 'snacks', label: 'Snacks' },
  grocery: GROCERY,
  restaurant: RESTAURANT,
  'food-delivery': { ...RESTAURANT, key: 'food-delivery', label: 'Food delivery' },
  organic: { ...GROCERY, key: 'organic', label: 'Organic products' },
  gifts: GIFTS,
  general: GENERAL,
};

export function getPreset(key: PresetKey): VerticalPreset {
  return PRESETS[key] ?? GENERAL;
}
