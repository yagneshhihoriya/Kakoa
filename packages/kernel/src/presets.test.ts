import { describe, expect, it } from 'vitest';
import { CAPABILITY_KEYS, type Capability } from './capabilities';
import { PRESETS, PRESET_KEYS, getPreset, resolvePreset, type PresetKey } from './presets';

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
