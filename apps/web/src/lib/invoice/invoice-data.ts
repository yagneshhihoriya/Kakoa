/**
 * Invoice data assembler — the single source of truth for what an invoice shows.
 *
 * It READS the immutable snapshots the order already froze at placement
 * (`order_items` line tax/price, `orders` money header + address snapshots) and
 * NEVER recomputes money — the invoice must equal the order to the paise. It
 * enriches with the seller's GST identity (store_settings), the payment
 * status/method, any refunds (credit-note block), and the shipment AWB.
 *
 * A tax invoice is issued only once the order is REAL (confirmed / paid):
 * `confirmedAt !== null`. Pending-payment / unconfirmed-COD orders get
 * `{ eligible: false }` so the UI shows "invoice available after confirmation".
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  db,
  orderItems,
  orders,
  payments,
  refunds,
  shipments,
  storeSettings,
  type AddressSnapshot,
} from '@kakoa/db';
import { stateByCode } from '@kakoa/core';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { methodLabel, paymentStatusLabel } from '@/lib/admin/payment-format';
import { SETTINGS_DEFAULTS } from '@/lib/admin/settings-schema';
import { deriveInvoiceNumber } from './invoice-number';

export interface InvoiceLine {
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  unitPricePaise: number;
  taxableValuePaise: number;
  gstRateBp: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  giftWrapFeePaise: number;
  lineTotalPaise: number;
}

export interface InvoiceRefundRow {
  amountPaise: number;
  status: string;
  createdAtIso: string;
}

export interface InvoiceModel {
  invoiceNumber: string;
  orderNumber: string;
  orderDateIso: string;
  invoiceDateIso: string;
  paymentMethodLabel: string;
  paymentStatusLabel: string;
  orderStatusLabel: string;
  isCod: boolean;
  intraState: boolean;
  seller: {
    legalName: string;
    gstin: string;
    stateName: string | null;
    stateCode: string;
    address: string;
    fssai: string;
    supportEmail: string;
    supportPhone: string;
  };
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  billingAddress: AddressSnapshot;
  shippingAddress: AddressSnapshot;
  lines: InvoiceLine[];
  summary: {
    subtotalPaise: number;
    discountPaise: number;
    couponCode: string | null;
    shippingFeePaise: number;
    codFeePaise: number;
    giftWrapTotalPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    taxTotalPaise: number;
    grandTotalPaise: number;
  };
  refund: {
    totalRefundedPaise: number;
    fullyRefunded: boolean;
    rows: InvoiceRefundRow[];
  } | null;
  shipment: { awb: string; courierName: string | null } | null;
  customerNote: string | null;
}

export type InvoiceResult =
  | { eligible: true; invoice: InvoiceModel }
  | { eligible: false; reason: string };

/** Read the seller identity block from store_settings (defaults overlaid). */
async function loadSeller(): Promise<InvoiceModel['seller']> {
  const keys = [
    'seller_legal_name',
    'seller_gstin',
    'seller_state_code',
    'seller_address',
    'fssai_license_number',
    'support_email',
    'support_phone',
  ];
  const rows = await db
    .select({ key: storeSettings.key, value: storeSettings.value })
    .from(storeSettings)
    .where(inArray(storeSettings.key, keys));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const str = (key: string): string => {
    const v = byKey.has(key) ? byKey.get(key) : SETTINGS_DEFAULTS[key];
    return typeof v === 'string' ? v : String(v ?? '');
  };
  const stateCode = str('seller_state_code');
  return {
    legalName: str('seller_legal_name'),
    gstin: str('seller_gstin'),
    stateCode,
    stateName: stateByCode(stateCode)?.name ?? null,
    address: str('seller_address'),
    fssai: str('fssai_license_number'),
    supportEmail: str('support_email'),
    supportPhone: str('support_phone'),
  };
}

/**
 * Assemble the invoice for an already-authorized order id (the caller resolves
 * ownership). Returns `null` when the order doesn't exist, `{ eligible: false }`
 * before confirmation, else the full model.
 */
