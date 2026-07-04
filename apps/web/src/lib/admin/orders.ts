/**
 * Admin orders read layer (admin-orders.md, Phase 1 — read surface). List with
 * filters + pagination, and a composed detail. Business-agnostic. Actions
 * (transitions / refunds / COD) land in the next increment.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  db,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  type AddressSnapshot,
} from '@kakoa/db';
import { maskPhone, type OrderStatus, type PaymentMode } from '@kakoa/core';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';

export const ORDER_PAGE_SIZE = 20;

export interface AdminOrderRow {
  orderNumber: string;
  status: OrderStatus;
  paymentMode: PaymentMode;
  totalPaise: number;
  placedAt: string;
  customerName: string;
  contactPhoneMasked: string;
}

export interface AdminOrderList {
  rows: AdminOrderRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface AdminOrderListInput {
  status?: OrderStatus;
  paymentMode?: PaymentMode;
  search?: string;
  page?: number;
}

/** Escape LIKE wildcards so search is a literal substring (default `\` escape). */
function likeParam(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Clamp a page number to a sane, finite range (guards `?page=1e308` → bad OFFSET). */
function clampPage(raw: number | undefined): number {
  const n = Math.floor(Number(raw ?? 1));
  return Number.isFinite(n) ? Math.min(1_000_000, Math.max(1, n)) : 1;
}

export async function listOrders(
  input: AdminOrderListInput,
): Promise<AdminOrderList> {
  const page = clampPage(input.page);
  const pageSize = ORDER_PAGE_SIZE;

  const conds: SQL[] = [];
  if (input.status !== undefined) conds.push(eq(orders.status, input.status));
  if (input.paymentMode !== undefined)
    conds.push(eq(orders.paymentMode, input.paymentMode));
  const search = input.search?.trim();
  if (search !== undefined && search !== '') {
    const p = likeParam(search);
    conds.push(
      sql`(${orders.orderNumber} ilike ${p} or ${orders.contactPhone} ilike ${p} or ${orders.contactEmail} ilike ${p} or ${orders.shippingAddress}->>'fullName' ilike ${p})`,
    );
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(orders)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMode: orders.paymentMode,
      totalPaise: orders.totalPaise,
      placedAt: orders.placedAt,
      contactPhone: orders.contactPhone,
      shippingAddress: orders.shippingAddress,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.placedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => ({
      orderNumber: r.orderNumber,
      status: r.status,
      paymentMode: r.paymentMode,
      totalPaise: r.totalPaise,
      placedAt: new Date(r.placedAt).toISOString(),
      customerName: (r.shippingAddress as AddressSnapshot | null)?.fullName ?? '—',
      contactPhoneMasked: maskPhone(r.contactPhone),
    })),
    total: Number(total),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(Number(total) / pageSize)),
  };
}

export interface AdminOrderDetail {
  orderNumber: string;
  status: OrderStatus;
  paymentMode: PaymentMode;
  placedAt: string;
  customerName: string;
  contactPhoneMasked: string;
  contactEmail: string | null;
  shippingAddress: AddressSnapshot;
  subtotalPaise: number;
  discountPaise: number;
  shippingFeePaise: number;
  codFeePaise: number;
  giftWrapTotalPaise: number;
  totalPaise: number;
  couponCode: string | null;
  items: {
    productName: string;
    variantName: string;
    quantity: number;
    lineTotalPaise: number;
  }[];
  payment: {
    status: string;
    method: string;
    amountPaise: number;
    amountRefundedPaise: number;
  } | null;
  history: { fromStatus: string | null; toStatus: string; actorType: string; at: string }[];
}

export async function getOrderDetail(
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) return null;

  const items = await db
    .select({
      productName: orderItems.productName,
      variantName: orderItems.variantName,
      quantity: orderItems.quantity,
      lineTotalPaise: orderItems.lineTotalPaise,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(orderItems.createdAt);

  const [payment] = await db
    .select({
      status: payments.status,
      method: payments.method,
      amountPaise: payments.amountPaise,
      amountRefundedPaise: payments.amountRefundedPaise,
    })
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  const history = await db
    .select({
      fromStatus: orderStatusHistory.fromStatus,
      toStatus: orderStatusHistory.toStatus,
      actorType: orderStatusHistory.actorType,
      createdAt: orderStatusHistory.createdAt,
    })
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, order.id))
    .orderBy(orderStatusHistory.createdAt);

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMode: order.paymentMode,
    placedAt: new Date(order.placedAt).toISOString(),
    customerName: order.shippingAddress.fullName,
    contactPhoneMasked: maskPhone(order.contactPhone),
    contactEmail: order.contactEmail,
    // Mask the address-snapshot phone too — the raw E.164 must never reach the
    // client (it rides along in the JSON/RSC payload even if the UI hides it).
    shippingAddress: {
      ...order.shippingAddress,
      phone: maskPhone(order.shippingAddress.phone),
    },
    subtotalPaise: order.subtotalPaise,
    discountPaise: order.discountPaise,
    shippingFeePaise: order.shippingFeePaise,
    codFeePaise: order.codFeePaise,
    giftWrapTotalPaise: order.giftWrapTotalPaise,
    totalPaise: order.totalPaise,
    couponCode: order.couponCode,
    items,
    payment: payment ?? null,
    history: history.map((h) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actorType: h.actorType,
      at: new Date(h.createdAt).toISOString(),
    })),
  };
}
