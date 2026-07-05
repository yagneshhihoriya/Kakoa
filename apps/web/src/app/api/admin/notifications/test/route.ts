/**
 * POST /api/admin/notifications/test — send a sample of a template to an address.
 * Body `{ key, channel, to }`. Guard `notifications:manage`. Rate-limited + audited.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { sendTestNotification } from '@/lib/admin/notification-test';

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('notifications:manage');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const b = body as { key?: unknown; channel?: unknown; to?: unknown };
  if (typeof b.key !== 'string' || typeof b.channel !== 'string' || typeof b.to !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'A template key, channel and recipient are required.');
  }

  const result = await sendTestNotification({ key: b.key, channel: b.channel, to: b.to }, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ status: result.status }, { cacheControl: NO_STORE });
}
