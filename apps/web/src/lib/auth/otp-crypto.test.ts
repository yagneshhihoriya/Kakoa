/**
 * Unit tests for the dep-free OTP crypto primitives (auth-otp.md §1.3, §9).
 * No DB — pure node:crypto + env.
 */
import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  TEST_MODE_CODE,
  generateCode,
  hashCode,
  hashDestination,
  hashesEqual,
  isOtpTestMode,
} from './otp-crypto';

const PEPPER = 'test-pepper-value-at-least-32-chars-long!!';

const savedEnv = {
  OTP_PEPPER: process.env.OTP_PEPPER,
  OTP_TEST_MODE: process.env.OTP_TEST_MODE,
  APP_ENV: process.env.APP_ENV,
};

beforeEach(() => {
  process.env.OTP_PEPPER = PEPPER;
  delete process.env.OTP_TEST_MODE;
  process.env.APP_ENV = 'local';
});

afterEach(() => {
  process.env.OTP_PEPPER = savedEnv.OTP_PEPPER;
  process.env.OTP_TEST_MODE = savedEnv.OTP_TEST_MODE;
  process.env.APP_ENV = savedEnv.APP_ENV;
});

describe('generateCode', () => {
  it('produces a 6-digit zero-padded string', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[0-9]{6}$/);
      expect(code.length).toBe(6);
    }
  });

  it('spans the full space including leading zeros (no obvious modulo bias)', () => {
    const buckets = new Array<number>(10).fill(0);
    const N = 20_000;
    for (let i = 0; i < N; i++) {
      const first = Number(generateCode()[0]);
      buckets[first]!++;
    }
    // Each leading digit 0-9 should appear ~10% of the time; allow wide slack.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(N * 0.06);
      expect(count).toBeLessThan(N * 0.14);
    }
  });

  it('returns the fixed test code only in non-prod test mode', () => {
    process.env.OTP_TEST_MODE = '1';
    process.env.APP_ENV = 'local';
    expect(isOtpTestMode()).toBe(true);
    expect(generateCode()).toBe(TEST_MODE_CODE);

    // Production ignores test mode — never a fixed code.
    process.env.APP_ENV = 'production';
    expect(isOtpTestMode()).toBe(false);
    // Overwhelmingly not the fixed code; assert across many draws.
    let sawOther = false;
    for (let i = 0; i < 50 && !sawOther; i++) {
      if (generateCode() !== TEST_MODE_CODE) sawOther = true;
    }
    expect(sawOther).toBe(true);
  });
});

describe('hashCode', () => {
  it('matches the known sha256(code || pepper) hex vector', () => {
    const code = '042917';
    const expected = createHash('sha256').update(code + PEPPER).digest('hex');
    expect(hashCode(code)).toBe(expected);
    expect(hashCode(code)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is order-sensitive: pepper is appended, not prepended', () => {
    const code = '123456';
    const wrong = createHash('sha256').update(PEPPER + code).digest('hex');
    expect(hashCode(code)).not.toBe(wrong);
  });

  it('treats leading zeros as significant', () => {
    expect(hashCode('042917')).not.toBe(hashCode('42917'));
  });

  it('throws when the pepper is missing or too short', () => {
    process.env.OTP_PEPPER = 'short';
    expect(() => hashCode('123456')).toThrow(/OTP_PEPPER/);
  });
});

describe('hashesEqual', () => {
  it('is true for identical hashes and false otherwise', () => {
    const a = hashCode('111111');
    expect(hashesEqual(a, a)).toBe(true);
    expect(hashesEqual(a, hashCode('222222'))).toBe(false);
  });

  it('is false for different lengths without throwing', () => {
    expect(hashesEqual('abc', 'abcd')).toBe(false);
  });
});

describe('hashDestination', () => {
  it('is a stable sha256 hex of the destination', () => {
    const dest = '+919876543210';
    const expected = createHash('sha256').update(dest).digest('hex');
    expect(hashDestination(dest)).toBe(expected);
  });
});
