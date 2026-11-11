/**
 * KAKOA seed — the Phase 0 content, moved here verbatim from the former
 * single-brand seed.ts (Contract §1.1 settings, §1.2 categories, 10 prototype
 * products with variants, one owner admin, 3 coupons). The rows this spec
 * produces are byte-identical to the pre-split seed.
 *
 * Prototype USD prices converted to sensible INR MRPs (GST-inclusive). The tax
 * class (gst_rate_bp / hsn_code) is the chocolate preset's `taxDefaults`,
 * applied by the writer (platform.ts) to every variant.
 */
import { KAKOA } from '@kakoa/brands';
import {
  resolveOwner,
  type BrandSeedSpec,
  type CategorySeed,
  type CouponSeed,
  type ProductSeed,
  type SeedOwner,
} from './spec';

/** The owner admin both brand seeds fall back to (same company, same owner). */
export const KAKOA_OWNER: SeedOwner = { email: 'owner@kakoa.in', name: 'Kakao Owner' };

/** A KAKOA product as authored: tasting notes as a list, category as a slug. */
interface KakoaProduct extends Omit<ProductSeed, 'attributes' | 'nutritionFacts'> {
  category: 'bars' | 'pralines' | 'signature' | 'gifts';
  /** Preset attribute `tasting_notes` (free text) — joined with ', ' on insert. */
  tastingNotes: string[];
}

/** Placeholder label values shared by every Phase 0 product. */
const NUTRITION = {
  per100g: { energyKcal: 546, proteinG: 6.2, carbohydrateG: 49.8, sugarG: 38.5, fatG: 36.1 },
};

const STORAGE = 'Store in a cool, dry place below 22°C. Do not refrigerate.';

