/**
 * Unit tests for the pure shipment status machine + AWB validation. Covers the
 * forward track, the RTO branch, terminals, every illegal/backward move, and the
 * AWB validator — the monotonic guard the whole console relies on.
 */
import { describe, expect, it } from 'vitest';
import {
  canAdvanceShipment,
  isTerminalShipment,
  nextShipmentStatuses,
  validateAwbInput,
} from './shipping-status';

describe('canAdvanceShipment — forward track', () => {
  it('allows each legal forward step', () => {
    expect(canAdvanceShipment('pending', 'awb_assigned')).toBe(true);
    expect(canAdvanceShipment('awb_assigned', 'pickup_scheduled')).toBe(true);
    expect(canAdvanceShipment('pickup_scheduled', 'picked_up')).toBe(true);
    expect(canAdvanceShipment('picked_up', 'in_transit')).toBe(true);
    expect(canAdvanceShipment('in_transit', 'out_for_delivery')).toBe(true);
    expect(canAdvanceShipment('out_for_delivery', 'delivered')).toBe(true);
  });

  it('forbids skipping forward steps', () => {
    expect(canAdvanceShipment('pending', 'picked_up')).toBe(false);
    expect(canAdvanceShipment('awb_assigned', 'delivered')).toBe(false);
    expect(canAdvanceShipment('pickup_scheduled', 'in_transit')).toBe(false);
  });

  it('forbids backward moves (never regress)', () => {
    expect(canAdvanceShipment('in_transit', 'picked_up')).toBe(false);
    expect(canAdvanceShipment('out_for_delivery', 'in_transit')).toBe(false);
    expect(canAdvanceShipment('delivered', 'out_for_delivery')).toBe(false);
    expect(canAdvanceShipment('picked_up', 'pending')).toBe(false);
  });

  it('forbids no-op self transitions', () => {
    expect(canAdvanceShipment('in_transit', 'in_transit')).toBe(false);
  });
});

describe('canAdvanceShipment — RTO branch', () => {
  it('enters RTO only from an in-flight forward state', () => {
    expect(canAdvanceShipment('picked_up', 'rto_initiated')).toBe(true);
    expect(canAdvanceShipment('in_transit', 'rto_initiated')).toBe(true);
    expect(canAdvanceShipment('out_for_delivery', 'rto_initiated')).toBe(true);
    // Not from pre-pickup states.
    expect(canAdvanceShipment('pending', 'rto_initiated')).toBe(false);
    expect(canAdvanceShipment('awb_assigned', 'rto_initiated')).toBe(false);
    expect(canAdvanceShipment('pickup_scheduled', 'rto_initiated')).toBe(false);
  });

  it('ascends the RTO track', () => {
    expect(canAdvanceShipment('rto_initiated', 'rto_in_transit')).toBe(true);
    expect(canAdvanceShipment('rto_in_transit', 'rto_delivered')).toBe(true);
  });

  it('cannot jump back to the forward track after RTO', () => {
    expect(canAdvanceShipment('rto_initiated', 'out_for_delivery')).toBe(false);
    expect(canAdvanceShipment('rto_initiated', 'delivered')).toBe(false);
    expect(canAdvanceShipment('rto_in_transit', 'in_transit')).toBe(false);
  });
});

describe('canAdvanceShipment — exceptions & terminals', () => {
  it('allows cancelled / lost from any non-terminal state', () => {
    expect(canAdvanceShipment('pending', 'cancelled')).toBe(true);
    expect(canAdvanceShipment('in_transit', 'lost')).toBe(true);
    expect(canAdvanceShipment('rto_initiated', 'cancelled')).toBe(true);
  });

  it('never transitions from a terminal state', () => {
    for (const t of ['delivered', 'rto_delivered', 'cancelled', 'lost'] as const) {
      expect(isTerminalShipment(t)).toBe(true);
      expect(canAdvanceShipment(t, 'cancelled')).toBe(false);
      expect(canAdvanceShipment(t, 'in_transit')).toBe(false);
    }
  });
});

describe('nextShipmentStatuses', () => {
  it('offers the right advance targets (excludes awb_assigned and terminals)', () => {
    expect(nextShipmentStatuses('pending')).toEqual([]);
    expect(nextShipmentStatuses('awb_assigned')).toEqual(['pickup_scheduled']);
    expect(nextShipmentStatuses('picked_up')).toEqual(['in_transit', 'rto_initiated']);
    expect(nextShipmentStatuses('out_for_delivery')).toEqual(['delivered', 'rto_initiated']);
    expect(nextShipmentStatuses('rto_initiated')).toEqual(['rto_in_transit']);
    expect(nextShipmentStatuses('delivered')).toEqual([]);
    expect(nextShipmentStatuses('cancelled')).toEqual([]);
  });
});

describe('validateAwbInput', () => {
  it('accepts a well-formed AWB with optional courier fields', () => {
    const r = validateAwbInput({ awbCode: 'KKMOCK-12AB', courierName: 'Mock Express', courierCompanyId: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.awbCode).toBe('KKMOCK-12AB');
      expect(r.value.courierCompanyId).toBe(3);
    }
  });

  it('accepts a bare AWB (courier fields omitted)', () => {
    const r = validateAwbInput({ awbCode: 'ABCD1234' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.courierName).toBeNull();
      expect(r.value.courierCompanyId).toBeNull();
    }
  });

  it('rejects a too-short / bad-char / too-long AWB', () => {
    expect(validateAwbInput({ awbCode: 'ab' }).ok).toBe(false);
    expect(validateAwbInput({ awbCode: 'has space' }).ok).toBe(false);
    expect(validateAwbInput({ awbCode: 'x'.repeat(41) }).ok).toBe(false);
    expect(validateAwbInput({ awbCode: '' }).ok).toBe(false);
  });

  it('rejects a bad courier name / company id', () => {
    expect(validateAwbInput({ awbCode: 'ABCD1234', courierName: 'x'.repeat(81) }).ok).toBe(false);
    expect(validateAwbInput({ awbCode: 'ABCD1234', courierCompanyId: 0 }).ok).toBe(false);
    expect(validateAwbInput({ awbCode: 'ABCD1234', courierCompanyId: 1.5 }).ok).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(validateAwbInput(null).ok).toBe(false);
    expect(validateAwbInput('ABCD1234').ok).toBe(false);
  });
});
