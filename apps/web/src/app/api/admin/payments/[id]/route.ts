/**
 * GET /api/admin/payments/[id] — payment detail + its refund history. Guard
 * `payments:read`. A malformed / unknown id → NOT_FOUND (never a 500).
 * `rawPayload` is never included by the data layer.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { getPaymentDetail } from '@/lib/admin/payments';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('payments:read');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const detail = await getPaymentDetail(id);
  if (detail === null) {
    return jsonErr('NOT_FOUND', "We couldn't find that payment.");
  }
  return jsonOk(detail, { cacheControl: NO_STORE });
}
