/**
 * GET  /api/admin/roles — role list with user counts (roles:manage).
 * POST /api/admin/roles — create a custom role (roles:manage). §4.1 subset +
 * §4.7 permission sanitisation are enforced in createRole / validateRoleInput.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { createRole, listRoles } from '@/lib/admin/roles';
import { isValidRoleKey, validateRoleInput } from '@/lib/admin/rbac-guards';

export async function GET(): Promise<Response> {
  const auth = await requireAdmin('roles:manage');
  if (!auth.ok) return auth.response;
  const rows = await listRoles();
  return jsonOk({ rows }, { cacheControl: NO_STORE });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('roles:manage');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  if (typeof body !== 'object' || body === null) {
    return jsonErr('VALIDATION_ERROR', 'A key, name and permissions are required.');
  }
  const key = (body as { key?: unknown }).key;
  if (!isValidRoleKey(key)) {
    return jsonErr('VALIDATION_ERROR', 'Role key must be lowercase letters, digits or underscore (2–31 chars, starting with a letter).');
  }
  const parsed = validateRoleInput(body, auth.value.admin.grants);
  if (!parsed.ok) return jsonErr('VALIDATION_ERROR', parsed.message);

  const result = await createRole(
    { key, ...parsed.value },
    { id: auth.value.admin.id, grants: auth.value.admin.grants },
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ id: result.id }, { cacheControl: NO_STORE, status: 201 });
}
