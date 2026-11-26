/**
 * Khakhra House seed — the starter catalogue for the second brand (working
 * name; docs/brands/PROVISIONING.md). Same legal entity as KAKOA: the
 * store_settings legal rows come from the profile's shared `seedLegalIdentity`
 * via spec.ts → legal-identity.ts, never a literal here.
 *
 * Every business value below is a PLACEHOLDER the owner confirms before
 * launch (prices, pack weights, nutrition, GST on flavoured lines) — the list
 * lives in docs/brands/PROVISIONING.md under "Values to confirm before launch".
 *
 * Tax: plain khakhra is HSN 1905 at NIL (the preset's `taxDefaults`, inherited
 * by variants that set no override). Seasoned lines (methi / masala / jeera and
 * the combo that contains them) carry 500 bp pending the CA's confirmation;
 * the storefront is tax-inclusive, so a rate change re-prices nothing.
 */
import { KHAKHRA } from '@kakoa/brands';
import { resolvePreset } from '@platform/kernel';
import { KAKOA_OWNER } from './kakoa';
import {
  resolveOwner,
  type BrandSeedSpec,
  type CategorySeed,
  type ProductSeed,
  type SeedOwner,
  type VariantSeed,
} from './spec';

/** Same company, same owner — only the display name is the brand's. */
export const KHAKHRA_OWNER: SeedOwner = { email: KAKOA_OWNER.email, name: 'Khakhra House Owner' };

/** GST on seasoned khakhra, pending the CA (plain stays at the preset's 0 bp). */
export const FLAVOURED_GST_RATE_BP = 500;

const PRESET = resolvePreset(KHAKHRA);

/** Khakhra is shelf-stable at room temperature: ~90 days, kept dry. */
const SHELF_LIFE_DAYS = 90;
const STORAGE =
  'Store in an airtight container, away from moisture and direct sunlight. Keeps crisp at room temperature.';

/* ── Placeholder imagery (placehold.co — allowed by next.config remotePatterns) ── */

function placeholder(size: string, bg: string, text: string): string {
  return `https://placehold.co/${size}/${bg}/3B1F0E/png?text=${encodeURIComponent(text).replace(/%20/g, '+')}`;
}

/** Collection tile per taxonomy slug — warm turmeric / terracotta / cream fields. */
const CATEGORY_IMAGES: Readonly<Record<string, string>> = {
  'plain-classic': placeholder('900x700', 'E8C98A', 'Plain & Everyday'),
  'masala-flavoured': placeholder('900x700', 'D98B5A', 'Masala & Flavoured'),
  'multigrain-health': placeholder('900x700', 'C9B58F', 'Multigrain & Millet'),
  'gift-packs': placeholder('900x700', 'E3A93A', 'Gift Packs & Combos'),
};

/* ── Pack sizes — one row per variant; khakhra boxes are large and light ──── */

interface PackSize {
  /** SKU suffix (KH-<FLAVOUR>-<SIZE>). */
  code: string;
  name: string;
  weightGrams: number;
  shipWeightGrams: number;
  lengthCm: string;
  breadthCm: string;
  heightCm: string;
  stock: number;
}

const PACKS: readonly PackSize[] = [
  { code: '200', name: '200 g pack', weightGrams: 200, shipWeightGrams: 340, lengthCm: '20.00', breadthCm: '20.00', heightCm: '7.00', stock: 150 },
  { code: '400', name: '400 g pack', weightGrams: 400, shipWeightGrams: 620, lengthCm: '26.00', breadthCm: '26.00', heightCm: '9.00', stock: 90 },
  { code: '1KG', name: '1 kg family pack', weightGrams: 1000, shipWeightGrams: 1400, lengthCm: '32.00', breadthCm: '32.00', heightCm: '14.00', stock: 40 },
];

/** Three pack-size variants for one flavour family; the 200 g pack is the default. */
function packVariants(
  flavourCode: string,
  pricesPaise: readonly [number, number, number],
  gstRateBp?: number,
): VariantSeed[] {
  return PACKS.map((pack, position) => ({
    sku: `KH-${flavourCode}-${pack.code}`,
    name: pack.name,
    pricePaise: pricesPaise[position] ?? pricesPaise[0],
    ...(gstRateBp === undefined ? {} : { gstRateBp }),
    weightGrams: pack.weightGrams,
    shipWeightGrams: pack.shipWeightGrams,
    lengthCm: pack.lengthCm,
    breadthCm: pack.breadthCm,
    heightCm: pack.heightCm,
    stock: pack.stock,
    isDefault: position === 0,
    position,
  }));
}

