/**
 * GET /api/admin/notifications/templates — catalog merged with DB overrides.
 * Guard `notifications:read`.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { listTemplates } from '@/lib/admin/notification-templates';

export async function GET(): Promise<Response> {
  const auth = await requireAdmin('notifications:read');
  if (!auth.ok) return auth.response;
  const rows = await listTemplates();
  return jsonOk({ rows }, { cacheControl: NO_STORE });
}
