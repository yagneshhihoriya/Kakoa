/**
 * POST /api/admin/orders/[orderNumber]/action — admin order actions
 * (admin-orders.md, Phase 1C). Body: `{ action, toStatus?, reason? }`.
 *
 * Permission per action (least privilege):
 *   confirm-cod → orders:cod-manage · advance → orders:transition · cancel → orders:refund
 */
import { ORDER_STATUSES, type OrderStatus } from '@kakoa/core';
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import {
  adminAdvanceStatus,
  adminCancelOrder,
  adminConfirmCod,
  type AdminActionResult,
} from '@/lib/admin/order-actions';
import { pushToShiprocketByOrderNumber } from '@/lib/admin/shipping';
import type { Permission } from '@platform/kernel';

const ACTIONS = ['confirm-cod', 'advance', 'cancel'] as const;
type Action = (typeof ACTIONS)[number];

const PERMISSION: Record<Action, Permission> = {
  'confirm-cod': 'orders:cod-manage',
  advance: 'orders:transition',
  cancel: 'orders:refund',
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const action = (body as { action?: unknown }).action;
  if (typeof action !== 'string' || !(ACTIONS as readonly string[]).includes(action)) {
    return jsonErr('VALIDATION_ERROR', 'Unknown action.');
  }

  const auth = await requireAdmin(PERMISSION[action as Action]);
  if (!auth.ok) return auth.response;

  const { orderNumber } = await params;
  const adminId = auth.value.admin.id;

  let result: AdminActionResult;
  if (action === 'confirm-cod') {
    result = await adminConfirmCod(orderNumber, adminId);
  } else if (action === 'advance') {
    const toStatus = (body as { toStatus?: unknown }).toStatus;
    if (typeof toStatus !== 'string' || !(ORDER_STATUSES as readonly string[]).includes(toStatus)) {
      return jsonErr('VALIDATION_ERROR', 'Invalid target status.');
    }
    result = await adminAdvanceStatus(orderNumber, toStatus as OrderStatus, adminId);
    // Gap B — marking `packed` auto-creates the shipment + assigns an AWB
    // (best-effort, idempotent). The manual "Create shipment" button remains.
    if (result.ok && toStatus === 'packed') {
      void pushToShiprocketByOrderNumber(orderNumber, adminId).catch(() => {});
    }
  } else {
    const reasonRaw = (body as { reason?: unknown }).reason;
    const reason =
      typeof reasonRaw === 'string' && reasonRaw.trim() !== ''
        ? reasonRaw.trim().slice(0, 500)
        : 'Cancelled by admin';
    result = await adminCancelOrder(orderNumber, reason, adminId);
  }

  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ status: result.status }, { cacheControl: NO_STORE });
}
