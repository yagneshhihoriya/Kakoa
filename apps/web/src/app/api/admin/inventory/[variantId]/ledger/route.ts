/**
 * GET /api/admin/inventory/[variantId]/ledger — recent stock movements for a
 * variant, newest first (`inventory:read`). The audit trail behind the number.
 */
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getVariantLedger } from '@/lib/admin/inventory';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ variantId: string }> },
): Promise<Response> {
  const auth = await requireAdmin('inventory:read');
  if (!auth.ok) return auth.response;

  const { variantId } = await params;
  const ledger = await getVariantLedger(variantId);
  return jsonOk({ ledger }, { cacheControl: NO_STORE });
}
