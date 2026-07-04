/**
 * Seed — Phase 0 (Contract §1.1 settings, §1.2 categories, 10 prototype
 * products with variants/images, one owner admin, 3 coupons).
 *
 * Run: pnpm db:seed  (requires DATABASE_URL; migrations must be applied).
 * Idempotent: exits early if store_settings is already populated.
 */
import { randomUUID } from 'node:crypto';
import { db, queryClient } from './client';
import {
  adminUsers,
  categories,
  coupons,
  inventoryAdjustments,
  productImages,
  productVariants,
  products,
  storeSettings,
} from './schema/index';

// ---------------------------------------------------------------------------
// store_settings — Contract §1.1 v1 policy values (paise integers).
// ---------------------------------------------------------------------------
const SETTINGS: Record<string, string | number | boolean> = {
  fssai_license_number: '11525023000841',
  seller_gstin: '27AABCK4321M1Z5',
  seller_state_code: '27',
  seller_legal_name: 'Kakao Chocolates Private Limited',
  seller_address:
    'Unit 12, Veera Desai Industrial Estate, Andheri West, Mumbai 400053, Maharashtra, India',
  origin_pincode: '400053',
  shipping_fee_standard_paise: 4900, // ₹49; free ≥ threshold
  shipping_fee_express_paise: 14900, // ₹149 flat
  free_shipping_threshold_paise: 99900, // ₹999
  cod_fee_paise: 4900, // ₹49
  cod_enabled: false, // prepaid/online-only launch; flip to true to enable COD
  gift_wrap_fee_paise: 4900, // ₹49 per line
  payment_expiry_minutes: 30,
  support_phone: '+919820012345',
  support_email: 'support@kakoa.in',
};

// ---------------------------------------------------------------------------
// Catalog — 10 prototype products across Bars / Pralines / Signature / Gifts.
// Prototype USD prices converted to sensible INR MRPs (GST-inclusive,
// gst_rate_bp 500, HSN 1806).
// ---------------------------------------------------------------------------
interface VariantSeed {
  sku: string;
  name: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  weightGrams: number;
  shipWeightGrams: number;
  lengthCm?: string;
  breadthCm?: string;
  heightCm?: string;
  stock: number;
  isDefault: boolean;
  position: number;
}

interface ProductSeed {
  slug: string;
  name: string;
  category: 'bars' | 'pralines' | 'signature' | 'gifts';
  blurb: string;
  description: string;
  tastingNotes: string[];
  ingredients: string;
  allergens: string;
  shelfLifeDays: number;
  storageInstructions: string;
  isVeg: boolean;
  badge?: string;
  tone: string;
  variants: VariantSeed[];
}

const STORAGE = 'Store in a cool, dry place below 22°C. Do not refrigerate.';