/* ── Nutrition — per 100 g PLACEHOLDERS until lab values replace them ──────── */

interface Nutrition {
  energyKcal: number;
  proteinG: number;
  carbohydrateG: number;
  sugarsG: number;
  fatG: number;
  fibreG: number;
  sodiumMg: number;
}

/**
 * The PDP renders this record as rows; the reserved `basis` key names the
 * reference quantity in the heading ("Nutrition · per 100 g").
 */
function nutritionPer100g(n: Nutrition): Record<string, string> {
  return {
    basis: 'per 100 g',
    Energy: `${String(n.energyKcal)} kcal`,
    Protein: `${n.proteinG.toFixed(1)} g`,
    Carbohydrate: `${n.carbohydrateG.toFixed(1)} g`,
    'of which sugars': `${n.sugarsG.toFixed(1)} g`,
    'Total fat': `${n.fatG.toFixed(1)} g`,
    'Dietary fibre': `${n.fibreG.toFixed(1)} g`,
    Sodium: `${String(n.sodiumMg)} mg`,
  };
}

/* ── Products — one flavour family each, pack sizes as variants ────────────── */

// Cross-contact advisory only — the declared allergens come from attributes.allergens
// (the PDP prints "Contains …" from that list, so repeating it here would double up).
const WHEAT_ONLY = 'Made on lines that also handle sesame, milk and tree nuts.';
const WHEAT_SESAME = 'Made on lines that also handle milk and tree nuts.';

function gallery(slug: string, name: string, bg: string): ProductSeed['images'] {
  return [
    { url: placeholder('1200x1200', bg, name), alt: `${name} — a stack of thin, hand-roasted discs` },
    { url: placeholder('1200x1200', 'FFF7E6', `${name} · pack`), alt: `${name} in its sealed pack` },
  ].map((image, i) => ({ ...image, url: `${image.url}&v=${slug}-${String(i + 1)}` }));
}

