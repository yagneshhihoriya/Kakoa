/**
 * POST /api/admin/taxes/bulk — set `gst_rate_bp` for ALL variants of an HSN.
 * Body `{ hsnCode, gstRateBp }`. Guard `taxes:manage`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { bulkSetHsnRate } from '@/lib/admin/taxes';

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin('taxes:manage');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const b = body as { hsnCode?: unknown; gstRateBp?: unknown };
  if (typeof b.hsnCode !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'An HSN code is required.');
  }

  const result = await bulkSetHsnRate(b.hsnCode, b.gstRateBp, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk(
    { affected: result.affected, gstRateBp: result.gstRateBp, hsnCode: result.hsnCode },
    { cacheControl: NO_STORE },
  );
}
