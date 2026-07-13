/**
 * GET  /api/admin/products/[id] — product detail for editing (`products:read`).
 * PATCH /api/admin/products/[id] — update core fields + validated attributes
 * (`products:write`). Attributes are sanitized against the active vertical
 * preset's schema + enabled capabilities before persisting.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import {
  deleteProduct,
  getProductForEdit,
  updateProduct,
  validateAttributes,
} from '@/lib/admin/products';
import { coerceProductContent } from '@/lib/admin/product-validation';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('products:read');
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const product = await getProductForEdit(id);
  if (product === null) return jsonErr('NOT_FOUND', "We couldn't find that product.");
  return jsonOk(product, { cacheControl: NO_STORE });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('products:write');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const b = body as {
    name?: unknown;
    description?: unknown;
    categoryId?: unknown;
    attributes?: unknown;
    expectedUpdatedAt?: unknown;
  };
  if (
    typeof b.name !== 'string' ||
    typeof b.categoryId !== 'string' ||
    typeof b.expectedUpdatedAt !== 'string'
  ) {
    return jsonErr('VALIDATION_ERROR', 'Missing required fields.');
  }

  const { id } = await params;
  // Sanitize attributes against the ACTIVE vertical preset's schema + capabilities.
  const attributes = validateAttributes(
    auth.value.ctx.preset.attributeSchema,
    auth.value.ctx.capabilities,
    b.attributes,
  );

  const result = await updateProduct(
    id,
    {
      name: b.name,
      description: typeof b.description === 'string' ? b.description : '',
      categoryId: b.categoryId,
      attributes,
      content: coerceProductContent(body),
      expectedUpdatedAt: b.expectedUpdatedAt,
    },
    auth.value.admin.id,
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ ok: true }, { cacheControl: NO_STORE });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('products:write');
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const result = await deleteProduct(id, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ deleted: true }, { cacheControl: NO_STORE });
}
