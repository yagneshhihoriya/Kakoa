import { describe, expect, it } from 'vitest';

import { ORDER_STATUSES, type OrderStatus } from './enums';
import {
  ORDER_TRANSITIONS,
  TERMINAL_STATES,
  IllegalTransitionError,
  assertTransition,
  canTransition,
  isTerminal,
  nextStatuses,
} from './order-state-machine';

/**
 * Hand-written legal-transition list, transcribed INDEPENDENTLY from
 * Contract §1.27 — the test would catch a drifted ORDER_TRANSITIONS map.
 */
const LEGAL_PAIRS: ReadonlyArray<readonly [OrderStatus, OrderStatus]> = [
  ['pending_payment', 'confirmed'],
  ['pending_payment', 'payment_failed'],
  ['pending_payment', 'cancelled'],
  ['payment_failed', 'pending_payment'],
  ['payment_failed', 'cancelled'],
  ['cod_pending_confirmation', 'confirmed'],
  ['cod_pending_confirmation', 'cancelled'],
  ['confirmed', 'packed'],
  ['confirmed', 'cancelled'],
  ['packed', 'shipped'],
  ['packed', 'cancelled'],
  ['shipped', 'out_for_delivery'],
  ['shipped', 'delivered'],
  ['shipped', 'rto_initiated'],
  ['out_for_delivery', 'delivered'],
  ['out_for_delivery', 'rto_initiated'],
  ['rto_initiated', 'out_for_delivery'],
  ['rto_initiated', 'rto_delivered'],
];

const legalSet = new Set(LEGAL_PAIRS.map(([f, t]) => `${f}->${t}`));

describe('full 11x11 transition matrix (121 cases)', () => {
  const allPairs: Array<[OrderStatus, OrderStatus, boolean]> = [];
  for (const from of ORDER_STATUSES) {
    for (const to of ORDER_STATUSES) {
      allPairs.push([from, to, legalSet.has(`${from}->${to}`)]);
    }
  }

  it('covers exactly 121 pairs with 18 legal transitions', () => {
    expect(allPairs).toHaveLength(121);
    expect(allPairs.filter(([, , legal]) => legal)).toHaveLength(18);
  });

  it.each(allPairs)('%s -> %s legal=%s', (from, to, legal) => {
    expect(canTransition(from, to)).toBe(legal);
    if (legal) {
      expect(() => assertTransition(from, to)).not.toThrow();
    } else {
      expect(() => assertTransition(from, to)).toThrow(IllegalTransitionError);
    }
  });
});

describe('assertTransition error shape', () => {
  it('throws a typed error carrying from/to and INVALID_TRANSITION code', () => {
    try {
      assertTransition('delivered', 'confirmed');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalTransitionError);
      const err = e as IllegalTransitionError;
      expect(err.code).toBe('INVALID_TRANSITION');
      expect(err.from).toBe('delivered');
      expect(err.to).toBe('confirmed');
      expect(err.message).toContain('delivered -> confirmed');
    }
  });

  it('no self-transitions are legal', () => {
    for (const s of ORDER_STATUSES) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});

describe('terminal states', () => {
  it('exactly delivered, cancelled, rto_delivered are terminal', () => {
    expect([...TERMINAL_STATES].sort()).toEqual(
      ['cancelled', 'delivered', 'rto_delivered'].sort(),
    );
    for (const s of ORDER_STATUSES) {
      expect(isTerminal(s)).toBe(
        s === 'delivered' || s === 'cancelled' || s === 'rto_delivered',
      );
    }
  });

  it('terminal states have zero outgoing transitions; non-terminal have some', () => {
    for (const s of ORDER_STATUSES) {
      if (isTerminal(s)) {
        expect(ORDER_TRANSITIONS[s]).toHaveLength(0);
        expect(nextStatuses(s)).toHaveLength(0);
      } else {
        expect(ORDER_TRANSITIONS[s].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('transition metadata (triggers/actors)', () => {
  it('every transition declares a trigger and at least one valid actor', () => {
    for (const from of ORDER_STATUSES) {
      for (const t of ORDER_TRANSITIONS[from]) {
        expect(t.trigger.length).toBeGreaterThan(0);
        expect(t.actors.length).toBeGreaterThan(0);
      }
    }
  });

  it('spot checks per Contract §1.27', () => {
    const pp = ORDER_TRANSITIONS.pending_payment;
    expect(pp.find((t) => t.to === 'confirmed')?.actors).toEqual([
      'system',
      'webhook',
    ]);
    expect(pp.find((t) => t.to === 'payment_failed')?.actors).toEqual([
      'webhook',
    ]);
    expect(
      ORDER_TRANSITIONS.confirmed.find((t) => t.to === 'packed')?.actors,
    ).toEqual(['admin']);
    expect(
      ORDER_TRANSITIONS.cod_pending_confirmation.find(
        (t) => t.to === 'cancelled',
      )?.actors,
    ).toEqual(['admin', 'customer', 'system']);
  });
});
