/**
 * Admin store settings.
 *  - GET   /api/admin/settings — every catalogued setting (defaults overlaid).
 *           Guard `settings:read`.
 *  - PATCH /api/admin/settings — partial `{ key: value }` map. `int-paise` fields
 *           are sent in RUPEES (the validator converts ₹→paise). Validated via
 *           `validateSettingsPatch`, then upserted per key. Guard `settings:write`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getAllSettings, updateSettings } from '@/lib/admin/settings';
import { validateSettingsPatch } from '@/lib/admin/settings-schema';

export async function GET(): Promise<Response> {
  const auth = await requireAdmin('settings:read');
  if (!auth.ok) return auth.response;

  const settings = await getAllSettings();
  return jsonOk(settings, { cacheControl: NO_STORE });
}

export async function PATCH(req: Request): Promise<Response> {
  const auth = await requireAdmin('settings:write');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }

  const validated = validateSettingsPatch(body);
  if (!validated.ok) {
    return jsonErr('VALIDATION_ERROR', validated.message);
  }

  const result = await updateSettings(validated.value, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ changed: result.changed }, { cacheControl: NO_STORE });
}
