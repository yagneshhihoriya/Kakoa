import { describe, expect, it } from 'vitest';
import { CAPABILITY_KEYS, type Capability } from './capabilities';
import { PRESETS, getPreset, type PresetKey } from './presets';

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