export async function getInvoiceData(orderId: string): Promise<InvoiceResult | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return null;

  if (order.confirmedAt === null) {
    return {
      eligible: false,
      reason: 'A tax invoice is available once your order is confirmed.',
    };
  }

  const items = await db
    .select({
      productName: orderItems.productName,
      variantName: orderItems.variantName,
      sku: orderItems.sku,
      imageUrl: orderItems.imageUrl,
      quantity: orderItems.quantity,
      unitPricePaise: orderItems.unitPricePaise,
      taxableValuePaise: orderItems.taxableValuePaise,
      gstRateBp: orderItems.gstRateBp,
      cgstPaise: orderItems.cgstPaise,
      sgstPaise: orderItems.sgstPaise,
      igstPaise: orderItems.igstPaise,
      giftWrapFeePaise: orderItems.giftWrapFeePaise,
      lineTotalPaise: orderItems.lineTotalPaise,
      createdAt: orderItems.createdAt,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.createdAt);

  const [payment] = await db
    .select({
      method: payments.method,
      status: payments.status,
      amountRefundedPaise: payments.amountRefundedPaise,
      amountPaise: payments.amountPaise,
    })
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  const refundRows = await db
    .select({ amountPaise: refunds.amountPaise, status: refunds.status, createdAt: refunds.createdAt })
    .from(refunds)
    .where(eq(refunds.orderId, orderId))
    .orderBy(desc(refunds.createdAt));

  const [shipment] = await db
    .select({ awbCode: shipments.awbCode, courierName: shipments.courierName })
    .from(shipments)
    .where(and(eq(shipments.orderId, orderId), sql`${shipments.supersededAt} IS NULL`))
    .limit(1);

  const seller = await loadSeller();

  const isCod = order.paymentMode === 'cod';
  const totalRefundedPaise = Number(payment?.amountRefundedPaise ?? 0);
  const taxTotalPaise = order.cgstPaise + order.sgstPaise + order.igstPaise;

  const invoice: InvoiceModel = {
    invoiceNumber: order.invoiceNumber ?? deriveInvoiceNumber(order.orderNumber, new Date(order.placedAt)),
    orderNumber: order.orderNumber,
    orderDateIso: new Date(order.placedAt).toISOString(),
    invoiceDateIso: new Date(order.confirmedAt).toISOString(),
    paymentMethodLabel: isCod ? 'Cash on Delivery' : methodLabel(payment?.method ?? 'unknown'),
    paymentStatusLabel: payment ? paymentStatusLabel(payment.status) : '—',
    orderStatusLabel: order.status.replace(/_/g, ' '),
    isCod,
    intraState: order.shipToStateCode === seller.stateCode,
    seller,
    customer: {
      name: order.shippingAddress.fullName,
      phone: order.contactPhone,
      email: order.contactEmail,
    },
    billingAddress: (order.billingAddress as AddressSnapshot | null) ?? order.shippingAddress,
    shippingAddress: order.shippingAddress,
    lines: items.map((i) => ({
      productName: i.productName,
      variantName: i.variantName,
      sku: i.sku,
      imageUrl: i.imageUrl,
      quantity: i.quantity,
      unitPricePaise: i.unitPricePaise,
      taxableValuePaise: i.taxableValuePaise,
      gstRateBp: i.gstRateBp,
      cgstPaise: i.cgstPaise,
      sgstPaise: i.sgstPaise,
      igstPaise: i.igstPaise,
      giftWrapFeePaise: i.giftWrapFeePaise,
      lineTotalPaise: i.lineTotalPaise,
    })),
    summary: {
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      couponCode: order.couponCode,
      shippingFeePaise: order.shippingFeePaise,
      codFeePaise: order.codFeePaise,
      giftWrapTotalPaise: order.giftWrapTotalPaise,
      cgstPaise: order.cgstPaise,
      sgstPaise: order.sgstPaise,
      igstPaise: order.igstPaise,
      taxTotalPaise,
      grandTotalPaise: order.totalPaise,
    },
    refund:
      totalRefundedPaise > 0 || refundRows.length > 0
        ? {
            totalRefundedPaise,
            fullyRefunded: totalRefundedPaise >= order.totalPaise && order.totalPaise > 0,
            rows: refundRows.map((r) => ({
              amountPaise: r.amountPaise,
              status: r.status,
              createdAtIso: new Date(r.createdAt).toISOString(),
            })),
          }
        : null,
    shipment: shipment?.awbCode ? { awb: shipment.awbCode, courierName: shipment.courierName } : null,
    customerNote: order.customerNote,
  };

  return { eligible: true, invoice };
}
