import { describe, expect, it } from 'vitest';
import { CAPABILITY_KEYS, type Capability } from './capabilities';
import {
  GENERAL_PRESENTATION,
  GENERAL_VOCABULARY,
  PRESETS,
  PRESET_KEYS,
  getPreset,
  resolvePreset,
  type PresetKey,
} from './presets';

describe('vertical presets', () => {
  it('getPreset returns the requested preset', () => {
    expect(getPreset('chocolate').key).toBe('chocolate');
    expect(getPreset('coffee').key).toBe('coffee');
  });

  it('falls back to general for an unknown vertical', () => {
    expect(getPreset('nope' as PresetKey).key).toBe('general');
  });

  it('the chocolate preset carries no hardcoded columns — attributes are data', () => {
    const choc = PRESETS.chocolate;
    const keys = choc.attributeSchema.map((a) => a.key);
    expect(keys).toContain('cocoa_pct');
    expect(keys).toContain('tone'); // the old hardcoded column is now an attribute
    expect(choc.taxDefaults.code).toBe('1806'); // HSN moved into preset data
    expect(choc.taxDefaults.rateBp).toBe(500);
  });

  it('every preset references only real capabilities', () => {
    for (const preset of Object.values(PRESETS)) {
      for (const cap of preset.capabilities) {
        expect(CAPABILITY_KEYS).toContain(cap as Capability);
      }
    }
  });

  it('every attribute that gates on a capability references a real one', () => {
    for (const preset of Object.values(PRESETS)) {
      for (const attr of preset.attributeSchema) {
        if (attr.capability) expect(CAPABILITY_KEYS).toContain(attr.capability);
      }
    }
  });

  it('a non-food vertical (general) enables no food capabilities', () => {
    const general = PRESETS.general;
    expect(general.capabilities).not.toContain('veg-mark');
    expect(general.capabilities).not.toContain('perishable');
    expect(general.attributeSchema).toHaveLength(0);
  });

  it('every preset carries a complete storefront vocabulary and a swatch palette', () => {
    for (const preset of Object.values(PRESETS)) {
      const { storefront, presentation } = preset;
      expect(storefront.noun.one).not.toBe('');
      expect(storefront.noun.many).not.toBe('');
      expect(storefront.noun.collective).not.toBe('');
      expect(storefront.unitNoun.one).not.toBe('');
      expect(storefront.searchPlaceholder).not.toBe('');
      expect(typeof storefront.coldChain).toBe('boolean');
      expect(storefront.packaging.standardDelivery).not.toBe('');
      expect(storefront.packaging.pdpBullet).toContain('{unit}');
      expect(storefront.packaging.whatYoullGet).not.toBe('');
      // Every fixed return_reason enum value has a label.
      for (const reason of ['damaged_or_melted', 'wrong_item', 'quality_issue', 'changed_mind', 'other']) {
        expect(storefront.returnReasonLabels[reason]).toBeTruthy();
      }
      for (const dim of Object.values(storefront.defaultParcelCm)) expect(dim).toBeGreaterThan(0);
      expect(Object.keys(presentation.swatches).length).toBeGreaterThan(0);
      expect(presentation.swatches[presentation.defaultSwatch]).toBeDefined();
      for (const swatch of Object.values(presentation.swatches)) {
        expect(swatch.from).toMatch(/^#[0-9a-f]{6}$/i);
        expect(swatch.to).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('the general fallback is brand- and vertical-neutral', () => {
    expect(getPreset('nope' as PresetKey).storefront).toBe(GENERAL_VOCABULARY);
    expect(getPreset('nope' as PresetKey).presentation).toBe(GENERAL_PRESENTATION);
    expect(GENERAL_VOCABULARY.coldChain).toBe(false);
    // Values only — the fixed enum KEY `damaged_or_melted` is allowed to exist.
    const { returnReasonLabels, ...rest } = GENERAL_VOCABULARY;
    expect(JSON.stringify([rest, Object.values(returnReasonLabels)])).not.toMatch(/chocolate|cocoa|melt/i);
  });

  it('chocolate keeps the cold chain and its tone studies; snacks is shelf-stable', () => {
    const choc = PRESETS.chocolate;
    expect(choc.storefront.coldChain).toBe(true);
    expect(choc.storefront.noun).toEqual({ one: 'chocolate', many: 'chocolates', collective: 'chocolate' });
    expect(choc.storefront.unitNoun).toEqual({ one: 'piece', many: 'pieces' });
    expect(choc.storefront.returnReasonLabels.damaged_or_melted).toBe('Damaged or melted');
    // The cold-chain claims live here and nowhere in app code.
    expect(choc.storefront.packaging.trustLabel).toBe('Ships cold & insulated');
    expect(choc.storefront.packaging.standardDelivery).toMatch(/cold/i);
    expect(choc.storefront.packaging.pdpBullet).toMatch(/ice packs/i);
    expect(Object.keys(choc.presentation.swatches)).toEqual(['dark', 'milk', 'ruby', 'caramel', 'white', 'matcha']);
    expect(choc.presentation.defaultSwatch).toBe('dark');

    const snacks = PRESETS.snacks;
    expect(snacks.capabilities).not.toContain('cold-chain');
    expect(snacks.capabilities).toEqual(
      expect.arrayContaining(['variants', 'perishable', 'veg-mark', 'allergens', 'weight-shipping', 'serviceability', 'tax-inclusive', 'hsn-codes']),
    );
    expect(snacks.storefront.coldChain).toBe(false);
    expect(snacks.storefront.returnReasonLabels.damaged_or_melted).not.toMatch(/melt/i);
    expect(snacks.storefront.packaging.trustLabel).toBeNull();
    expect(JSON.stringify(snacks.storefront.packaging)).not.toMatch(/cold|insulated|ice/i);
    expect(snacks.units).toBe('weight');
    expect(snacks.taxDefaults).toEqual({ category: 'Khakhra / bakery products', rateBp: 0, codeSystem: 'HSN', code: '1905' });
    const keys = snacks.attributeSchema.map((a) => a.key);
    for (const k of ['pack_size', 'flavour', 'spice_level', 'region', 'serving_suggestion', 'whatYoullGet', 'shipping']) {
      expect(keys).toContain(k);
    }
    expect(snacks.categoryTaxonomy?.length).toBe(4);
  });
});

describe('resolvePreset', () => {
  it('returns the shipped preset itself when there is nothing to override', () => {
    expect(resolvePreset({ vertical: 'chocolate' })).toBe(PRESETS.chocolate);
    expect(resolvePreset({ vertical: 'snacks', presetOverrides: undefined })).toBe(PRESETS.snacks);
  });

  it('overrides scalars and taxDefaults fields individually, never the key', () => {
    const resolved = resolvePreset({
      vertical: 'snacks',
      presetOverrides: {
        label: 'Khakhra',
        units: 'weight',
        taxDefaults: { codeSystem: 'HSN', code: '1905', rateBp: 0 },
      },
    });
    expect(resolved.key).toBe('snacks');
    expect(resolved.label).toBe('Khakhra');
    expect(resolved.units).toBe('weight');
    expect(resolved.taxDefaults).toEqual({
      ...PRESETS.snacks.taxDefaults,
      codeSystem: 'HSN',
      code: '1905',
      rateBp: 0,
    });
  });

  it('an undefined field inside a partial override keeps the base value', () => {
    const resolved = resolvePreset({
      vertical: 'chocolate',
      presetOverrides: { taxDefaults: { rateBp: undefined, code: '1806' } },
    });
    expect(resolved.taxDefaults.rateBp).toBe(PRESETS.chocolate.taxDefaults.rateBp);
  });

  it('replaces capabilities and categoryTaxonomy wholesale', () => {
    const resolved = resolvePreset({
      vertical: 'chocolate',
      presetOverrides: {
        capabilities: ['variants', 'veg-mark'],
        categoryTaxonomy: [{ slug: 'plain', name: 'Plain', description: 'Classic.' }],
      },
    });
    expect(resolved.capabilities).toEqual(['variants', 'veg-mark']);
    expect(resolved.categoryTaxonomy).toEqual([
      { slug: 'plain', name: 'Plain', description: 'Classic.' },
    ]);
  });

  it('merges attributeSchema by key: patches in place, appends new keys, keeps order', () => {
    const base = PRESETS.chocolate.attributeSchema;
    const resolved = resolvePreset({
      vertical: 'chocolate',
      presetOverrides: {
        attributeSchema: [
          { key: 'tone', label: 'Finish', type: 'enum', options: ['matte', 'gloss'] },
          { key: 'spice_level', label: 'Spice level', type: 'enum', options: ['Mild', 'Hot'] },
        ],
      },
    });
    expect(resolved.attributeSchema).toHaveLength(base.length + 1);
    const toneIndex = base.findIndex((a) => a.key === 'tone');
    const tone = resolved.attributeSchema[toneIndex];
    expect(tone?.label).toBe('Finish');
    expect(tone?.options).toEqual(['matte', 'gloss']);
    expect(tone?.showOnPdp).toBe(base[toneIndex]?.showOnPdp); // untouched field survives
    expect(resolved.attributeSchema.at(-1)?.key).toBe('spice_level');
  });

  it('merges storefront vocabulary field by field and swatches by key', () => {
    const resolved = resolvePreset({
      vertical: 'snacks',
      presetOverrides: {
        storefront: {
          noun: { one: 'khakhra', many: 'khakhras', collective: 'khakhra' },
          returnReasonLabels: { damaged_or_melted: 'Arrived broken' },
          coldChain: undefined,
        },
        presentation: { swatches: { saffron: { from: '#f4a300', to: '#9a5f00' } }, defaultSwatch: 'saffron' },
      },
    });
    const base = PRESETS.snacks;
    expect(resolved.storefront.noun.one).toBe('khakhra');
    expect(resolved.storefront.unitNoun).toBe(base.storefront.unitNoun); // untouched
    expect(resolved.storefront.coldChain).toBe(false); // undefined never blanks a field
    expect(resolved.storefront.searchPlaceholder).toBe(base.storefront.searchPlaceholder);
    expect(resolved.storefront.returnReasonLabels).toEqual({
      ...base.storefront.returnReasonLabels,
      damaged_or_melted: 'Arrived broken',
    });
    expect(Object.keys(resolved.presentation.swatches)).toEqual([
      ...Object.keys(base.presentation.swatches),
      'saffron',
    ]);
    expect(resolved.presentation.defaultSwatch).toBe('saffron');
    // Nothing to override → the base blocks are returned by reference.
    const untouched = resolvePreset({ vertical: 'snacks', presetOverrides: { label: 'x' } });
    expect(untouched.storefront).toBe(base.storefront);
    expect(untouched.presentation).toBe(base.presentation);
  });

  it('does not mutate the shipped preset', () => {
    const before = JSON.stringify(PRESETS.chocolate);
    resolvePreset({
      vertical: 'chocolate',
      presetOverrides: { label: 'x', attributeSchema: [{ key: 'tone', label: 'y', type: 'text' }] },
    });
    expect(JSON.stringify(PRESETS.chocolate)).toBe(before);
  });

  it('PRESET_KEYS lists exactly the registry keys', () => {
    expect([...PRESET_KEYS].sort()).toEqual(Object.keys(PRESETS).sort());
  });
});