const PRODUCTS: KakoaProduct[] = [
  {
    slug: 'midnight-72-dark',
    name: 'Midnight 72% Dark',
    category: 'bars',
    blurb: 'Our house dark — deep cocoa, clean snap, long finish.',
    description:
      'A single 72% dark bar built on slow-roasted Idukki cacao. Balanced bitterness with a naturally fruity edge.',
    tastingNotes: ['Cocoa', 'Dried fig', 'Espresso'],
    ingredients: 'Cocoa mass, cane sugar, cocoa butter. Cocoa solids 72% min.',
    allergens: 'May contain traces of milk, tree nuts and soy.',
    shelfLifeDays: 270,
    storageInstructions: STORAGE,
    isVeg: true,
    badge: 'Best seller',
    tone: 'dark',
    variants: [
      {
        sku: 'KK-M72-70G',
        name: '70g bar',
        pricePaise: 42500, // ₹425
        weightGrams: 70,
        shipWeightGrams: 120,
        lengthCm: '16.00',
        breadthCm: '8.00',
        heightCm: '1.20',
        stock: 120,
        isDefault: true,
        position: 0,
      },
    ],
  },
  {
    slug: 'sea-salt-caramel-bar',
    name: 'Sea Salt Caramel Bar',
    category: 'bars',
    blurb: 'Milk chocolate ribboned with burnt caramel and flaky sea salt.',
    description:
      '45% single-origin milk chocolate layered with house-made caramel brittle and hand-harvested Kutch sea salt.',
    tastingNotes: ['Caramel', 'Sea salt', 'Malted milk'],
    ingredients:
      'Cocoa mass, cane sugar, cocoa butter, milk solids, caramel (sugar, butter), sea salt.',
    allergens: 'Contains milk. May contain traces of tree nuts and soy.',
    shelfLifeDays: 240,
    storageInstructions: STORAGE,
    isVeg: true,
    tone: 'caramel',
    variants: [
      {
        sku: 'KK-SSC-70G',
        name: '70g bar',
        pricePaise: 39500, // ₹395
        weightGrams: 70,
        shipWeightGrams: 120,
        lengthCm: '16.00',
        breadthCm: '8.00',
        heightCm: '1.20',
        stock: 100,
        isDefault: true,
        position: 0,
      },
    ],
  },
  {
    slug: 'roasted-hazelnut-crunch',
    name: 'Roasted Hazelnut Crunch',
    category: 'bars',
    blurb: 'Dark milk chocolate loaded with caramelised hazelnut shards.',
    description:
      '55% dark milk chocolate studded with double-roasted, caramelised hazelnuts for texture in every square.',
    tastingNotes: ['Hazelnut', 'Toffee', 'Toasted grain'],
    ingredients:
      'Cocoa mass, cane sugar, cocoa butter, milk solids, hazelnuts (12%).',
    allergens: 'Contains milk and hazelnuts. May contain other tree nuts, soy.',
    shelfLifeDays: 210,
    storageInstructions: STORAGE,
    isVeg: true,
    tone: 'dark',
    variants: [
      {
        sku: 'KK-HZC-70G',
        name: '70g bar',
        pricePaise: 44500, // ₹445
        weightGrams: 70,
        shipWeightGrams: 120,
        lengthCm: '16.00',
        breadthCm: '8.00',
        heightCm: '1.20',
        stock: 90,
        isDefault: true,
        position: 0,
      },
    ],
  },
  {
    slug: 'madagascar-85-single-origin',
    name: 'Madagascar 85% Single Origin',
    category: 'bars',
    blurb: 'Sambirano Valley cacao — bright red fruit, zero dairy.',
    description:
      'A limited-lot 85% vegan bar from Madagascar’s Sambirano Valley. Vivid raspberry acidity over a deep cocoa base.',
    tastingNotes: ['Raspberry', 'Citrus peel', 'Dark cocoa'],
    ingredients: 'Cocoa mass, cane sugar, cocoa butter. Cocoa solids 85% min.',
    allergens: 'May contain traces of milk, tree nuts and soy.',
    shelfLifeDays: 300,
    storageInstructions: STORAGE,
    isVeg: true,
    badge: 'Limited',
    tone: 'plum',
    variants: [
      {
        sku: 'KK-MD85-70G',
        name: '70g bar',
        pricePaise: 49500, // ₹495
        weightGrams: 70,
        shipWeightGrams: 120,
        lengthCm: '16.00',
        breadthCm: '8.00',
        heightCm: '1.20',
        stock: 60,
        isDefault: true,
        position: 0,
      },
    ],
  },
  {
    slug: 'truffle-noir',
    name: 'Truffle Noir',
    category: 'signature',
    blurb: 'Our signature dark truffles — 72% ganache, cocoa-dusted.',
    description:
      'The box that started KAKOA. Slow-whipped 72% dark ganache hand-rolled in Dutch cocoa. Best within three weeks.',
    tastingNotes: ['Dark ganache', 'Dutch cocoa', 'Vanilla bean'],
    ingredients:
      'Cocoa mass, fresh cream, cane sugar, cocoa butter, cocoa powder, glucose, vanilla.',
    allergens: 'Contains milk. May contain traces of tree nuts and soy.',
    shelfLifeDays: 21,
    storageInstructions: 'Keep refrigerated (4–8°C). Rest 10 min before serving.',
    isVeg: true,
    badge: 'Best seller',
    tone: 'dark',
    variants: [
      {
        sku: 'KK-TRN-8PC',
        name: '8-piece box',
        pricePaise: 79500, // ₹795
        weightGrams: 100,
        shipWeightGrams: 220,
        lengthCm: '12.00',
        breadthCm: '12.00',
        heightCm: '4.00',
        stock: 45,
        isDefault: false,
        position: 0,
      },
      {
        sku: 'KK-TRN-16PC',
        name: '16-piece box',
        pricePaise: 129500, // ₹1,295
        compareAtPricePaise: 149500,
        weightGrams: 200,
        shipWeightGrams: 380,
        lengthCm: '22.00',
        breadthCm: '12.00',
        heightCm: '4.00',
        stock: 35,
        isDefault: true,
        position: 1,
      },
    ],
  },
  {
    slug: 'pistachio-praline-collection',
    name: 'Pistachio Praline Collection',
    category: 'pralines',
    blurb: 'Sicilian-style pistachio pralines in 64% dark shells.',
    description:
      'Stone-ground pistachio praline, a whisper of orange blossom, and a snappy 64% dark shell. Finished with crushed pistachio.',
    tastingNotes: ['Pistachio', 'Orange blossom', 'Butterscotch'],
    ingredients:
      'Cocoa mass, cane sugar, cocoa butter, pistachios (18%), milk solids, butter, orange blossom water.',
    allergens: 'Contains milk and pistachios. May contain other tree nuts, soy.',
    shelfLifeDays: 45,
    storageInstructions: STORAGE,
    isVeg: true,
    tone: 'pistachio',
    variants: [
      {
        sku: 'KK-PST-9PC',
        name: '9-piece box',
        pricePaise: 84500, // ₹845
        weightGrams: 110,
        shipWeightGrams: 240,
        lengthCm: '13.00',
        breadthCm: '13.00',
        heightCm: '4.00',
        stock: 50,
        isDefault: true,
        position: 0,
      },
      {
        sku: 'KK-PST-18PC',
        name: '18-piece box',
        pricePaise: 129500, // ₹1,295
        weightGrams: 220,
        shipWeightGrams: 400,
        lengthCm: '24.00',
        breadthCm: '13.00',
        heightCm: '4.00',
        stock: 25,
        isDefault: false,
        position: 1,
      },
    ],
  },
  {
    slug: 'salted-caramel-pralines',
    name: 'Salted Caramel Pralines',
    category: 'pralines',
    blurb: 'Molten caramel hearts sealed in milk chocolate domes.',
    description:
      'Slow-cooked salted caramel that actually flows, enrobed in 45% milk chocolate and topped with a salt crystal.',
    tastingNotes: ['Burnt caramel', 'Cream', 'Sea salt'],
    ingredients:
      'Cane sugar, cocoa mass, cocoa butter, milk solids, cream, butter, glucose, sea salt.',
    allergens: 'Contains milk. May contain traces of tree nuts and soy.',
    shelfLifeDays: 45,
    storageInstructions: STORAGE,
    isVeg: true,
    tone: 'caramel',
    variants: [
      {
        sku: 'KK-SCP-9PC',
        name: '9-piece box',
        pricePaise: 79500, // ₹795
        weightGrams: 110,
        shipWeightGrams: 240,
        lengthCm: '13.00',
        breadthCm: '13.00',
        heightCm: '4.00',
        stock: 55,
        isDefault: true,
        position: 0,
      },
    ],
  },
  {
    slug: 'raspberry-ganache-squares',
    name: 'Raspberry Ganache Squares',
    category: 'pralines',
    blurb: 'Tart raspberry ganache in thin 64% dark squares.',
    description:
      'Freeze-dried Himachal raspberries folded into silky ganache, cased in hand-cut dark squares.',
    tastingNotes: ['Raspberry', 'Rose', 'Dark cocoa'],
    ingredients:
      'Cocoa mass, cane sugar, cream, cocoa butter, raspberry (8%), glucose, butter.',
    allergens: 'Contains milk. May contain traces of tree nuts and soy.',
    shelfLifeDays: 30,
    storageInstructions: STORAGE,
    isVeg: true,
    badge: 'New',
    tone: 'raspberry',
    variants: [
      {
        sku: 'KK-RGS-12PC',
        name: '12-piece box',
        pricePaise: 89500, // ₹895
        weightGrams: 140,
        shipWeightGrams: 280,
        lengthCm: '18.00',
        breadthCm: '13.00',
        heightCm: '3.50',
        stock: 40,
        isDefault: true,
        position: 0,
      },
    ],
  },
  {
    slug: 'single-origin-tasting-library',
    name: 'Single Origin Tasting Library',
    category: 'signature',
    blurb: 'Five origins, five 35g bars — a flight through cacao.',
    description:
      'India, Madagascar, Ecuador, Vietnam and Ghana side by side. Five 35g bars with a printed tasting guide.',
    tastingNotes: ['Five origins', 'Guided flight', 'Collector sleeve'],
    ingredients:
      'Cocoa mass, cane sugar, cocoa butter, milk solids (Ghana 50% bar only).',
    allergens: 'Contains milk. May contain traces of tree nuts and soy.',
    shelfLifeDays: 240,
    storageInstructions: STORAGE,
    isVeg: true,
    tone: 'plum',
    variants: [
      {
        sku: 'KK-SOL-5X35',
        name: '5 × 35g library',
        pricePaise: 139500, // ₹1,395
        weightGrams: 175,
        shipWeightGrams: 340,
        lengthCm: '24.00',
        breadthCm: '16.00',
        heightCm: '3.00',
        stock: 30,
        isDefault: true,
        position: 0,
      },
    ],
  },
  {
    slug: 'kakoa-celebration-hamper',
    name: 'KAKOA Celebration Hamper',
    category: 'gifts',
    blurb: 'The full house — truffles, pralines and two bars, ribboned.',
    description:
      'A ribbon-tied keepsake box: 12 assorted truffles and pralines, Midnight 72%, Sea Salt Caramel, and a handwritten card.',
    tastingNotes: ['Assorted truffles', 'Two bars', 'Keepsake box'],
    ingredients:
      'Assorted chocolates — cocoa mass, cane sugar, cocoa butter, milk solids, cream, nuts, caramel.',
    allergens: 'Contains milk, hazelnuts and pistachios. May contain soy.',
    shelfLifeDays: 30,
    storageInstructions: STORAGE,
    isVeg: true,
    badge: 'Seasonal',
    tone: 'raspberry',
    variants: [
      {
        sku: 'KK-HMP-CEL',
        name: 'Celebration hamper',
        pricePaise: 149500, // ₹1,495
        compareAtPricePaise: 174500,
        weightGrams: 320,
        shipWeightGrams: 650,
        lengthCm: '28.00',
        breadthCm: '20.00',
        heightCm: '8.00',
        stock: 20,
        isDefault: true,
        position: 0,
      },
    ],
  },
];

