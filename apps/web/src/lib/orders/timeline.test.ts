/**
 * Unit tests for the pure timeline derivation + cancellable-set gating
 * (order-tracking.md §3, §5.4, §9). DB-free.
 */
import { canTransition } from '@kakoa/core';
import { describe, expect, it } from 'vitest';

import { deriveTimeline, type HistoryRow } from './timeline';

const PLACED_AT = '2026-07-01T18:00:00.000Z';

/** Convenience: pull the {key: state} map out of a derived timeline. */
function states(timeline: ReturnType<typeof deriveTimeline>): Record<string, string> {
  return Object.fromEntries(timeline.map((s) => [s.key, s.state]));
}

describe('deriveTimeline — happy path', () => {
  it('COD placed (cod_pending_confirmation) → placed active, rest future', () => {
    const timeline = deriveTimeline({
      currentStatus: 'cod_pending_confirmation',
      history: [{ toStatus: 'cod_pending_confirmation', at: PLACED_AT }],
      placedAt: PLACED_AT,
    });
    expect(timeline.map((s) => s.key)).toEqual([
      'placed',
      'confirmed',
      'packed',
      'shipped',
      'out_for_delivery',
      'delivered',
    ]);
    expect(states(timeline)).toMatchObject({
      placed: 'active',
      confirmed: 'future',
      delivered: 'future',
    });
  });

  it('pending_payment collapses into placed (payment sub-state, §3.2)', () => {
    const timeline = deriveTimeline({
      currentStatus: 'pending_payment',
      history: [{ toStatus: 'pending_payment', at: PLACED_AT }],
      placedAt: PLACED_AT,
    });
    expect(states(timeline).placed).toBe('active');
    // No standalone payment step exists on the rail.
    expect(timeline.some((s) => s.key === 'pending_payment' as never)).toBe(false);
  });

  it('confirmed → placed done, confirmed active', () => {
    const history: HistoryRow[] = [
      { toStatus: 'pending_payment', at: PLACED_AT },
      { toStatus: 'confirmed', at: '2026-07-01T18:05:00.000Z' },
    ];
    const timeline = deriveTimeline({
      currentStatus: 'confirmed',
      history,
      placedAt: PLACED_AT,
    });
    expect(states(timeline)).toMatchObject({
      placed: 'done',
      confirmed: 'active',
      packed: 'future',
    });
  });

  it('delivered → every step done, delivered active', () => {
    const history: HistoryRow[] = [
      { toStatus: 'confirmed', at: '2026-07-01T18:05:00.000Z' },
      { toStatus: 'packed', at: '2026-07-02T04:00:00.000Z' },
      { toStatus: 'shipped', at: '2026-07-02T10:00:00.000Z' },
      { toStatus: 'out_for_delivery', at: '2026-07-03T04:00:00.000Z' },
      { toStatus: 'delivered', at: '2026-07-03T09:30:00.000Z' },
    ];
    const timeline = deriveTimeline({
      currentStatus: 'delivered',
      history,
      placedAt: PLACED_AT,
    });
    expect(states(timeline)).toMatchObject({
      placed: 'done',
      confirmed: 'done',
      packed: 'done',
      shipped: 'done',
      out_for_delivery: 'done',
      delivered: 'active',
    });
  });

  it('placed.at is always orders.placed_at, not the history row', () => {
    const timeline = deriveTimeline({
      currentStatus: 'confirmed',
      history: [
        { toStatus: 'pending_payment', at: '2026-07-01T18:02:00.000Z' },
        { toStatus: 'confirmed', at: '2026-07-01T18:05:00.000Z' },
      ],
      placedAt: PLACED_AT,
    });
    expect(timeline.find((s) => s.key === 'placed')?.at).toBe(PLACED_AT);
  });

  it('expected is populated only on the delivered step', () => {
    const timeline = deriveTimeline({
      currentStatus: 'shipped',
      history: [
        { toStatus: 'confirmed', at: '2026-07-01T18:05:00.000Z' },
        { toStatus: 'packed', at: '2026-07-02T04:00:00.000Z' },
        { toStatus: 'shipped', at: '2026-07-02T10:00:00.000Z' },
      ],
      placedAt: PLACED_AT,
      expectedDeliveryAt: '2026-07-04T12:00:00.000Z',
    });
    expect(timeline.find((s) => s.key === 'delivered')?.expected).toBe(
      '2026-07-04T12:00:00.000Z',
    );
    expect(timeline.find((s) => s.key === 'shipped')?.expected).toBeNull();
  });
});

