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

/** Singular / plural pair for copy interpolation. */
export interface NounForms {
  /** Count noun, one ('chocolate', 'khakhra'). */
  readonly one: string;
  /** Count noun, many ('chocolates', 'khakhras'). */
  readonly many: string;
  /** Mass / collective form for "All chocolate", "Search chocolate…". */
  readonly collective: string;
}

/** Outer parcel dimensions in centimetres (Shiprocket wants all three). */
export interface ParcelCm {
  readonly length: number;
  readonly breadth: number;
  readonly height: number;
}

/**
 * Storefront vocabulary — the words and claims a vertical's storefront is
 * allowed to make. Page code interpolates `noun` / `unitNoun` instead of
 * hardcoding "chocolates" / "pieces", reads its shipping claims from
 * `packaging`, and renders every cold-chain policy clause (ribbon, legal
 * §6/§2/§5, invoice footer) ONLY when `coldChain` is true.
 */
export interface StorefrontVocabulary {
  readonly noun: NounForms;
  /** What a category's product count is counted in ('piece', 'pack'). */
  readonly unitNoun: Pick<NounForms, 'one' | 'many'>;
  /** Temperature-controlled shipping is part of the offer (melt policy etc.). */
  readonly coldChain: boolean;
  /**
   * How the vertical says its parcels travel — the ONE place the storefront,
   * checkout and admin read a shipping claim from, so a cold-chain vertical
   * can promise ice packs while a shelf-stable one promises careful packing.
   * `{unit}` in `pdpBullet` is replaced with `unitNoun.one`.
   */
  readonly packaging: PackagingClaims;
  readonly searchPlaceholder: string;
  /** Idle-state search chips. */
  readonly popularSearches: readonly string[];
  /**
   * Customer-facing labels for the fixed `return_reason` enum values (the
   * Postgres enum stays `damaged_or_melted`; the label is the vertical's).
   */
  readonly returnReasonLabels: Readonly<Record<string, string>>;
  /** Parcel dimensions used when no variant on the order carries its own. */
  readonly defaultParcelCm: ParcelCm;
}

/** The shipping claims a vertical's storefront makes (see `packaging`). */
export interface PackagingClaims {
  /** Cart trust-line label and admin shipping-copy hint; null adds none. */
  readonly trustLabel: string | null;
  /** Checkout: the one-line note under the standard delivery option. */
  readonly standardDelivery: string;
  /** PDP shipping accordion: the first bullet (`{unit}` → `unitNoun.one`). */
  readonly pdpBullet: string;
  /** PDP "What you'll get" default when the product carries no admin copy. */
  readonly whatYoullGet: string;
}

/** A two-stop gradient swatch — the image placeholder art direction. */
export interface Swatch {
  readonly from: string;
  readonly to: string;
}

/**
 * Presentation defaults — the placeholder swatch palette keyed by
 * `products.tone` value. The admin's tone picker lists these keys; the
 * storefront falls back to `defaultSwatch` for an unknown stored value.
 */
export interface Presentation {
  readonly swatches: Readonly<Record<string, Swatch>>;
  /** Key into `swatches`. */
  readonly defaultSwatch: string;
}

/** Every shipped vertical, as a tuple so config layers can build an enum from it. */
export const PRESET_KEYS = [
  'chocolate',
  'bakery',
  'coffee',
  'tea',
  'snacks',
  'grocery',
  'restaurant',
  'food-delivery',
  'organic',
  'gifts',
  'general',
] as const;

export type PresetKey = (typeof PRESET_KEYS)[number];

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
  readonly storefront: StorefrontVocabulary;
  readonly presentation: Presentation;
}

/* ------------------------------------------------------------------ */
/* Neutral vocabulary / presentation (the fallback for every vertical)  */
/* ------------------------------------------------------------------ */

/** Return-reason labels that read correctly for any packaged product. */
const NEUTRAL_RETURN_REASON_LABELS = {
  damaged_or_melted: 'Damaged in transit',
  wrong_item: 'Wrong item received',
  quality_issue: 'Quality issue',
  changed_mind: 'Changed my mind',
  other: 'Other',
} as const satisfies Readonly<Record<string, string>>;