// Categories (Contract §1.2 seeds).
const CATEGORIES: readonly CategorySeed[] = [
  { slug: 'bars', name: 'Bars', description: 'Single-origin and flavoured chocolate bars.' },
  { slug: 'pralines', name: 'Pralines', description: 'Filled chocolates made in small batches.' },
  { slug: 'signature', name: 'Signature', description: 'The boxes KAKOA is known for.' },
  { slug: 'gifts', name: 'Gifts', description: 'Hampers and keepsake boxes, ribbon included.' },
];

// Coupons: WELCOME10 (10% first order), FREESHIP (flat ₹49 off),
// KAKAO50 (exhausted — for COUPON_EXHAUSTED testing).
const COUPONS: readonly CouponSeed[] = [
  {
    code: 'WELCOME10',
    description: '10% off your first order',
    percentBp: 1000,
    maxDiscountPaise: 30000, // cap ₹300
    minSubtotalPaise: 0,
    firstOrderOnly: true,
    perCustomerLimit: 1,
  },
  {
    code: 'FREESHIP',
    description: 'Free standard shipping (flat ₹49 off)',
    flatPaise: 4900,
    minSubtotalPaise: 49900,
    perCustomerLimit: 3,
  },
  {
    code: 'KAKAO50',
    description: 'Flat ₹50 off — exhausted test coupon',
    flatPaise: 5000,
    minSubtotalPaise: 0,
    usageLimit: 50,
    redemptionCount: 50, // exhausted: atomic check (§1.28.2) must reject
    perCustomerLimit: 1,
  },
];

function toProductSeed({ tastingNotes, ...product }: KakoaProduct): ProductSeed {
  return {
    ...product,
    // Preset attributes (docs/admin-platform §2.4) — the former column.
    attributes: { tasting_notes: tastingNotes.join(', ') },
    nutritionFacts: NUTRITION,
  };
}

export function kakoaSeed(env: Readonly<Record<string, string | undefined>>): BrandSeedSpec {
  return {
    profile: KAKOA,
    owner: resolveOwner(env, KAKOA_OWNER),
    categories: CATEGORIES,
    products: PRODUCTS.map(toProductSeed),
    coupons: COUPONS,
    ledgerNote: 'Phase 0 seed',
  };
}
