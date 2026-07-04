/**
 * GET  /api/admin/products — product list with filters (admin-catalog-inventory.md).
 *      Guarded by `products:read`. Query: `search`, `categoryId`, `status`, `page`.
 * POST /api/admin/products — create a draft product (`products:write`).
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { createProduct, listProducts } from '@/lib/admin/products';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('products:read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const statusRaw = url.searchParams.get('status');
  const status =
    statusRaw === 'active' || statusRaw === 'inactive' ? statusRaw : undefined;
  const categoryId = url.searchParams.get('categoryId') ?? undefined;
  const search = (url.searchParams.get('search') ?? '').slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const list = await listProducts({ search, categoryId, status, page });
  return jsonOk(list, { cacheControl: NO_STORE });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('products:write');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const b = body as { name?: unknown; categoryId?: unknown; description?: unknown };
  if (typeof b.name !== 'string' || typeof b.categoryId !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'A name and category are required.');
  }

  const result = await createProduct(
    {
      name: b.name,
      categoryId: b.categoryId,
      description: typeof b.description === 'string' ? b.description : undefined,
    },
    auth.value.admin.id,
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ id: result.id }, { cacheControl: NO_STORE, status: 201 });
}
