/**
 * GET  /api/admin/staff — admin user list with search + filter (staff:manage).
 * POST /api/admin/staff — invite an admin (create the row; they sign in via OTP).
 * Both guarded by `staff:manage`. Invite passes the actor (id + grants) so the
 * data layer enforces the §4 privilege-escalation checks server-side.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { inviteAdmin, listAdminUsers } from '@/lib/admin/staff';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('staff:manage');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const filterRaw = url.searchParams.get('filter');
  const filter = filterRaw === 'active' || filterRaw === 'inactive' ? filterRaw : 'all';
  const search = (url.searchParams.get('search') ?? '').slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const list = await listAdminUsers({ search, filter, page });
  return jsonOk(list, { cacheControl: NO_STORE });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('staff:manage');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  if (typeof body !== 'object' || body === null) {
    return jsonErr('VALIDATION_ERROR', 'An email, name and role are required.');
  }
  const b = body as { email?: unknown; name?: unknown; roleId?: unknown };
  if (typeof b.email !== 'string' || typeof b.name !== 'string' || typeof b.roleId !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'An email, name and role are required.');
  }

  const result = await inviteAdmin(
    { email: b.email, name: b.name, roleId: b.roleId },
    { id: auth.value.admin.id, grants: auth.value.admin.grants },
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ id: result.id }, { cacheControl: NO_STORE, status: 201 });
}