const PRODUCTS: readonly ProductSeed[] = [
  {
    slug: 'plain-khakhra',
    name: 'Plain Khakhra',
    category: 'plain-classic',
    blurb: 'The everyday classic — whole wheat, a pinch of salt, roasted paper-thin.',
    description:
      'Our house khakhra. Whole-wheat dough is kneaded with a little salt and oil, rolled thin and roasted slowly on a hot tawa until every disc crackles. Nothing else — the one you eat with chai, with chhundo, or straight from the pack.',
    attributes: {
      flavour: 'Plain',
      spice_level: 'Mild',
      region: 'Gujarat',
      allergens: ['Wheat (gluten)'],
      serving_suggestion:
        'Break over a bowl of dal, spread with ghee and jaggery, or top with chhundo for a Gujarati breakfast.',
      whatYoullGet:
        'Thin, evenly roasted whole-wheat discs, around 12 to a 200 g pack, sealed the same day they are roasted.',
    },
    ingredients: 'Whole wheat flour, edible vegetable oil, iodised salt.',
    allergens: WHEAT_ONLY,
    nutritionFacts: nutritionPer100g({ energyKcal: 418, proteinG: 11.8, carbohydrateG: 64.2, sugarsG: 1.4, fatG: 12.6, fibreG: 6.4, sodiumMg: 560 }),
    shelfLifeDays: SHELF_LIFE_DAYS,
    storageInstructions: STORAGE,
    isVeg: true,
    badge: 'Best seller',
    tone: 'wheat',
    images: gallery('plain-khakhra', 'Plain Khakhra', 'E8C98A'),
    variants: packVariants('PLAIN', [14900, 27900, 64900]), // ₹149 / ₹279 / ₹649 — NIL GST
  },
  {
    slug: 'methi-khakhra',
    name: 'Methi Khakhra',
    category: 'masala-flavoured',
    blurb: 'Fresh fenugreek leaves kneaded into the dough — gently bitter, deeply savoury.',
    description:
      'Chopped methi goes into the dough, not onto the surface, so every bite carries its soft bitterness against the toasted wheat. A little turmeric for colour, a touch of green chilli for warmth. The flavour most of Gujarat grew up on.',
    attributes: {
      flavour: 'Methi',
      spice_level: 'Mild',
      region: 'Gujarat',
      allergens: ['Wheat (gluten)'],
      serving_suggestion: 'Best with a glass of chaas or a smear of garlic chutney. Crumble over khichdi.',
      whatYoullGet:
        'Hand-roasted methi discs with the leaves visible in the crumb, around 12 to a 200 g pack.',
    },
    ingredients:
      'Whole wheat flour, fresh fenugreek leaves (methi), edible vegetable oil, iodised salt, turmeric, green chilli, asafoetida.',
    allergens: WHEAT_ONLY,
    nutritionFacts: nutritionPer100g({ energyKcal: 424, proteinG: 12.1, carbohydrateG: 62.9, sugarsG: 1.6, fatG: 13.4, fibreG: 7.1, sodiumMg: 610 }),
    shelfLifeDays: SHELF_LIFE_DAYS,
    storageInstructions: STORAGE,
    isVeg: true,
    badge: 'Best seller',
    tone: 'mint',
    images: gallery('methi-khakhra', 'Methi Khakhra', 'B9C78F'),
    variants: packVariants('METHI', [16900, 31900, 74900], FLAVOURED_GST_RATE_BP), // ₹169 / ₹319 / ₹749
  },
  {
    slug: 'masala-khakhra',
    name: 'Masala Khakhra',
    category: 'masala-flavoured',
    blurb: 'Our house masala — red chilli, coriander, a hint of amchur — roasted into the disc.',
    description:
      'A proper tea-time khakhra. The spice blend is ground in-house and worked into the dough with sesame seeds, then the discs are roasted a shade darker so the masala toasts. Medium heat with a tang that keeps you reaching back.',
    attributes: {
      flavour: 'Masala',
      spice_level: 'Medium',
      region: 'Gujarat',
      allergens: ['Wheat (gluten)', 'Sesame'],
      serving_suggestion: 'Eat as is, or break into pieces for an instant masala chaat with onion and lemon.',
      whatYoullGet:
        'Deeply toasted masala discs flecked with sesame, around 12 to a 200 g pack.',
    },
    ingredients:
      'Whole wheat flour, edible vegetable oil, sesame seeds, red chilli, coriander, cumin, dried mango powder (amchur), iodised salt, turmeric, asafoetida.',
    allergens: WHEAT_SESAME,
    nutritionFacts: nutritionPer100g({ energyKcal: 436, proteinG: 12.4, carbohydrateG: 60.8, sugarsG: 2.1, fatG: 15.2, fibreG: 7.3, sodiumMg: 690 }),
    shelfLifeDays: SHELF_LIFE_DAYS,
    storageInstructions: STORAGE,
    isVeg: true,
    tone: 'chilli',
    images: gallery('masala-khakhra', 'Masala Khakhra', 'D98B5A'),
    variants: packVariants('MASALA', [17900, 33900, 79900], FLAVOURED_GST_RATE_BP), // ₹179 / ₹339 / ₹799
  },
  {
    slug: 'jeera-khakhra',
    name: 'Jeera Khakhra',
    category: 'masala-flavoured',
    blurb: 'Whole cumin seeds, lightly toasted, in a salted wheat disc.',
    description:
      'Cumin is dry-roasted before it meets the dough, so the seeds stay whole and fragrant through the roast. Clean, salty, aromatic — the khakhra for people who think they prefer plain.',
    attributes: {
      flavour: 'Jeera',
      spice_level: 'Mild',
      region: 'Gujarat',
      allergens: ['Wheat (gluten)'],
      serving_suggestion: 'Pairs with masala chai in the morning and with dahi and pickle at lunch.',
      whatYoullGet: 'Salted whole-cumin discs, around 12 to a 200 g pack.',
    },
    ingredients: 'Whole wheat flour, edible vegetable oil, cumin seeds, iodised salt, black pepper.',
    allergens: WHEAT_ONLY,
    nutritionFacts: nutritionPer100g({ energyKcal: 421, proteinG: 11.9, carbohydrateG: 63.5, sugarsG: 1.5, fatG: 13.1, fibreG: 6.7, sodiumMg: 640 }),
    shelfLifeDays: SHELF_LIFE_DAYS,
    storageInstructions: STORAGE,
    isVeg: true,
    tone: 'jaggery',
    images: gallery('jeera-khakhra', 'Jeera Khakhra', 'C99A6B'),
    variants: packVariants('JEERA', [16900, 31900, 74900], FLAVOURED_GST_RATE_BP), // ₹169 / ₹319 / ₹749
  },
  {
    slug: 'multigrain-khakhra',
    name: 'Multigrain Khakhra',
    category: 'multigrain-health',
    blurb: 'Wheat, bajra, jowar and oats with sesame — more fibre, same crackle.',
    description:
      'Four grains milled together for a nuttier, slightly denser disc that still snaps clean. Lightly salted, finished with sesame. Our everyday choice for the lunchbox and the long drive.',
    attributes: {
      flavour: 'Multigrain',
      spice_level: 'Mild',
      region: 'Gujarat',
      allergens: ['Wheat (gluten)', 'Sesame'],
      serving_suggestion: 'With hung curd and cucumber for a light lunch, or crumbled over salad for crunch.',
      whatYoullGet:
        'Four-grain discs flecked with sesame, around 11 to a 200 g pack (they are a touch thicker).',
    },
    ingredients:
      'Whole wheat flour, pearl millet (bajra) flour, sorghum (jowar) flour, oat flour, sesame seeds, edible vegetable oil, iodised salt.',
    allergens: WHEAT_SESAME,
    nutritionFacts: nutritionPer100g({ energyKcal: 428, proteinG: 12.6, carbohydrateG: 60.1, sugarsG: 1.3, fatG: 14.4, fibreG: 9.2, sodiumMg: 540 }),
    shelfLifeDays: SHELF_LIFE_DAYS,
    storageInstructions: STORAGE,
    isVeg: true,
    badge: 'New',
    tone: 'sesame',
    images: gallery('multigrain-khakhra', 'Multigrain Khakhra', 'C9B58F'),
    // Unseasoned, so treated like plain (NIL) pending the CA — see PROVISIONING.md.
    variants: packVariants('MULTI', [19900, 37900, 89900]), // ₹199 / ₹379 / ₹899
  },
  {
    slug: 'family-combo',
    name: 'Family Combo',
    category: 'gift-packs',
    blurb: 'Six 200 g packs — two plain, methi, masala, jeera and multigrain — in one carton.',
    description:
      'The whole range for a household that gets through khakhra fast. Two packs of plain and one each of methi, masala, jeera and multigrain, packed together in a rigid carton. Also our most-sent gift.',
    attributes: {
      region: 'Gujarat',
      allergens: ['Wheat (gluten)', 'Sesame'],
      serving_suggestion: 'Keep the plain for breakfasts and the masala for chai; the combo lasts a family about a month.',
      whatYoullGet:
        'Six sealed 200 g packs (2 × Plain, Methi, Masala, Jeera, Multigrain) — about 70 khakhras — in one gift-ready carton.',
    },
    ingredients:
      'Assorted khakhra — whole wheat flour, millet and oat flours, edible vegetable oil, sesame seeds, fenugreek leaves, cumin, spices, iodised salt.',
    allergens: WHEAT_SESAME,
    nutritionFacts: nutritionPer100g({ energyKcal: 425, proteinG: 12.1, carbohydrateG: 62.4, sugarsG: 1.6, fatG: 13.7, fibreG: 7.2, sodiumMg: 600 }),
    shelfLifeDays: SHELF_LIFE_DAYS,
    storageInstructions: STORAGE,
    isVeg: true,
    badge: 'Seasonal',
    tone: 'turmeric',
    images: gallery('family-combo', 'Family Combo', 'E3A93A'),
    variants: [
      {
        sku: 'KH-COMBO-FAMILY',
        name: '6 × 200 g combo',
        pricePaise: 94900, // ₹949
        compareAtPricePaise: 101400, // ₹1,014 — the six packs bought separately
        gstRateBp: FLAVOURED_GST_RATE_BP, // contains seasoned packs
        weightGrams: 1200,
        shipWeightGrams: 1750,
        lengthCm: '42.00',
        breadthCm: '30.00',
        heightCm: '16.00',
        stock: 30,
        isDefault: true,
        position: 0,
      },
    ],
  },
];

/** Categories exactly as the brand's resolved preset taxonomy lists them. */
const CATEGORIES: readonly CategorySeed[] = (PRESET.categoryTaxonomy ?? []).map((c) => ({
  slug: c.slug,
  name: c.name,
  description: c.description,
  ...(CATEGORY_IMAGES[c.slug] === undefined ? {} : { imageUrl: CATEGORY_IMAGES[c.slug] }),
}));

export function khakhraSeed(env: Readonly<Record<string, string | undefined>>): BrandSeedSpec {
  return {
    profile: KHAKHRA,
    owner: resolveOwner(env, KHAKHRA_OWNER),
    categories: CATEGORIES,
    products: PRODUCTS,
    coupons: [], // no demo coupons for this brand
    ledgerNote: 'Khakhra House starter catalogue seed',
  };
}
