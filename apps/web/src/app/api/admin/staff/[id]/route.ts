/**
 * PATCH /api/admin/staff/[id] — update an admin's name / role / active flag.
 * Guarded by `staff:manage`. The §4 security invariants (no escalation, last-owner
 * protection, self-lockout, session revoke on deactivate/role-change) are enforced
 * in updateAdmin, in-transaction. A malformed id resolves to NOT_FOUND.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { updateAdmin } from '@/lib/admin/staff';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('staff:manage');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  if (typeof body !== 'object' || body === null) {
    return jsonErr('VALIDATION_ERROR', 'Nothing to update.');
  }
  const b = body as { name?: unknown; roleId?: unknown; isActive?: unknown };

  const result = await updateAdmin(
    id,
    {
      name: typeof b.name === 'string' ? b.name : undefined,
      roleId: typeof b.roleId === 'string' ? b.roleId : undefined,
      isActive: typeof b.isActive === 'boolean' ? b.isActive : undefined,
    },
    { id: auth.value.admin.id, grants: auth.value.admin.grants },
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ id: result.id }, { cacheControl: NO_STORE });
}
