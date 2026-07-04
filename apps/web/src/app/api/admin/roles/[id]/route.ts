/**
 * GET    /api/admin/roles/[id] — role detail for the editor (roles:manage).
 * PATCH  /api/admin/roles/[id] — update name/description/permissions (roles:manage).
 * DELETE /api/admin/roles/[id] — delete a custom, unused role (roles:manage).
 * The §4 invariants (owner-protected, last-owner, self-lockout, in-use, subset)
 * live in the data layer. Malformed id → NOT_FOUND.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { deleteRole, getRole, updateRole } from '@/lib/admin/roles';
import { validateRoleInput } from '@/lib/admin/rbac-guards';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('roles:manage');
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const role = await getRole(id);
  if (role === null) return jsonErr('NOT_FOUND', "We couldn't find that role.");
  return jsonOk(role, { cacheControl: NO_STORE });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('roles:manage');
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
  const permissionsProvided = Array.isArray((body as { permissions?: unknown }).permissions);
  const parsed = validateRoleInput(body, auth.value.admin.grants);
  if (!parsed.ok) return jsonErr('VALIDATION_ERROR', parsed.message);

  const result = await updateRole(
    id,
    { ...parsed.value, permissionsProvided },
    { id: auth.value.admin.id, grants: auth.value.admin.grants },
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ id: result.id }, { cacheControl: NO_STORE });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('roles:manage');
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await deleteRole(id, { id: auth.value.admin.id, grants: auth.value.admin.grants });
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ ok: true }, { cacheControl: NO_STORE });
}
