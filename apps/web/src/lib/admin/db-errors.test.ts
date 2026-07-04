import { describe, expect, it } from 'vitest';
import { pgConstraintMessage, withConstraintMapping } from './db-errors';

/** Shape drizzle/postgres-js actually throws: a wrapper Error with the PostgresError in `.cause`. */
function wrapped(code: string, constraint_name: string): Error {
  return new Error('Failed query: insert into …', { cause: { code, constraint_name } });
}

describe('pgConstraintMessage', () => {
  it('unwraps drizzle .cause to map unique violations (23505) by constraint', () => {
    expect(pgConstraintMessage(wrapped('23505', 'product_variants_sku_unique'))).toBe('That SKU is already in use.');
    expect(pgConstraintMessage(wrapped('23505', 'products_slug_unique'))).toMatch(/similar name/);
    expect(pgConstraintMessage(wrapped('23505', 'coupons_code_unique'))).toBe('That code is already in use.');
    expect(pgConstraintMessage(wrapped('23505', 'weird'))).toBe('That value is already in use.');
  });

  it('also handles an unwrapped PostgresError directly', () => {
    expect(pgConstraintMessage({ code: '23505', constraint_name: 'product_variants_sku_unique' })).toBe(
      'That SKU is already in use.',
    );
  });

  it('maps check violations (23514) by constraint', () => {
    expect(pgConstraintMessage(wrapped('23514', 'product_variants_compare_at_check'))).toMatch(/compare-at/);
    expect(pgConstraintMessage(wrapped('23514', 'product_variants_stock_check'))).toMatch(/Stock/);
  });

  it('maps foreign-key violations (23503)', () => {
    expect(pgConstraintMessage(wrapped('23503', 'x'))).toMatch(/referenced record/);
  });

  it('maps numeric overflow / bad-input (22003, 22P02) as a range error', () => {
    expect(pgConstraintMessage(wrapped('22003', 'x'))).toMatch(/out of the allowed range/);
    expect(pgConstraintMessage(wrapped('22P02', 'x'))).toMatch(/out of the allowed range/);
  });

  it('returns null for non-constraint errors (caller rethrows)', () => {
    expect(pgConstraintMessage(wrapped('08006', 'x'))).toBeNull();
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

  it('converts a mappable (drizzle-wrapped) pg error into a VALIDATION_ERROR result', async () => {
    const r = await withConstraintMapping(async () => {
      throw new Error('Failed query', { cause: { code: '23505', constraint_name: 'coupons_code_unique' } });
    });
    expect(r).toEqual({ ok: false, code: 'VALIDATION_ERROR', message: 'That code is already in use.' });
  });

  it('rethrows an unmappable error', async () => {
    await expect(
      withConstraintMapping(async () => {
        throw new Error('connection reset');
      }),
    ).rejects.toThrow('connection reset');
  });
});
