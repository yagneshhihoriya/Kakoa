/**
 * GET /api/admin/notifications/log — send history (masked recipients).
 * Guard `notifications:read`.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { listNotificationLog } from '@/lib/admin/notification-log';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('notifications:read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const list = await listNotificationLog({
    channel: url.searchParams.get('channel') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    page: Number(url.searchParams.get('page') ?? '1') || 1,
  });
  return jsonOk(list, { cacheControl: NO_STORE });
}
