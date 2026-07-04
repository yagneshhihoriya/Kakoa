/**
 * GET /api/admin/audit — the admin audit log with optional filters
 * (entityType, action, actorId, page). Guarded by `audit:read` (Owner-sensitive).
 * Read-only. Malformed filter ids are ignored, never a 500.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { listAudit } from '@/lib/admin/audit';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('audit:read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const entityType = url.searchParams.get('entityType') ?? undefined;
  const action = url.searchParams.get('action') ?? undefined;
  const actorId = url.searchParams.get('actorId') ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const list = await listAudit({ entityType, action, actorId, page });
  return jsonOk(list, { cacheControl: NO_STORE });
}
