/**
 * GET /api/admin/taxes/hsn/[hsn] — the variants under an HSN (drill-down).
 * Guard `taxes:manage`. `[hsn]` is a TEXT column, so validate `^[0-9]{4,8}$`
 * before querying (never a raw uuid compare).
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { listVariantsForHsn } from '@/lib/admin/taxes';
import { validateHsnParam } from '@/lib/admin/tax-validation';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hsn: string }> },
): Promise<Response> {
  const auth = await requireAdmin('taxes:manage');
  if (!auth.ok) return auth.response;

  const { hsn } = await params;
  const valid = validateHsnParam(hsn);
  if (valid === null) {
    return jsonErr('VALIDATION_ERROR', 'HSN code must be 4, 6 or 8 digits.');
  }

  const variants = await listVariantsForHsn(valid);
  return jsonOk({ hsnCode: valid, variants }, { cacheControl: NO_STORE });
}