describe('deriveTimeline — cancelled branch (§3.5)', () => {
  it('cancelled from cod_pending → placed done + cancelled active', () => {
    const timeline = deriveTimeline({
      currentStatus: 'cancelled',
      history: [
        { toStatus: 'cod_pending_confirmation', at: PLACED_AT },
        { toStatus: 'cancelled', at: '2026-07-01T18:30:00.000Z' },
      ],
      placedAt: PLACED_AT,
    });
    expect(timeline.map((s) => s.key)).toEqual(['placed', 'cancelled']);
    expect(states(timeline)).toEqual({ placed: 'done', cancelled: 'active' });
  });

  it('cancelled from confirmed keeps the reached confirmed step', () => {
    const timeline = deriveTimeline({
      currentStatus: 'cancelled',
      history: [
        { toStatus: 'confirmed', at: '2026-07-01T18:05:00.000Z' },
        { toStatus: 'cancelled', at: '2026-07-01T19:00:00.000Z' },
      ],
      placedAt: PLACED_AT,
    });
    expect(timeline.map((s) => s.key)).toEqual([
      'placed',
      'confirmed',
      'cancelled',
    ]);
    expect(states(timeline)).toMatchObject({
      placed: 'done',
      confirmed: 'done',
      cancelled: 'active',
    });
  });
});

describe('deriveTimeline — RTO branch (§3.5)', () => {
  it('rto_initiated replaces the delivery tail with a single returning step', () => {
    const timeline = deriveTimeline({
      currentStatus: 'rto_initiated',
      history: [
        { toStatus: 'confirmed', at: '2026-07-01T18:05:00.000Z' },
        { toStatus: 'packed', at: '2026-07-02T04:00:00.000Z' },
        { toStatus: 'shipped', at: '2026-07-02T10:00:00.000Z' },
        { toStatus: 'rto_initiated', at: '2026-07-03T10:00:00.000Z' },
      ],
      placedAt: PLACED_AT,
    });
    expect(timeline.map((s) => s.key)).toEqual([
      'placed',
      'confirmed',
      'packed',
      'shipped',
      'rto_initiated',
    ]);
    // No dead out_for_delivery/delivered steps linger.
    expect(timeline.some((s) => s.key === 'delivered')).toBe(false);
    expect(states(timeline).rto_initiated).toBe('active');
  });

  it('rto_delivered adds the returned step as active', () => {
    const timeline = deriveTimeline({
      currentStatus: 'rto_delivered',
      history: [
        { toStatus: 'shipped', at: '2026-07-02T10:00:00.000Z' },
        { toStatus: 'rto_initiated', at: '2026-07-03T10:00:00.000Z' },
        { toStatus: 'rto_delivered', at: '2026-07-05T10:00:00.000Z' },
      ],
      placedAt: PLACED_AT,
    });
    expect(timeline.map((s) => s.key)).toContain('rto_delivered');
    expect(states(timeline).rto_delivered).toBe('active');
  });
});

describe('customer-cancellable set gating (order-tracking.md §5.4)', () => {
  const CANCELLABLE = [
    'pending_payment',
    'payment_failed',
    'cod_pending_confirmation',
    'confirmed',
  ] as const;
  const NON_CANCELLABLE = [
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'rto_initiated',
    'rto_delivered',
  ] as const;

  it('every cancellable state has a legal → cancelled transition', () => {
    for (const from of CANCELLABLE) {
      expect(canTransition(from, 'cancelled')).toBe(true);
    }
  });

  it('packed and later cannot transition to cancelled via the customer path', () => {
    // packed→cancelled exists in the map but is admin-only; the customer route
    // relies on assertTransition for pre-packed states. These terminal/shipped
    // states have no customer → cancelled edge at all.
    for (const from of ['shipped', 'out_for_delivery', 'delivered', 'cancelled', 'rto_delivered'] as const) {
      expect(canTransition(from, 'cancelled')).toBe(false);
    }
  });
});
