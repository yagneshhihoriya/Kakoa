import { describe, expect, it } from 'vitest';

import { addressInputSchema } from './checkout';
import {
  addressIdSchema,
  createAddressInputSchema,
  savedAddressSchema,
  updateAddressInputSchema,
} from './address';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const validShipping = {
  fullName: 'Anita Sharma',
  phone: '9876543210',
  line1: '12/A, Rose Villa, MG Road',
  line2: 'Near the old bank',
  landmark: 'Opposite the temple',
  city: 'Mumbai',
  state: 'Maharashtra',
  stateCode: '27',
  pincode: '400001',
};

/* ------------------------------------------------------------------ */
/* savedAddressSchema                                                  */
/* ------------------------------------------------------------------ */

describe('savedAddressSchema', () => {
  it('accepts a full saved address and defaults label + isDefault', () => {
    const parsed = savedAddressSchema.parse(validShipping);
    expect(parsed.label).toBe('Home');
    expect(parsed.isDefault).toBe(false);
    expect(parsed.stateCode).toBe('27');
  });

  it('accepts an explicit label and isDefault', () => {
    const parsed = savedAddressSchema.parse({
      ...validShipping,
      label: 'Work',
      isDefault: true,
    });
    expect(parsed.label).toBe('Work');
    expect(parsed.isDefault).toBe(true);
  });

  it('round-trips: a parsed saved address validates against addressInputSchema', () => {
    const parsed = savedAddressSchema.parse({ ...validShipping, label: 'Mom' });
    // Strip book-only metadata; the remaining shape must be a valid checkout address.
    const { label: _label, isDefault: _isDefault, ...shipping } = parsed;
    expect(addressInputSchema.safeParse(shipping).success).toBe(true);
  });

  it('round-trips at the max lengths (line1 150, landmark 100)', () => {
    const big = {
      ...validShipping,
      line1: 'a'.repeat(150),
      landmark: 'b'.repeat(100),
    };
    const parsed = savedAddressSchema.parse(big);
    const { label: _l, isDefault: _d, ...shipping } = parsed;
    expect(addressInputSchema.safeParse(shipping).success).toBe(true);
  });

  it('rejects an empty label', () => {
    expect(
      savedAddressSchema.safeParse({ ...validShipping, label: '   ' }).success,
    ).toBe(false);
  });

  it('rejects a label over 30 characters', () => {
    expect(
      savedAddressSchema.safeParse({
        ...validShipping,
        label: 'x'.repeat(31),
      }).success,
    ).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(
      savedAddressSchema.safeParse({ ...validShipping, foo: 1 }).success,
    ).toBe(false);
  });

  it('rejects an invalid state code', () => {
    expect(
      savedAddressSchema.safeParse({ ...validShipping, stateCode: '99' })
        .success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* createAddressInputSchema                                            */
/* ------------------------------------------------------------------ */

describe('createAddressInputSchema', () => {
  it('accepts a create payload without isDefault', () => {
    const parsed = createAddressInputSchema.parse(validShipping);
    expect(parsed.label).toBe('Home');
    expect('isDefault' in parsed && parsed.isDefault).toBeFalsy();
  });

  it('accepts an optional isDefault', () => {
    const parsed = createAddressInputSchema.parse({
      ...validShipping,
      isDefault: true,
    });
    expect(parsed.isDefault).toBe(true);
  });

  it('rejects unknown keys (strict)', () => {
    expect(
      createAddressInputSchema.safeParse({ ...validShipping, bar: true })
        .success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* updateAddressInputSchema                                            */
/* ------------------------------------------------------------------ */

describe('updateAddressInputSchema', () => {
  const id = '3f8a1c2e-4b6d-4a1f-8c9e-1a2b3c4d5e6f';

  it('accepts an id with a partial subset of fields', () => {
    const parsed = updateAddressInputSchema.parse({ id, label: 'Office' });
    expect(parsed.id).toBe(id);
    expect(parsed.label).toBe('Office');
    expect('city' in parsed).toBe(false);
  });

  it('accepts an id alone (no field changes)', () => {
    expect(updateAddressInputSchema.parse({ id }).id).toBe(id);
  });

  it('accepts a full field update', () => {
    const parsed = updateAddressInputSchema.parse({
      id,
      ...validShipping,
      isDefault: true,
    });
    expect(parsed.pincode).toBe('400001');
    expect(parsed.isDefault).toBe(true);
  });

  it('rejects a missing id', () => {
    expect(updateAddressInputSchema.safeParse({ label: 'Home' }).success).toBe(
      false,
    );
  });

  it('rejects a bad uuid', () => {
    expect(
      updateAddressInputSchema.safeParse({ id: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('rejects an invalid field value when supplied', () => {
    expect(
      updateAddressInputSchema.safeParse({ id, stateCode: '99' }).success,
    ).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(
      updateAddressInputSchema.safeParse({ id, foo: 1 }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* addressIdSchema                                                     */
/* ------------------------------------------------------------------ */

describe('addressIdSchema', () => {
  it('accepts a valid uuid', () => {
    const id = '3f8a1c2e-4b6d-4a1f-8c9e-1a2b3c4d5e6f';
    expect(addressIdSchema.parse({ id }).id).toBe(id);
  });

  it('rejects a non-uuid', () => {
    expect(addressIdSchema.safeParse({ id: '123' }).success).toBe(false);
  });

  it('rejects extra keys (strict)', () => {
    const id = '3f8a1c2e-4b6d-4a1f-8c9e-1a2b3c4d5e6f';
    expect(addressIdSchema.safeParse({ id, extra: 1 }).success).toBe(false);
  });
});
