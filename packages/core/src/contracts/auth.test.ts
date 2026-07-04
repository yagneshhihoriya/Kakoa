import { describe, expect, it } from 'vitest';

import {
  otpRequestInputSchema,
  otpVerifyInputSchema,
} from './auth';

describe('otpRequestInputSchema', () => {
  it('round-trips a valid sms login request', () => {
    const input = {
      channel: 'sms',
      destination: '+919876543210',
      purpose: 'customer_login',
    } as const;
    expect(otpRequestInputSchema.parse(input)).toEqual(input);
  });

  it('accepts the email channel', () => {
    const input = {
      channel: 'email',
      destination: 'a@b.com',
      purpose: 'customer_login',
    } as const;
    expect(otpRequestInputSchema.parse(input)).toEqual(input);
  });

  it('rejects an unknown channel', () => {
    expect(
      otpRequestInputSchema.safeParse({
        channel: 'whatsapp',
        destination: '+919876543210',
        purpose: 'customer_login',
      }).success,
    ).toBe(false);
  });

  it('rejects a non-customer_login purpose', () => {
    expect(
      otpRequestInputSchema.safeParse({
        channel: 'sms',
        destination: '+919876543210',
        purpose: 'admin_login',
      }).success,
    ).toBe(false);
  });

  it('rejects an empty destination and one over 254 chars', () => {
    expect(
      otpRequestInputSchema.safeParse({
        channel: 'sms',
        destination: '',
        purpose: 'customer_login',
      }).success,
    ).toBe(false);
    expect(
      otpRequestInputSchema.safeParse({
        channel: 'email',
        destination: `${'a'.repeat(250)}@b.com`,
        purpose: 'customer_login',
      }).success,
    ).toBe(false);
  });

  it('rejects unknown keys (.strict)', () => {
    expect(
      otpRequestInputSchema.safeParse({
        channel: 'sms',
        destination: '+919876543210',
        purpose: 'customer_login',
        extra: 'x',
      }).success,
    ).toBe(false);
  });
});

describe('otpVerifyInputSchema', () => {
  const challengeId = 'b5f8c2d0-1e2a-4b3c-8d4e-5f6a7b8c9d0e';

  it('round-trips a valid verify request', () => {
    expect(
      otpVerifyInputSchema.parse({ challengeId, code: '042917' }),
    ).toEqual({ challengeId, code: '042917' });
  });

  it('trims surrounding whitespace on code', () => {
    expect(
      otpVerifyInputSchema.parse({ challengeId, code: '  123456  ' }).code,
    ).toBe('123456');
  });

  it('preserves significant leading zeros', () => {
    expect(otpVerifyInputSchema.parse({ challengeId, code: '000000' }).code).toBe(
      '000000',
    );
  });

  it('rejects a non-uuid challengeId', () => {
    expect(
      otpVerifyInputSchema.safeParse({ challengeId: 'not-a-uuid', code: '123456' })
        .success,
    ).toBe(false);
  });

  it('rejects codes that are not exactly 6 digits', () => {
    for (const code of ['12345', '1234567', '12a456', 'abcdef', '']) {
      expect(
        otpVerifyInputSchema.safeParse({ challengeId, code }).success,
      ).toBe(false);
    }
  });

  it('rejects unknown keys (.strict)', () => {
    expect(
      otpVerifyInputSchema.safeParse({
        challengeId,
        code: '123456',
        foo: 'bar',
      }).success,
    ).toBe(false);
  });
});
