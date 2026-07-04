/**
 * GET /api/catalog/products/[slug] — public, Class A (module spec §5.3).
 * Slug format failure ⇒ same 404 body as unknown slug (no validation
 * oracle on public paths, spec §1.2). 410/301 handling is the page
 * layer's job — the JSON API only distinguishes found / not found.
 */
import { getProductBySlug } from '@/lib/catalog';
import { CATALOG_CACHE_CONTROL, jsonErr, jsonOk } from '@/lib/api/http';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;

  try {
    // getProductBySlug rejects malformed slugs itself (returns null).
    const product = await getProductBySlug(slug);
    if (!product) {
      return jsonErr('NOT_FOUND', 'Product not found.');
    }
    return jsonOk({ product }, { cacheControl: CATALOG_CACHE_CONTROL });
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong. Please try again.');
  }
}
