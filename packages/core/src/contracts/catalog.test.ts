import { describe, expect, it } from 'vitest';

import {
  categorySchema,
  productCardSchema,
  productDetailSchema,
  productListInputSchema,
  searchHitSchema,
} from './catalog';

const card = {
  id: '3f1a2b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b',
  slug: 'truffle-noir',
  name: 'Truffle Noir',
  blurb: 'Single-origin 70% dark ganache.',
  badge: 'Best seller',
  categorySlug: 'pralines',
  ratingAvg: 4.8,
  ratingCount: 132,
  tone: 'dark',
  fromPricePaise: 49900,
  compareAtPricePaise: 59900,
  inStock: true,
  imageUrl: null,
} as const;

const detail = {
  ...card,
  description: 'A sixteen-piece box of dark ganache truffles.',
  tastingNotes: ['cocoa', 'sea salt'],
  ingredients: 'Cocoa mass, cocoa butter, sugar, cream.',
  allergens: 'Contains milk. May contain tree nuts.',
  nutritionFacts: { Energy: '546 kcal', Protein: '6.1 g' },
  shelfLifeDays: 90,
  storageInstructions: 'Store below 20°C away from sunlight.',
  isVeg: true,
  pdpAttributes: [{ label: 'Cocoa', value: '70', unit: '%' }],
  whatYoullGet: 'A sixteen-piece box, ready to gift.',
  shippingInfo: null,
  fssaiLicense: '11522998000123',
  reviews: [
    {
      id: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
      author: 'Asha',
      rating: 5,
      title: 'Divine',
      body: 'Melts beautifully — a wonderful gift.',
      dateIso: '2026-01-01T00:00:00.000Z',
    },
  ],
  images: [
    {
      id: '7c8d9e0f-1a2b-4c3d-9e5f-6a7b8c9d0e1f',
      url: 'https://example.supabase.co/storage/v1/object/public/products/truffle-noir-1.jpg',
      alt: 'Truffle Noir 16-piece box',
      variantId: null,
    },
  ],
  variants: [
    {
      id: '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      sku: 'KK-TRN-16PC',
      name: '16-piece box',
      pricePaise: 49900,
      compareAtPricePaise: 59900,
      weightGrams: 200,
      inStock: true,
      stockLow: false,
      isDefault: true,
    },
  ],
  related: [card],
  frequentlyBoughtTogether: [],
} as const;

describe('productCardSchema', () => {
  it('round-trips a valid fixture', () => {
    expect(productCardSchema.parse(card)).toEqual(card);
  });

  it('rejects an unknown tone', () => {
    expect(
      productCardSchema.safeParse({ ...card, tone: 'neon' }).success,
    ).toBe(false);
  });
});

describe('productDetailSchema', () => {
  it('round-trips a valid fixture', () => {
    expect(productDetailSchema.parse(detail)).toEqual(detail);
  });

  it('accepts null nutritionFacts / shelfLifeDays / storageInstructions', () => {
    const parsed = productDetailSchema.parse({
      ...detail,
      nutritionFacts: null,
      shelfLifeDays: null,
      storageInstructions: null,
    });
    expect(parsed.nutritionFacts).toBeNull();
  });
});

describe('categorySchema', () => {
  it('round-trips a valid fixture', () => {
    const category = {
      id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      slug: 'pralines',
      name: 'Pralines',
      description: null,
      position: 2,
    };
    expect(categorySchema.parse(category)).toEqual(category);
  });
});

describe('searchHitSchema', () => {
  it('round-trips a valid fixture', () => {
    const hit = {
      id: card.id,
      slug: card.slug,
      name: card.name,
      blurb: card.blurb,
      tone: 'dark',
      fromPricePaise: 49900,
      categorySlug: 'pralines',
    };
    expect(searchHitSchema.parse(hit)).toEqual(hit);
  });
});

describe('productListInputSchema', () => {
  it('applies defaults on an empty input', () => {
    expect(productListInputSchema.parse({})).toEqual({
      sort: 'featured',
      page: 1,
      pageSize: 24,
    });
  });

  it('coerces page/pageSize and trims q', () => {
    expect(
      productListInputSchema.parse({
        category: 'gifts',
        page: '2',
        pageSize: '48',
        q: '  truffle  ',
      }),
    ).toEqual({
      category: 'gifts',
      sort: 'featured',
      page: 2,
      pageSize: 48,
      q: 'truffle',
    });
  });

  it('rejects a bad sort value', () => {
    expect(
      productListInputSchema.safeParse({ sort: 'cheapest' }).success,
    ).toBe(false);
  });

  it('rejects pageSize above 48, page below 1, q above 60 chars, unknown keys', () => {
    expect(productListInputSchema.safeParse({ pageSize: 49 }).success).toBe(
      false,
    );
    expect(productListInputSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(
      productListInputSchema.safeParse({ q: 'x'.repeat(61) }).success,
    ).toBe(false);
    expect(
      productListInputSchema.safeParse({ foo: 'bar' }).success,
    ).toBe(false);
  });
});
