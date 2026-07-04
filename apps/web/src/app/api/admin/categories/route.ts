/**
 * GET  /api/admin/categories — list categories with product counts (`categories:manage`).
 * POST /api/admin/categories — create a category (`categories:manage`).
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { createCategory, listCategories } from '@/lib/admin/categories';

export async function GET(): Promise<Response> {
  const auth = await requireAdmin('categories:manage');
  if (!auth.ok) return auth.response;
  const categories = await listCategories();
  return jsonOk({ categories }, { cacheControl: NO_STORE });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('categories:manage');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const b = body as { name?: unknown; description?: unknown };
  if (typeof b.name !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'A category name is required.');
  }

  const result = await createCategory(
    { name: b.name, description: typeof b.description === 'string' ? b.description : undefined },
    auth.value.admin.id,
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ id: result.id }, { cacheControl: NO_STORE });
}