/** Shipping claims any shelf-stable, packaged product can make. */
const NEUTRAL_PACKAGING: PackagingClaims = {
  trustLabel: null,
  standardDelivery: 'Tracked, packed with care',
  pdpBullet: 'Packed securely so every {unit} arrives in perfect condition.',
  whatYoullGet:
    'Freshly made in small batches and packed ready to enjoy or gift. Every order is packed securely so it arrives in perfect condition.',
};

/** Brand-neutral copy an unknown or generic vertical renders. */
export const GENERAL_VOCABULARY: StorefrontVocabulary = {
  noun: { one: 'product', many: 'products', collective: 'products' },
  unitNoun: { one: 'item', many: 'items' },
  coldChain: false,
  packaging: NEUTRAL_PACKAGING,
  searchPlaceholder: 'Search products, gifts, collections…',
  popularSearches: [],
  returnReasonLabels: NEUTRAL_RETURN_REASON_LABELS,
  defaultParcelCm: { length: 10, breadth: 10, height: 10 },
};

/** Six muted material swatches that suit any catalogue without photography. */
export const GENERAL_PRESENTATION: Presentation = {
  swatches: {
    slate: { from: '#5b6470', to: '#2f3640' },
    sand: { from: '#d9c3a0', to: '#a98a5c' },
    clay: { from: '#c0795a', to: '#7d4330' },
    olive: { from: '#8f9a5e', to: '#55603a' },
    ivory: { from: '#f1ebdf', to: '#d6c9b0' },
    plum: { from: '#8e6a86', to: '#4f3449' },
  },
  defaultSwatch: 'slate',
};

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
    // Free text ("Cocoa, Dried fig, Espresso") — migration 0006 moved the former
    // `products.tasting_notes` column here as a comma-joined string.
    { key: 'tasting_notes', label: 'Tasting notes', type: 'text', group: 'Flavour', showOnPdp: true },
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
  storefront: {
    noun: { one: 'chocolate', many: 'chocolates', collective: 'chocolate' },
    unitNoun: { one: 'piece', many: 'pieces' },
    coldChain: true,
    packaging: {
      trustLabel: 'Ships cold & insulated',
      standardDelivery: 'Insulated, ships cold & safe',
      pdpBullet: 'Ships cold & insulated — packed with ice packs so every {unit} arrives perfect.',
      whatYoullGet:
        'Freshly made in small batches and packed ready to enjoy or gift. Every order ships cold and insulated so it arrives in perfect condition.',
    },
    searchPlaceholder: 'Search chocolates, gifts, collections…',
    popularSearches: ['Dark chocolate', 'Gift box', 'Truffles', 'Single origin', 'Sea salt'],
    returnReasonLabels: { ...NEUTRAL_RETURN_REASON_LABELS, damaged_or_melted: 'Damaged or melted' },
    defaultParcelCm: { length: 10, breadth: 10, height: 10 },
  },
  // The prototype's molded-chocolate tone studies. Order matters: the home
  // collection tiles fall back to these by category position.
  presentation: {
    swatches: {
      dark: { from: '#4a2e1c', to: '#2c150a' },
      milk: { from: '#a06a3c', to: '#623f22' },
      ruby: { from: '#b8827a', to: '#6f3d38' },
      caramel: { from: '#e0a457', to: '#a86a2c' },
      white: { from: '#f2e6d2', to: '#dcc6a2' },
      matcha: { from: '#9aa863', to: '#5f6e39' },
    },
    defaultSwatch: 'dark',
  },
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
  storefront: GENERAL_VOCABULARY,
  presentation: GENERAL_PRESENTATION,
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
  storefront: {
    ...GENERAL_VOCABULARY,
    noun: { one: 'coffee', many: 'coffees', collective: 'coffee' },
    unitNoun: { one: 'bag', many: 'bags' },
    searchPlaceholder: 'Search coffees, roasts, origins…',
  },
  presentation: GENERAL_PRESENTATION,
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
  storefront: GENERAL_VOCABULARY,
  presentation: GENERAL_PRESENTATION,
};

/**
 * Packaged snacks (khakhra, namkeen, biscuits…): variant-driven (pack size ×
 * flavour), shelf-stable — NO cold chain — veg-marked, allergen-declared, HSN
 * coded. Starter HSN 1905 (bakers' wares) at NIL; flavoured lines that attract
 * GST are set per variant in the Taxes module. A brand tunes labels, options and
 * categories through `presetOverrides` rather than a kernel edit.
 */
