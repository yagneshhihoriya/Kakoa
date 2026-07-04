import { describe, expect, it } from 'vitest';
import { maskEmail, maskPhoneMaybe } from './customer-privacy';

describe('maskEmail', () => {
  it('keeps the first local char and the full domain', () => {
    expect(maskEmail('john@kakoa.in')).toBe('j•••@kakoa.in');
    expect(maskEmail('alice.smith@gmail.com')).toBe('a•••@gmail.com');
  });

  it('reveals nothing for a one-char local part', () => {
    expect(maskEmail('a@x.com')).toBe('•••@x.com');
  });

  it('trims and is case-preserving on the domain', () => {
    expect(maskEmail('  Bob@Domain.COM  ')).toBe('B•••@Domain.COM');
  });

  it('never leaks a malformed value', () => {
    expect(maskEmail('notanemail')).toBe('•••');
    expect(maskEmail('@nolocal.com')).toBe('•••');
    expect(maskEmail('nodomain@')).toBe('•••');
  });

  it('returns null for null / blank', () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail(undefined)).toBeNull();
    expect(maskEmail('')).toBeNull();
    expect(maskEmail('   ')).toBeNull();
  });
});

describe('maskPhoneMaybe', () => {
  it('masks a valid +91 mobile', () => {
    expect(maskPhoneMaybe('+919876543210')).toBe('+91 98•••••210');
  });

  it('returns null for null / blank (nullable phone column)', () => {
    expect(maskPhoneMaybe(null)).toBeNull();
    expect(maskPhoneMaybe(undefined)).toBeNull();
    expect(maskPhoneMaybe('')).toBeNull();
  });
});