const PRODUCTS: ProductSeed[] = [
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

function placeholderImage(name: string, index: number): string {
  const text = encodeURIComponent(`${name} ${index + 1}`);
  return `https://placehold.co/1200x1200/4A2E1C/FBF6EF?text=${text}`;
}

async function main(): Promise<void> {
  const alreadySeeded = await db
    .select({ key: storeSettings.key })
    .from(storeSettings)
    .limit(1);
  if (alreadySeeded.length > 0) {
    console.log('Seed skipped: store_settings already populated.');
    return;
  }

  // 1. Owner admin — passwordless (email OTP), no credentials to seed.
  const ownerId = randomUUID();
  await db.insert(adminUsers).values({
    id: ownerId,
    email: 'owner@kakoa.in',
    name: 'Kakao Owner',
    role: 'owner',
  });

  // 2. store_settings (Contract §1.1).
  await db.insert(storeSettings).values(
    Object.entries(SETTINGS).map(([key, value]) => ({
      key,
      value,
      updatedBy: ownerId,
    })),
  );

  // 3. Categories (Contract §1.2 seeds).
  const categorySeeds = [
    { slug: 'bars', name: 'Bars', description: 'Single-origin and flavoured chocolate bars.' },
    { slug: 'pralines', name: 'Pralines', description: 'Filled chocolates made in small batches.' },
    { slug: 'signature', name: 'Signature', description: 'The boxes KAKOA is known for.' },
    { slug: 'gifts', name: 'Gifts', description: 'Hampers and keepsake boxes, ribbon included.' },
  ] as const;
  const categoryIds = new Map<string, string>();
  await db.insert(categories).values(
    categorySeeds.map((c, i) => {
      const id = randomUUID();
      categoryIds.set(c.slug, id);
      return { id, slug: c.slug, name: c.name, description: c.description, position: i };
    }),
  );

  // 4. Products + variants + images + initial_stock ledger rows.
  let productCount = 0;
  let variantCount = 0;
  for (const p of PRODUCTS) {
    const categoryId = categoryIds.get(p.category);
    if (!categoryId) throw new Error(`Unknown category slug: ${p.category}`);

    const productId = randomUUID();
    await db.insert(products).values({
      id: productId,
      slug: p.slug,
      name: p.name,
      categoryId,
      blurb: p.blurb,
      description: p.description,
      tastingNotes: p.tastingNotes,
      ingredients: p.ingredients,
      allergens: p.allergens,
      nutritionFacts: {
        per100g: { energyKcal: 546, proteinG: 6.2, carbohydrateG: 49.8, sugarG: 38.5, fatG: 36.1 },
      },
      shelfLifeDays: p.shelfLifeDays,
      storageInstructions: p.storageInstructions,
      isVeg: p.isVeg,
      badge: p.badge ?? null,
      tone: p.tone,
    });
    productCount += 1;

    for (const v of p.variants) {
      const variantId = randomUUID();
      await db.insert(productVariants).values({
        id: variantId,
        productId,
        sku: v.sku,
        name: v.name,
        pricePaise: v.pricePaise,
        compareAtPricePaise: v.compareAtPricePaise ?? null,
        gstRateBp: 500,
        hsnCode: '1806',
        weightGrams: v.weightGrams,
        shipWeightGrams: v.shipWeightGrams,
        lengthCm: v.lengthCm ?? null,
        breadthCm: v.breadthCm ?? null,
        heightCm: v.heightCm ?? null,
        stockQuantity: v.stock,
        position: v.position,
        isDefault: v.isDefault,
      });
      variantCount += 1;

      // Ledger convention (§1.22): every stock change writes a ledger row.
      await db.insert(inventoryAdjustments).values({
        variantId,
        delta: v.stock,
        reason: 'initial_stock',
        adminUserId: ownerId,
        note: 'Phase 0 seed',
        stockAfter: v.stock,
      });
    }

    await db.insert(productImages).values(
      [0, 1].map((i) => ({
        productId,
        url: placeholderImage(p.name, i),
        alt: `${p.name} — photo ${i + 1}`,
        position: i,
      })),
    );
  }

  // 5. Coupons: WELCOME10 (10% first order), FREESHIP (flat ₹49 off),
  //    KAKAO50 (exhausted — for COUPON_EXHAUSTED testing).
  await db.insert(coupons).values([
    {
      code: 'WELCOME10',
      description: '10% off your first order',
      percentBp: 1000,
      maxDiscountPaise: 30000, // cap ₹300
      minSubtotalPaise: 0,
      firstOrderOnly: true,
      perCustomerLimit: 1,
      createdBy: ownerId,
    },
    {
      code: 'FREESHIP',
      description: 'Free standard shipping (flat ₹49 off)',
      flatPaise: 4900,
      minSubtotalPaise: 49900,
      perCustomerLimit: 3,
      createdBy: ownerId,
    },
    {
      code: 'KAKAO50',
      description: 'Flat ₹50 off — exhausted test coupon',
      flatPaise: 5000,
      minSubtotalPaise: 0,
      usageLimit: 50,
      redemptionCount: 50, // exhausted: atomic check (§1.28.2) must reject
      perCustomerLimit: 1,
      createdBy: ownerId,
    },
  ]);

  console.log(
    `Seeded: 15 store_settings keys, ${String(categorySeeds.length)} categories, ` +
      `${String(productCount)} products, ${String(variantCount)} variants, 3 coupons, 1 owner admin.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void queryClient.end({ timeout: 5 });
  });