const SNACKS: VerticalPreset = {
  key: 'snacks',
  label: 'Snacks',
  capabilities: [
    'variants',
    'perishable',
    'veg-mark',
    'allergens',
    'weight-shipping',
    'serviceability',
    'tax-inclusive',
    'hsn-codes',
  ],
  attributeSchema: [
    { key: 'pack_size', label: 'Pack size', type: 'enum', group: 'Pack', showOnPdp: true,
      options: ['200 g', '400 g', '1 kg'] },
    { key: 'flavour', label: 'Flavour', type: 'enum', group: 'Flavour', showOnPdp: true,
      options: ['Plain', 'Methi', 'Masala', 'Jeera', 'Pudina', 'Multigrain'] },
    { key: 'spice_level', label: 'Spice level', type: 'enum', group: 'Flavour', showOnPdp: true,
      options: ['Mild', 'Medium', 'Hot'] },
    { key: 'region', label: 'Region', type: 'text', group: 'Origin', showOnPdp: true },
    { key: 'allergens', label: 'Allergens', type: 'multi-enum', group: 'Nutrition', showOnPdp: true,
      capability: 'allergens', options: ['Wheat (gluten)', 'Milk', 'Nuts', 'Soy', 'Sesame'] },
    { key: 'serving_suggestion', label: 'Serving suggestion', type: 'rich', group: 'Storefront' },
    { key: 'whatYoullGet', label: "What you'll get", type: 'rich', group: 'Storefront' },
    { key: 'shipping', label: 'Shipping', type: 'rich', group: 'Storefront' },
  ],
  taxDefaults: { category: 'Khakhra / bakery products', rateBp: 0, codeSystem: 'HSN', code: '1905' },
  categoryTaxonomy: [
    { slug: 'plain-classic', name: 'Plain & Classic', description: 'The everyday staples, roasted thin and crisp.' },
    { slug: 'masala-flavoured', name: 'Masala & Flavoured', description: 'Spiced and seasoned varieties.' },
    { slug: 'multigrain-health', name: 'Multigrain & Health', description: 'Whole grains, millets and lighter blends.' },
    { slug: 'gift-packs', name: 'Gift Packs & Combos', description: 'Assorted boxes and bundles.' },
  ],
  units: 'weight',
  storefront: {
    noun: { one: 'snack', many: 'snacks', collective: 'snacks' },
    unitNoun: { one: 'pack', many: 'packs' },
    coldChain: false,
    packaging: NEUTRAL_PACKAGING,
    searchPlaceholder: 'Search snacks, flavours, gift packs…',
    popularSearches: ['Plain', 'Masala', 'Multigrain', 'Gift packs', 'Methi'],
    returnReasonLabels: { ...NEUTRAL_RETURN_REASON_LABELS, damaged_or_melted: 'Damaged or crushed' },
    // Snack boxes are large and light — a 10 cm cube under-declares volume.
    defaultParcelCm: { length: 30, breadth: 20, height: 10 },
  },
  presentation: {
    swatches: {
      wheat: { from: '#d9b47a', to: '#9c7340' },
      turmeric: { from: '#e3a93a', to: '#a5701a' },
      chilli: { from: '#c8603f', to: '#7f3220' },
      mint: { from: '#8fae7a', to: '#536b44' },
      sesame: { from: '#efe3c9', to: '#c9b58f' },
      jaggery: { from: '#8a5a34', to: '#4e2f18' },
    },
    defaultSwatch: 'wheat',
  },
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
  storefront: GENERAL_VOCABULARY,
  presentation: GENERAL_PRESENTATION,
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
  storefront: GENERAL_VOCABULARY,
  presentation: GENERAL_PRESENTATION,
};

const GENERAL: VerticalPreset = {
  key: 'general',
  label: 'General e-commerce',
  capabilities: ['variants', 'weight-shipping', 'serviceability', 'tax-inclusive'],
  attributeSchema: [],
  taxDefaults: { category: 'General', rateBp: 1800 },
  units: 'count',
  storefront: GENERAL_VOCABULARY,
  presentation: GENERAL_PRESENTATION,
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
    taxDefaults: { category: 'Tea', rateBp: 500 },
    storefront: {
      ...GENERAL_VOCABULARY,
      noun: { one: 'tea', many: 'teas', collective: 'tea' },
      unitNoun: { one: 'tin', many: 'tins' },
      searchPlaceholder: 'Search teas, blends, origins…',
    } },
  snacks: SNACKS,
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

