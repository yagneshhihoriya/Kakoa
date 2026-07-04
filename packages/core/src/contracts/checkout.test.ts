import { describe, expect, it } from 'vitest';

import {
  addressInputSchema,
  contactSchema,
  placeOrderInputSchema,
  quoteRequestSchema,
} from './checkout';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const validAddress = {
  fullName: 'Anita Sharma',
  phone: '9876543210',
  line1: '12/A, Rose Villa, MG Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  stateCode: '27',
  pincode: '400001',
};

const validPlaceOrder = {
  idempotencyKey: '3f8a1c2e-4b6d-4a1f-8c9e-1a2b3c4d5e6f',
  contact: { phone: '9876543210' },
  shippingAddress: validAddress,
  deliveryOption: 'standard',
  paymentMode: 'prepaid',
  expectedTotalPaise: 250_000,
};

/* ------------------------------------------------------------------ */
/* contactSchema                                                       */
/* ------------------------------------------------------------------ */

describe('contactSchema', () => {
  it('accepts a 10-digit mobile without email', () => {
    expect(contactSchema.parse({ phone: '9876543210' })).toEqual({
      phone: '9876543210',
    });
  });

  it('lowercases the email', () => {
    const parsed = contactSchema.parse({
      phone: '9876543210',
      email: 'Name@Example.COM',
    });
    expect(parsed.email).toBe('name@example.com');
  });

  it('rejects a phone starting below 6', () => {
    expect(contactSchema.safeParse({ phone: '5876543210' }).success).toBe(
      false,
    );
  });

  it('rejects unknown keys (strict)', () => {
    expect(
      contactSchema.safeParse({ phone: '9876543210', foo: 1 }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* addressInputSchema                                                  */
/* ------------------------------------------------------------------ */

describe('addressInputSchema', () => {
  it('accepts a valid address', () => {
    expect(addressInputSchema.safeParse(validAddress).success).toBe(true);
  });

  it("accepts an apostrophe name (D'Souza)", () => {
    const parsed = addressInputSchema.safeParse({
      ...validAddress,
      fullName: "Maria D'Souza",
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts # / commas and floor markers in line1', () => {
    const parsed = addressInputSchema.safeParse({
      ...validAddress,
      line1: '#3/1, 2nd Floor, Baker St.',
    });
    expect(parsed.success).toBe(true);
  });

  it('strips control chars from line1 before length checks', () => {
    const parsed = addressInputSchema.parse({
      ...validAddress,
      line1: 'Flat 4B, Main Rd',
    });
    expect(parsed.line1).toBe('Flat 4B, Main Rd');
  });

  it('rejects a name that starts with a digit', () => {
    expect(
      addressInputSchema.safeParse({ ...validAddress, fullName: '1Anita' })
        .success,
    ).toBe(false);
  });

  it('rejects a pincode starting with 0', () => {
    expect(
      addressInputSchema.safeParse({ ...validAddress, pincode: '000000' })
        .success,
    ).toBe(false);
  });

  it('rejects a malformed pincode', () => {
    expect(
      addressInputSchema.safeParse({ ...validAddress, pincode: '40001' })
        .success,
    ).toBe(false);
  });

  it('rejects a stateCode not on the canonical list (39)', () => {
    expect(
      addressInputSchema.safeParse({ ...validAddress, stateCode: '39' })
        .success,
    ).toBe(false);
  });

  it('rejects a line1 shorter than 3 chars', () => {
    expect(
      addressInputSchema.safeParse({ ...validAddress, line1: 'ab' }).success,
    ).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(
      addressInputSchema.safeParse({ ...validAddress, country: 'IN' }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* quoteRequestSchema                                                  */
/* ------------------------------------------------------------------ */

describe('quoteRequestSchema', () => {
  it('accepts a valid request and uppercases the coupon', () => {
    const parsed = quoteRequestSchema.parse({
      pincode: '560001',
      deliveryOption: 'express',
      paymentMode: 'cod',
      couponCode: ' welcome-10 ',
    });
    expect(parsed.couponCode).toBe('WELCOME-10');
  });

  it('rejects an unknown delivery option', () => {
    expect(
      quoteRequestSchema.safeParse({
        pincode: '560001',
        deliveryOption: 'drone',
        paymentMode: 'prepaid',
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* placeOrderInputSchema                                               */
/* ------------------------------------------------------------------ */

describe('placeOrderInputSchema', () => {
  it('accepts a valid prepaid placement', () => {
    expect(placeOrderInputSchema.safeParse(validPlaceOrder).success).toBe(true);
  });

  it('accepts a COD placement with an OTP challenge', () => {
    const parsed = placeOrderInputSchema.safeParse({
      ...validPlaceOrder,
      paymentMode: 'cod',
      codOtp: {
        challengeId: '11111111-2222-3333-4444-555555555555',
        code: '042917',
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a non-v4 idempotency key', () => {
    expect(
      placeOrderInputSchema.safeParse({
        ...validPlaceOrder,
        // version nibble is 1, not 4
        idempotencyKey: '3f8a1c2e-4b6d-1a1f-8c9e-1a2b3c4d5e6f',
      }).success,
    ).toBe(false);
  });

  it('rejects expectedTotalPaise above the ₹1,00,000 cap', () => {
    expect(
      placeOrderInputSchema.safeParse({
        ...validPlaceOrder,
        expectedTotalPaise: 10_000_001,
      }).success,
    ).toBe(false);
  });

  it('rejects a non-positive / non-integer expectedTotalPaise', () => {
    expect(
      placeOrderInputSchema.safeParse({
        ...validPlaceOrder,
        expectedTotalPaise: 0,
      }).success,
    ).toBe(false);
    expect(
      placeOrderInputSchema.safeParse({
        ...validPlaceOrder,
        expectedTotalPaise: 199.5,
      }).success,
    ).toBe(false);
  });

  it('rejects a customerNote over 500 chars', () => {
    expect(
      placeOrderInputSchema.safeParse({
        ...validPlaceOrder,
        customerNote: 'x'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(
      placeOrderInputSchema.safeParse({ ...validPlaceOrder, tip: 100 }).success,
    ).toBe(false);
  });
});
