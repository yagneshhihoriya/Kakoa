/**
 * GET /api/admin/orders — order list with filters (admin-orders.md). Guarded by
 * `orders:read`. Query: `status`, `paymentMode`, `search`, `page`.
 */
import {
  ORDER_STATUSES,
  PAYMENT_MODES,
  type OrderStatus,
  type PaymentMode,
} from '@kakoa/core';
import { jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { listOrders } from '@/lib/admin/orders';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin('orders:read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const statusRaw = url.searchParams.get('status');
  const status =
    statusRaw !== null && (ORDER_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as OrderStatus)
      : undefined;
  const modeRaw = url.searchParams.get('paymentMode');
  const paymentMode =
    modeRaw !== null && (PAYMENT_MODES as readonly string[]).includes(modeRaw)
      ? (modeRaw as PaymentMode)
      : undefined;
  const search = (url.searchParams.get('search') ?? '').slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const list = await listOrders({ status, paymentMode, search, page });
  return jsonOk(list, { cacheControl: NO_STORE });
}
