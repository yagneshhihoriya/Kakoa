/**
 * Unit tests for the tracking-token HS256 primitives (order-tracking.md §9).
 * DB-free: only node:crypto + SESSION_SECRET. Covers sign/verify roundtrip,
 * tamper rejection, scope enforcement, and expiry semantics (410 vs 404 split).
 */
import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  isTrackingTokenExpired,
  signTrackingToken,
  verifyTrackingToken,
  TRACKING_TOKEN_TTL_SECONDS,
} from './lookup-jwt';

const SECRET = 'test-session-secret-at-least-32-characters-long';
const ORDER_ID = '11111111-2222-4333-8444-555555555555';

const saved = { SESSION_SECRET: process.env.SESSION_SECRET };

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});
afterAll(() => {
  process.env.SESSION_SECRET = saved.SESSION_SECRET;
});

/** Rebuild the scope-namespaced key the module derives, for hand-forged tokens. */
function signingKey(): Buffer {
  return createHmac('sha256', SECRET).update('kakoa.tracking.jwt.v1').digest();
}
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function forge(claims: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const sig = b64url(createHmac('sha256', signingKey()).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

describe('signTrackingToken / verifyTrackingToken', () => {
  it('roundtrips a fresh token to its orderId', () => {
    const token = signTrackingToken(ORDER_ID);
    expect(verifyTrackingToken(token)).toEqual({ orderId: ORDER_ID });
  });

  it('mints a 3-part JWT', () => {
    expect(signTrackingToken(ORDER_ID).split('.')).toHaveLength(3);
  });

  it('rejects a tampered payload (signature no longer matches)', () => {
    const [h, , s] = signTrackingToken(ORDER_ID).split('.');
    const evilPayload = b64url(
      JSON.stringify({
        orderId: '99999999-2222-4333-8444-555555555555',
        scope: 'tracking',
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    );
    expect(verifyTrackingToken(`${h}.${evilPayload}.${s}`)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const [h, p] = signTrackingToken(ORDER_ID).split('.');
    expect(verifyTrackingToken(`${h}.${p}.deadbeef`)).toBeNull();
  });

  it('rejects a token signed with a different key', () => {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64url(
      JSON.stringify({ orderId: ORDER_ID, scope: 'tracking', exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    const wrongSig = b64url(createHmac('sha256', 'a-totally-different-secret-value-32c').update(`${header}.${payload}`).digest());
    expect(verifyTrackingToken(`${header}.${payload}.${wrongSig}`)).toBeNull();
  });

  it("rejects a scope:'login' token even with a valid signature", () => {
    const token = forge({
      orderId: ORDER_ID,
      scope: 'login',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    expect(verifyTrackingToken(token)).toBeNull();
  });

  it('rejects a non-uuid orderId', () => {
    const token = forge({
      orderId: 'not-a-uuid',
      scope: 'tracking',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    expect(verifyTrackingToken(token)).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(verifyTrackingToken('')).toBeNull();
    expect(verifyTrackingToken('a.b')).toBeNull();
    expect(verifyTrackingToken('a.b.c.d')).toBeNull();
  });

  it('rejects an expired token (exp in the past) → null', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-07-04T00:00:00Z'));
      const token = signTrackingToken(ORDER_ID);
      // Advance past the 30-min TTL.
      vi.setSystemTime(new Date(Date.now() + (TRACKING_TOKEN_TTL_SECONDS + 60) * 1000));
      expect(verifyTrackingToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('isTrackingTokenExpired (410 vs 404 split)', () => {
  it('is true for a signature/scope-valid token whose exp passed', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-07-04T00:00:00Z'));
      const token = signTrackingToken(ORDER_ID);
      vi.setSystemTime(new Date(Date.now() + (TRACKING_TOKEN_TTL_SECONDS + 60) * 1000));
      expect(isTrackingTokenExpired(token)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is false for a fresh valid token', () => {
    expect(isTrackingTokenExpired(signTrackingToken(ORDER_ID))).toBe(false);
  });

  it('is false for a tampered/wrong-scope token (→ 404, not 410, no oracle)', () => {
    const loginToken = forge({ orderId: ORDER_ID, scope: 'login', exp: 0 });
    expect(isTrackingTokenExpired(loginToken)).toBe(false);
    expect(isTrackingTokenExpired('garbage.token.here')).toBe(false);
  });
});
