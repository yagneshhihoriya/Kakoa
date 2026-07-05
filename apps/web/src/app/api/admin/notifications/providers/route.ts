/**
 * GET /api/admin/notifications/providers — active provider status (email + SMS),
 * derived from env PRESENCE only (no secrets). Guard `notifications:read`.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getProviderStatus } from '@/lib/admin/notification-providers';

export async function GET(): Promise<Response> {
  const auth = await requireAdmin('notifications:read');
  if (!auth.ok) return auth.response;
  return jsonOk(getProviderStatus(), { cacheControl: NO_STORE });
}
