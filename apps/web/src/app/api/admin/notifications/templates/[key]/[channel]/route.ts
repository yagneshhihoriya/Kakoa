/**
 * GET   /api/admin/notifications/templates/[key]/[channel] — one merged template.
 *        Guard `notifications:read`.
 * PATCH /api/admin/notifications/templates/[key]/[channel] — upsert an override.
 *        Body `{ subject?, body, isActive }`. Guard `notifications:manage`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getTemplate, upsertTemplate } from '@/lib/admin/notification-templates';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string; channel: string }> },
): Promise<Response> {
  const auth = await requireAdmin('notifications:read');
  if (!auth.ok) return auth.response;
  const { key, channel } = await params;
  const template = await getTemplate(key, channel);
  if (template === null) return jsonErr('NOT_FOUND', 'Unknown template.');
  return jsonOk(template, { cacheControl: NO_STORE });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ key: string; channel: string }> },
): Promise<Response> {
  const auth = await requireAdmin('notifications:manage');
  if (!auth.ok) return auth.response;

  const { key, channel } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const b = body as { subject?: unknown; body?: unknown; isActive?: unknown };
  if (typeof b.body !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'A template body is required.');
  }

  const result = await upsertTemplate(
    {
      key,
      channel,
      subject: typeof b.subject === 'string' ? b.subject : null,
      body: b.body,
      isActive: b.isActive !== false,
    },
    auth.value.admin.id,
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ ok: true }, { cacheControl: NO_STORE });
}
