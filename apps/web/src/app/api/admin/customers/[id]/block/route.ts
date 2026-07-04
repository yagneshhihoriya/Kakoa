/**
 * POST /api/admin/customers/[id]/block — block or unblock a customer (abuse
 * control). Body: { blocked: boolean }. Guarded by `customers:block` (NOT
 * `customers:read` — a read-only admin cannot block). Audited in-tx; idempotent.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { setCustomerBlocked } from '@/lib/admin/customers';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('customers:block');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  if (typeof body !== 'object' || body === null) {
    return jsonErr('VALIDATION_ERROR', 'A `blocked` boolean is required.');
  }
  const b = body as { blocked?: unknown };
  if (typeof b.blocked !== 'boolean') {
    return jsonErr('VALIDATION_ERROR', 'A `blocked` boolean is required.');
  }

  const result = await setCustomerBlocked(id, b.blocked, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk(
    { ok: true, changed: result.changed, isBlocked: result.isBlocked },
    { cacheControl: NO_STORE },
  );
}
