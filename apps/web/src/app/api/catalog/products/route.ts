/**
 * GET /api/catalog/products — public, Class A (module spec §5.2).
 * Query params validated with `productListInputSchema` (.strict() — unknown
 * keys ⇒ 400 VALIDATION_ERROR with fieldErrors). `meta.total` feeds
 * pagination; unknown category ⇒ empty list + total 0, never 404.
 */
import { productListInputSchema } from '@kakoa/core';

import { getProducts } from '@/lib/catalog';
import {
  CATALOG_CACHE_CONTROL,
  jsonErr,
  jsonOk,
  toFieldErrors,
} from '@/lib/api/http';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());

  const parsed = productListInputSchema.safeParse(query);
  if (!parsed.success) {
    return jsonErr('VALIDATION_ERROR', 'Invalid catalog query.', {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    });
  }

  try {
    const { products, total } = await getProducts(parsed.data);
    return jsonOk(
      { products },
      {
        cacheControl: CATALOG_CACHE_CONTROL,
        meta: {
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          total,
        },
      },
    );
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong. Please try again.');
  }
}
