import { describe, expect, it } from 'vitest';
import { pgConstraintMessage, withConstraintMapping } from './db-errors';

describe('pgConstraintMessage', () => {
  it('maps unique violations (23505) by constraint', () => {
    expect(pgConstraintMessage({ code: '23505', constraint_name: 'product_variants_sku_unique' })).toBe(
      'That SKU is already in use.',
    );
    expect(pgConstraintMessage({ code: '23505', constraint_name: 'products_slug_unique' })).toMatch(/similar name/);
    expect(pgConstraintMessage({ code: '23505', constraint_name: 'weird' })).toBe('That value is already in use.');
  });

  it('maps check violations (23514) by constraint', () => {
    expect(pgConstraintMessage({ code: '23514', constraint_name: 'product_variants_compare_at_check' })).toMatch(
      /compare-at/,
    );
    expect(pgConstraintMessage({ code: '23514', constraint_name: 'product_variants_stock_check' })).toMatch(/Stock/);
  });

  it('maps foreign-key violations (23503)', () => {
    expect(pgConstraintMessage({ code: '23503', constraint_name: 'x' })).toMatch(/referenced record/);
  });

  it('returns null for non-constraint errors (caller rethrows)', () => {
    expect(pgConstraintMessage({ code: '08006' })).toBeNull();
    expect(pgConstraintMessage(new Error('boom'))).toBeNull();
    expect(pgConstraintMessage(null)).toBeNull();
    expect(pgConstraintMessage('nope')).toBeNull();
  });
});

describe('withConstraintMapping', () => {
  it('passes success results through unchanged', async () => {
    const r = await withConstraintMapping(async () => ({ ok: true as const, id: 'x' }));
    expect(r).toEqual({ ok: true, id: 'x' });
  });

  it('converts a mappable pg error into a VALIDATION_ERROR result', async () => {
    const r = await withConstraintMapping(async () => {
      throw { code: '23505', constraint_name: 'product_variants_sku_unique' };
    });
    expect(r).toEqual({ ok: false, code: 'VALIDATION_ERROR', message: 'That SKU is already in use.' });
  });

  it('rethrows an unmappable error', async () => {
    await expect(
      withConstraintMapping(async () => {
        throw new Error('connection reset');
      }),
    ).rejects.toThrow('connection reset');
  });
});
