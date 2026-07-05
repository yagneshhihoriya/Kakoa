/**
 * Unit tests for the pure Shiprocket integration parts: the status-code mapper
 * (confirmed codes + label fallback + unknown→null) and the adhoc-order body
 * builder (sub_total, ₹ conversion, phone to 10-digit, payment method).
 */
import { describe, expect, it } from 'vitest';
import {
  buildAdhocOrderBody,
  mapShiprocketStatus,
  type CreateShipmentInput,
} from '@kakoa/integrations';

describe('mapShiprocketStatus', () => {
  it('maps the confirmed lifecycle codes', () => {
    expect(mapShiprocketStatus(42)).toBe('picked_up');
    expect(mapShiprocketStatus(6)).toBe('in_transit');
    expect(mapShiprocketStatus(17)).toBe('out_for_delivery');
    expect(mapShiprocketStatus(7)).toBe('delivered');
    expect(mapShiprocketStatus(9)).toBe('rto_initiated');
    expect(mapShiprocketStatus(10)).toBe('rto_delivered');
    expect(mapShiprocketStatus(5)).toBe('awb_assigned');
  });

  it('accepts numeric-string codes', () => {
    expect(mapShiprocketStatus('7')).toBe('delivered');
  });

  it('falls back to the label substring for an unknown code', () => {
    expect(mapShiprocketStatus(9999, 'Shipment Delivered')).toBe('delivered');
    expect(mapShiprocketStatus(9999, 'RTO Delivered')).toBe('rto_delivered');
    expect(mapShiprocketStatus(9999, 'Out For Delivery')).toBe('out_for_delivery');
  });

  it('returns null for a truly unknown code + no matching label', () => {
    expect(mapShiprocketStatus(9999, 'Some Novel Status')).toBeNull();
    expect(mapShiprocketStatus(null, null)).toBeNull();
    expect(mapShiprocketStatus(undefined)).toBeNull();
  });
});

describe('buildAdhocOrderBody', () => {
  const base: CreateShipmentInput = {
    orderNumber: 'KK-48210',
    orderDateIso: '2026-07-05T10:30:00.000Z',
    cod: false,
    subTotalPaise: 199900,
    pickupLocation: 'Primary',
    billing: {
      name: 'Asha Rao',
      phone: '+919820012345',
      address: 'Flat 4, MG Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      email: 'asha@example.com',
    },
    items: [
      { name: 'Midnight 72%', sku: 'KK-M72', units: 2, sellingPricePaise: 49900 },
      { name: 'Sea Salt', sku: 'KK-SS', units: 1, sellingPricePaise: 99900 },
    ],
    weightGrams: 350,
  };

  it('sends sub_total in RUPEES (not paise, not zero)', () => {
    const body = buildAdhocOrderBody(base);
    expect(body.sub_total).toBe(1999);
  });

  it('converts selling_price paise → rupees per line', () => {
    const body = buildAdhocOrderBody(base) as { order_items: { selling_price: number }[] };
    expect(body.order_items[0]!.selling_price).toBe(499);
    expect(body.order_items[1]!.selling_price).toBe(999);
  });

  it('reduces the phone to 10 digits and sets Prepaid/COD', () => {
    expect(buildAdhocOrderBody(base).billing_phone).toBe('9820012345');
    expect(buildAdhocOrderBody(base).payment_method).toBe('Prepaid');
    expect(buildAdhocOrderBody({ ...base, cod: true }).payment_method).toBe('COD');
  });

  it('sends weight in kg and the order number as the channel reference', () => {
    const body = buildAdhocOrderBody(base);
    expect(body.weight).toBeCloseTo(0.35, 5);
    expect(body.order_id).toBe('KK-48210');
    expect(body.pickup_location).toBe('Primary');
  });
});
