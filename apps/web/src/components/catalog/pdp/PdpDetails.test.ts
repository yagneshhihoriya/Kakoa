import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { presetHas } from '@/lib/brand';
import { PdpDetails, type PdpDetailsProps } from './PdpDetails';

/**
 * Server-renders the accordion against the kakoa pack (vitest aliases `@brand`
 * the way tsconfig does) — the chocolate preset is perishable + veg-marked but
 * has NO `allergens` capability, which is exactly the gating under test.
 */
const BASE: PdpDetailsProps = {
  description: 'A bar.',
  whatYoullGet: 'One bar.',
  shippingInfo: null,
  freeShippingThresholdPaise: 99900,
  giftWrapFeePaise: 4900,
  codEnabled: false,
  ingredients: 'Cocoa mass, cane sugar.',
  allergens: 'May contain traces of milk.',
  declaredAllergens: [],
  nutritionFacts: null,
  isVeg: true,
  netQuantities: '70 g (70g bar)',
  countryOfOrigin: 'India',
  shelfLifeDays: 270,
  storageInstructions: 'Store below 22°C.',
  fssaiLicense: '11525023000841',
  // The compliance block lives in the (collapsed by default) ingredients section.
  defaultOpen: ['ingredients'],
};

function render(overrides: Partial<PdpDetailsProps> = {}): string {
  return renderToStaticMarkup(createElement(PdpDetails, { ...BASE, ...overrides }));
}

describe('PdpDetails — perishable / veg-mark / allergen gating', () => {
  it('renders the perishable rows as the label block states them', () => {
    expect(presetHas('perishable')).toBe(true);
    const html = render();
    expect(html).toContain('Shelf life');
    expect(html).toContain('270 days from packing');
    expect(html).toContain('Best before');
    expect(html).toContain('See pack');
    expect(html).toContain('Store below 22°C.');
  });

  it('omits the shelf-life row when the product has none but still prints best-before', () => {
    const html = render({ shelfLifeDays: null, storageInstructions: null });
    expect(html).not.toContain('Shelf life');
    expect(html).not.toContain('Storage');
    expect(html).toContain('Best before');
  });

  it('shows the FSSAI veg mark only with the veg-mark capability', () => {
    expect(presetHas('veg-mark')).toBe(true);
    expect(render()).toContain('aria-label="Vegetarian"');
    expect(render({ isVeg: false })).toContain('aria-label="Non-vegetarian"');
  });

  it('keeps the free-text allergen advisory and hides the declared list without the capability', () => {
    expect(presetHas('allergens')).toBe(false);
    const html = render({ declaredAllergens: ['Milk', 'Hazelnuts'] });
    expect(html).toContain('May contain traces of milk.');
    expect(html).not.toContain('Contains Milk, Hazelnuts.');
    expect(render({ allergens: '' })).not.toContain('Allergens');
  });

  it('heads the nutrition panel with the reserved basis key and never renders it as a row', () => {
    const html = render({
      nutritionFacts: { basis: 'per 100 g', Energy: '418 kcal', Protein: '11.8 g' },
    });
    expect(html).toContain('Nutrition · per 100 g');
    expect(html).toContain('418 kcal');
    expect(html).not.toMatch(/>basis</);
    // Older records without a basis keep the historical serving heading.
    expect(render({ nutritionFacts: { Energy: '546 kcal' } })).toContain('Nutrition · per 30 g');
  });
});
