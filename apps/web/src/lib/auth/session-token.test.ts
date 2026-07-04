/**
 * Unit tests for the dep-free session-token primitives (auth-otp.md §1.4, §9).
 * No DB, no next/headers.
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  generateSessionToken,
  hashToken,
  isSessionTokenShape,
} from './session-token';

describe('generateSessionToken', () => {
  it('is a 43-char base64url string (32 random bytes, no padding)', () => {
    for (let i = 0; i < 200; i++) {
      const token = generateSessionToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(token).not.toContain('=');
    }
  });

  it('is unique across draws (CSPRNG)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateSessionToken());
    expect(seen.size).toBe(1000);
  });
});

describe('hashToken', () => {
  it('is the sha256 hex of the raw token', () => {
    const token = generateSessionToken();
    const expected = createHash('sha256').update(token).digest('hex');
    expect(hashToken(token)).toBe(expected);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never returns the raw token (only the hash is DB-bound)', () => {
    const token = generateSessionToken();
    expect(hashToken(token)).not.toBe(token);
  });
});

describe('isSessionTokenShape', () => {
  it('accepts a freshly generated token', () => {
    expect(isSessionTokenShape(generateSessionToken())).toBe(true);
  });

  it('rejects malformed / absent values (no oracle for a bad cookie)', () => {
    expect(isSessionTokenShape(null)).toBe(false);
    expect(isSessionTokenShape(undefined)).toBe(false);
    expect(isSessionTokenShape('')).toBe(false);
    expect(isSessionTokenShape('too-short')).toBe(false);
    expect(isSessionTokenShape('!'.repeat(43))).toBe(false);
    expect(isSessionTokenShape(`${generateSessionToken()}x`)).toBe(false);
  });
});
