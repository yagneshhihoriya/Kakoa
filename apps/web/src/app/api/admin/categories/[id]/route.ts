/**
 * PATCH /api/admin/categories/[id] — rename / re-order / archive a category
 * (`categories:manage`). The id is uuid-guarded before it reaches the column.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { updateCategory } from '@/lib/admin/categories';
import { isUuid } from '@/lib/admin/products';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('categories:manage');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isUuid(id)) return jsonErr('NOT_FOUND', "We couldn't find that category.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const b = body as {
    name?: unknown;
    description?: unknown;
    position?: unknown;
    active?: unknown;
  };
  if (typeof b.name !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'A category name is required.');
  }

  const result = await updateCategory(
    id,
    {
      name: b.name,
      description: typeof b.description === 'string' ? b.description : undefined,
      position: typeof b.position === 'number' ? b.position : undefined,
      active: typeof b.active === 'boolean' ? b.active : undefined,
    },
    auth.value.admin.id,
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ ok: true }, { cacheControl: NO_STORE });
}
