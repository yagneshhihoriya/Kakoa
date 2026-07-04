/**
 * GET /api/catalog/search — public, Class A + 30/min bucket (spec §5.5).
 * Empty/missing/1-char `q` is NOT an error — returns { results: [] } with
 * no DB query (Contract §2.2). Only q > 80 chars and a bad limit are 400s.
 */
import { searchProducts } from '@/lib/catalog';
import { CATALOG_CACHE_CONTROL, jsonErr, jsonOk } from '@/lib/api/http';

const MAX_Q_LENGTH = 80;
const MAX_LIMIT = 8;
const DEFAULT_LIMIT = 8;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';

  if (q.length > MAX_Q_LENGTH) {
    return jsonErr('VALIDATION_ERROR', 'Search text is too long (max 80 characters).', {
      fieldErrors: { q: ['Search text is too long (max 80 characters).'] },
    });
  }

  let limit = DEFAULT_LIMIT;
  const rawLimit = url.searchParams.get('limit');
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return jsonErr('VALIDATION_ERROR', `Limit must be between 1 and ${MAX_LIMIT}.`, {
        fieldErrors: { limit: [`Limit must be between 1 and ${MAX_LIMIT}.`] },
      });
    }
  }

  try {
    const results = await searchProducts(q, limit);
    return jsonOk({ results }, { cacheControl: CATALOG_CACHE_CONTROL });
  } catch {
    return jsonErr('INTERNAL', 'Search is unavailable, try again.');
  }
}