/* ------------------------------------------------------------------ */
/* Per-business overrides                                              */
/* ------------------------------------------------------------------ */

/**
 * The slice of a preset a business profile may tune without forking the
 * kernel. Merge rules (see `resolvePreset`): scalars and `taxDefaults` fields
 * override individually; `capabilities` and `categoryTaxonomy` REPLACE the
 * preset's list wholesale; `attributeSchema` merges BY KEY — a matching key
 * patches that attribute in place, a new key is appended; `storefront` and
 * `presentation` merge field by field (see each field's note).
 */
export interface PresetOverrides {
  readonly label?: string;
  readonly capabilities?: readonly Capability[];
  readonly attributeSchema?: readonly AttributeDef[];
  readonly taxDefaults?: Partial<TaxDefault>;
  readonly categoryTaxonomy?: readonly CategorySeed[];
  readonly units?: VerticalPreset['units'];
  /**
   * Vocabulary fields override individually (`noun` / `unitNoun` /
   * `defaultParcelCm` as whole objects); `returnReasonLabels` merges by key.
   */
  readonly storefront?: Partial<StorefrontVocabulary>;
  /** `swatches` merges by key (a new key is appended); `defaultSwatch` overrides. */
  readonly presentation?: Partial<Presentation>;
}

/** Anything that names a vertical and optionally tunes it (a brand profile). */
export interface PresetSource {
  readonly vertical: PresetKey;
  readonly presetOverrides?: PresetOverrides;
}

/** Drop `undefined` values so a `Partial` can never blank out a base field. */
function definedEntries<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function mergeAttributeSchema(
  base: readonly AttributeDef[],
  overrides: readonly AttributeDef[] | undefined,
): readonly AttributeDef[] {
  if (overrides === undefined) return base;
  const merged = base.map((attr) => {
    const patch = overrides.find((o) => o.key === attr.key);
    return patch === undefined ? attr : { ...attr, ...definedEntries(patch) };
  });
  const baseKeys = new Set(base.map((a) => a.key));
  return [...merged, ...overrides.filter((o) => !baseKeys.has(o.key))];
}

/**
 * The effective preset for a business: `getPreset(vertical)` deep-merged with
 * the profile's `presetOverrides`. Pure; returns the shipped preset object
 * itself when there is nothing to override. The `key` is never overridable —
 * it names the vertical the business IS, not how it is tuned.
 */
export function resolvePreset(source: PresetSource): VerticalPreset {
  const base = getPreset(source.vertical);
  const o = source.presetOverrides;
  if (o === undefined) return base;
  const categoryTaxonomy = o.categoryTaxonomy ?? base.categoryTaxonomy;
  return {
    key: base.key,
    label: o.label ?? base.label,
    capabilities: o.capabilities ?? base.capabilities,
    attributeSchema: mergeAttributeSchema(base.attributeSchema, o.attributeSchema),
    taxDefaults: { ...base.taxDefaults, ...definedEntries(o.taxDefaults ?? {}) },
    ...(categoryTaxonomy === undefined ? {} : { categoryTaxonomy }),
    units: o.units ?? base.units,
    storefront: mergeStorefront(base.storefront, o.storefront),
    presentation: mergePresentation(base.presentation, o.presentation),
  };
}

function mergeStorefront(
  base: StorefrontVocabulary,
  overrides: Partial<StorefrontVocabulary> | undefined,
): StorefrontVocabulary {
  if (overrides === undefined) return base;
  const o = definedEntries(overrides);
  return {
    ...base,
    ...o,
    returnReasonLabels: { ...base.returnReasonLabels, ...(o.returnReasonLabels ?? {}) },
  };
}

function mergePresentation(
  base: Presentation,
  overrides: Partial<Presentation> | undefined,
): Presentation {
  if (overrides === undefined) return base;
  const o = definedEntries(overrides);
  return {
    swatches: { ...base.swatches, ...(o.swatches ?? {}) },
    defaultSwatch: o.defaultSwatch ?? base.defaultSwatch,
  };
}
