/**
 * GET /api/catalog/categories — public, Class A (module spec §5.1).
 * → { categories: Category[] } — active only, ordered by position ASC.
 */
import { getCategories } from '@/lib/catalog';
import { CATALOG_CACHE_CONTROL, jsonErr, jsonOk } from '@/lib/api/http';

export async function GET(): Promise<Response> {
  try {
    const categories = await getCategories();
    return jsonOk({ categories }, { cacheControl: CATALOG_CACHE_CONTROL });
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong. Please try again.');
  }
}
