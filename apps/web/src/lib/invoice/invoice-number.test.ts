/**
 * Unit tests for the pure invoice-number derivation: the Indian FY (Apr–Mar)
 * boundary in IST, the order numeric suffix, and determinism.
 */
import { describe, expect, it } from 'vitest';
import { deriveInvoiceNumber } from './invoice-number';

describe('deriveInvoiceNumber', () => {
  it('uses the FY that STARTS in April (a July date → that year–next)', () => {
    // 2026-07-05 → FY 2026-27 → "26-27".
    expect(deriveInvoiceNumber('KK-48210', new Date('2026-07-05T09:00:00Z'))).toBe('KK/26-27/48210');
  });

  it('puts Jan–Mar in the PREVIOUS FY-start year', () => {
    // 2026-02-15 → FY 2025-26 → "25-26".
    expect(deriveInvoiceNumber('KK-48210', new Date('2026-02-15T09:00:00Z'))).toBe('KK/25-26/48210');
  });

  it('evaluates the boundary in IST, not UTC', () => {
    // 2026-03-31T20:00Z = 2026-04-01 01:30 IST → new FY 2026-27.
    expect(deriveInvoiceNumber('KK-48210', new Date('2026-03-31T20:00:00Z'))).toBe('KK/26-27/48210');
    // 2026-03-31T10:00Z = 2026-03-31 15:30 IST → still FY 2025-26.
    expect(deriveInvoiceNumber('KK-48210', new Date('2026-03-31T10:00:00Z'))).toBe('KK/25-26/48210');
  });

  it('extracts + pads the order numeric suffix', () => {
    expect(deriveInvoiceNumber('KK-42', new Date('2026-07-05T09:00:00Z'))).toBe('KK/26-27/00042');
    expect(deriveInvoiceNumber('KK-123456', new Date('2026-07-05T09:00:00Z'))).toBe('KK/26-27/123456');
  });

  it('is deterministic (same inputs → same number)', () => {
    const d = new Date('2026-07-05T09:00:00Z');
    expect(deriveInvoiceNumber('KK-48210', d)).toBe(deriveInvoiceNumber('KK-48210', d));
  });
});
