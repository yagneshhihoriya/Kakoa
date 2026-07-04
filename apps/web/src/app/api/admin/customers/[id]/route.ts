/**
 * GET /api/admin/customers/[id] — customer detail + orders + addresses.
 *     Guarded by `customers:read`. Contact fields masked unless `customers:pii-view`.
 *     A malformed / unknown id resolves to NOT_FOUND (never a 500).
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import {
  getCustomerDetail,
  listCustomerAddresses,
  listCustomerOrders,
} from '@/lib/admin/customers';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('customers:read');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const canViewPii = auth.value.ctx.can('customers:pii-view');
  const customer = await getCustomerDetail(id, canViewPii);
  if (customer === null) return jsonErr('NOT_FOUND', "We couldn't find that customer.");

  const [orders, addresses] = await Promise.all([
    listCustomerOrders(id),
    listCustomerAddresses(id, canViewPii),
  ]);
  return jsonOk({ customer, orders, addresses }, { cacheControl: NO_STORE });
}
