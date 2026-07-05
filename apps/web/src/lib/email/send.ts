/**
 * Transactional email dispatch — best-effort, NEVER throwing (launch-gate).
 *
 * `sendOrderConfirmation` / `sendOrderCancellation` load the order + its items,
 * compose a template, and hand it to the active `EmailProvider`. They are wired
 * into placement / confirmation / cancellation AFTER the money commit and are
 * fully best-effort: every path is wrapped so a template bug, a missing order,
 * or a provider outage degrades to "no email sent" — it can never surface as an
 * error into the checkout / cancel flow.
 *
 * Dedup: the provider gets an `idempotencyKey` (`order-confirm-<id>` /
 * `order-cancel-<id>`) so the two prepaid confirmation triggers (verify fast
 * path + webhook) never mail the customer twice.
 *
 * SERVER-ONLY: uses @kakoa/db + @kakoa/integrations.
 */
import { db, orders, orderItems, shipments, storeSettings } from '@kakoa/db';
import { formatPaise } from '@kakoa/core';
import { getEmailProvider, getSmsProvider } from '@kakoa/integrations';
import { and, eq, sql } from 'drizzle-orm';

import { siteUrl } from '@/lib/seo/site';
import { recordNotification } from '@/lib/admin/notification-log';
import { resolveOverrideEmail, resolveOverrideSms } from '@/lib/admin/notification-templates';
import {
  adminNewOrderAlertEmail,
  orderCancelledEmail,
  orderConfirmationEmail,
  orderFulfilmentEmail,
  type FulfilmentStage,
  type OrderEmailModel,
} from './templates';

/**
 * Deliver a rendered email + record a masked `notification_log` row. Best-effort:
 * a provider throw is recorded as `failed` and swallowed (email is never a
 * blocking path). `notification_log`-insert failures are swallowed by
 * `recordNotification`.
 */
async function deliverEmail(
  templateKey: string,
  orderId: string | null,
  to: string,
  rendered: { subject: string; html: string; text: string },
  idempotencyKey: string,
): Promise<void> {
  let status: 'sent' | 'failed' = 'sent';
  let providerMessageId: string | null = null;
  let error: string | null = null;
  try {
    const r = await getEmailProvider().send({ to, ...rendered, idempotencyKey });
    providerMessageId = r.providerMessageId;
  } catch (cause) {
    status = 'failed';
    error = cause instanceof Error ? cause.message : 'send failed';
  }
  await recordNotification({ channel: 'email', templateKey, recipient: to, orderId, status, providerMessageId, error });
}

/** Deliver a transactional SMS + record a masked log row. Best-effort. */
async function deliverSms(
  templateKey: string,
  orderId: string | null,
  phoneE164: string,
  message: string,
): Promise<void> {
  let status: 'sent' | 'failed' = 'sent';
  let providerMessageId: string | null = null;
  let error: string | null = null;
  try {
    const r = await getSmsProvider().sendText({ phoneE164, message, template: templateKey });
    providerMessageId = r.providerMessageId;
  } catch (cause) {
    status = 'failed';
    error = cause instanceof Error ? cause.message : 'send failed';
  }
  await recordNotification({ channel: 'sms', templateKey, recipient: phoneE164, orderId, status, providerMessageId, error });
}

/**
 * Load an order + its items and shape the render model. Returns `null` when the
 * order is missing OR has no `contact_email` (guests who only left a phone are
 * skipped — SMS is their channel). All the string fields flow through the
 * templates' `esc()` sink before hitting HTML.
 */
async function loadOrderEmailModel(
  orderId: string,
): Promise<{ to: string; model: OrderEmailModel } | null> {
  const [order] = await db
    .select({
      orderNumber: orders.orderNumber,
      accessToken: orders.accessToken,
      paymentMode: orders.paymentMode,
      contactEmail: orders.contactEmail,
      placedAt: orders.placedAt,
      shippingAddress: orders.shippingAddress,
      subtotalPaise: orders.subtotalPaise,
      discountPaise: orders.discountPaise,
      shippingFeePaise: orders.shippingFeePaise,
      codFeePaise: orders.codFeePaise,
      giftWrapTotalPaise: orders.giftWrapTotalPaise,
      totalPaise: orders.totalPaise,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return null;
  // No email on file → skip (return); SMS is the channel for phone-only guests.
  if (order.contactEmail === null || order.contactEmail === '') return null;

  const items = await db
    .select({
      productName: orderItems.productName,
      variantName: orderItems.variantName,
      quantity: orderItems.quantity,
      lineTotalPaise: orderItems.lineTotalPaise,
      giftMessage: orderItems.giftMessage,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.createdAt);

  const addr = order.shippingAddress;
  const trackUrl = `${siteUrl()}/account/track?order=${encodeURIComponent(
    order.orderNumber,
  )}&accessToken=${encodeURIComponent(order.accessToken)}`;

  const model: OrderEmailModel = {
    orderNumber: order.orderNumber,
    paymentMode: order.paymentMode === 'cod' ? 'cod' : 'prepaid',
    placedAt: new Date(order.placedAt),
    items: items.map((i) => ({
      productName: i.productName,
      variantName: i.variantName,
      quantity: i.quantity,
      lineTotalPaise: i.lineTotalPaise,
      giftMessage: i.giftMessage,
    })),
    subtotalPaise: order.subtotalPaise,
    discountPaise: order.discountPaise,
    shippingFeePaise: order.shippingFeePaise,
    codFeePaise: order.codFeePaise,
    giftWrapTotalPaise: order.giftWrapTotalPaise,
    totalPaise: order.totalPaise,
    shippingAddress: {
      fullName: addr.fullName,
      line1: addr.line1,
      ...(addr.line2 !== undefined ? { line2: addr.line2 } : {}),
      ...(addr.landmark !== undefined ? { landmark: addr.landmark } : {}),
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
    },
    trackUrl,
  };

  return { to: order.contactEmail, model };
}

/**
 * Send the order-confirmation email. Best-effort: swallows every error. Called
 * after COD placement, after prepaid provider-order creation, and after payment
 * confirmation — the shared `order-confirm-<id>` idempotency key dedups the
 * prepaid double-fire (verify + webhook).
 */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  try {
    const loaded = await loadOrderEmailModel(orderId);
    if (loaded === null) return;
    const vars = orderEmailVars(loaded.model);
    // DB override (if an admin set one) else the rich code template.
    const override = await resolveOverrideEmail('order_confirmed', vars);
    const rendered = override ?? orderConfirmationEmail(loaded.model);
    await deliverEmail('order_confirmed', orderId, loaded.to, rendered, `order-confirm-${orderId}`);
  } catch (cause) {
    console.error('email.order_confirmation_failed', {
      order_id: orderId,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}

/** The base `{{placeholder}}` values for an order email/SMS. */
function orderEmailVars(m: OrderEmailModel): Record<string, string> {
  return {
    orderNumber: m.orderNumber,
    customerName: m.shippingAddress.fullName,
    trackingUrl: m.trackUrl,
    amount: formatPaise(m.totalPaise),
  };
}

/**
 * Send the order-cancellation email. Best-effort: swallows every error. Called
 * after the cancel tx commits. `order-cancel-<id>` dedups any retried cancel.
 */
export async function sendOrderCancellation(orderId: string): Promise<void> {
  try {
    const loaded = await loadOrderEmailModel(orderId);
    if (loaded === null) return;
    const override = await resolveOverrideEmail('order_cancelled', orderEmailVars(loaded.model));
    const rendered = override ?? orderCancelledEmail(loaded.model);
    await deliverEmail('order_cancelled', orderId, loaded.to, rendered, `order-cancel-${orderId}`);
  } catch (cause) {
    console.error('email.order_cancellation_failed', {
      order_id: orderId,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}

/* ------------------------------------------------------------------ */
/* Fulfilment updates (shipped / out-for-delivery / delivered)         */
/* ------------------------------------------------------------------ */

const ISO_DATE_IST = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Kolkata',
});

const SMS_TEMPLATE: Record<FulfilmentStage, string> = {
  shipped: 'order_shipped',
  out_for_delivery: 'order_out_for_delivery',
  delivered: 'order_delivered',
};

/** Best-effort transactional SMS — never throws (email is the guaranteed channel). */
async function sendSmsBestEffort(
  phoneE164: string,
  message: string,
  template: string,
): Promise<void> {
  try {
    await getSmsProvider().sendText({ phoneE164, message, template });
  } catch (cause) {
    // Expected until DLT templates are registered on the real provider.
    console.warn('sms.transactional_skipped', {
      template,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}

/**
 * Send a fulfilment-stage update (shipped / out-for-delivery / delivered) to the
 * customer — email (if an address is on file) + best-effort SMS. Best-effort and
 * NEVER throws; a `order-<stage>-<id>` idempotency key means a webhook + poller
 * both seeing the same stage don't double-email.
 */
export async function sendFulfilmentUpdate(
  orderId: string,
  stage: FulfilmentStage,
): Promise<void> {
  try {
    const [order] = await db
      .select({
        orderNumber: orders.orderNumber,
        accessToken: orders.accessToken,
        contactEmail: orders.contactEmail,
        contactPhone: orders.contactPhone,
        shippingAddress: orders.shippingAddress,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) return;

    const [shipment] = await db
      .select({
        awbCode: shipments.awbCode,
        courierName: shipments.courierName,
        expectedDeliveryAt: shipments.expectedDeliveryAt,
      })
      .from(shipments)
      .where(and(eq(shipments.orderId, orderId), sql`${shipments.supersededAt} IS NULL`))
      .limit(1);

    const trackUrl = `${siteUrl()}/account/track?order=${encodeURIComponent(
      order.orderNumber,
    )}&accessToken=${encodeURIComponent(order.accessToken)}`;
    const etaText =
      stage !== 'delivered' && shipment?.expectedDeliveryAt
        ? `Expected by ${ISO_DATE_IST.format(new Date(shipment.expectedDeliveryAt))}`
        : null;
    const awb = shipment?.awbCode ?? null;
    const courierName = shipment?.courierName ?? null;
    const key = SMS_TEMPLATE[stage]; // 'order_shipped' | 'order_out_for_delivery' | 'order_delivered'
    const vars: Record<string, string> = {
      orderNumber: order.orderNumber,
      customerName: order.shippingAddress.fullName,
      trackingUrl: trackUrl,
      awb: awb ?? '',
      courierName: courierName ?? '',
      eta: etaText ?? '',
    };

    if (order.contactEmail !== null && order.contactEmail !== '') {
      const override = await resolveOverrideEmail(key, vars);
      const rendered =
        override ??
        orderFulfilmentEmail({ orderNumber: order.orderNumber, customerName: order.shippingAddress.fullName, stage, awb, courierName, etaText, trackUrl });
      await deliverEmail(key, orderId, order.contactEmail, rendered, `order-${stage}-${orderId}`);
    }

    // Best-effort SMS to the contact phone (Fake in dev; DLT-gated in prod).
    const overrideSms = await resolveOverrideSms(key, vars);
    const smsBody =
      overrideSms ??
      (stage === 'delivered'
        ? `KAKAO: Order ${order.orderNumber} delivered. Enjoy! ${trackUrl}`
        : stage === 'out_for_delivery'
          ? `KAKAO: Order ${order.orderNumber} is out for delivery today. Track: ${trackUrl}`
          : `KAKAO: Order ${order.orderNumber} shipped${courierName ? ` via ${courierName}` : ''}${awb ? ` (AWB ${awb})` : ''}. Track: ${trackUrl}`);
    await deliverSms(key, orderId, order.contactPhone, smsBody);
  } catch (cause) {
    console.error('email.order_fulfilment_failed', {
      order_id: orderId,
      stage,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}

export function sendOrderShipped(orderId: string): Promise<void> {
  return sendFulfilmentUpdate(orderId, 'shipped');
}
export function sendOrderOutForDelivery(orderId: string): Promise<void> {
  return sendFulfilmentUpdate(orderId, 'out_for_delivery');
}
export function sendOrderDelivered(orderId: string): Promise<void> {
  return sendFulfilmentUpdate(orderId, 'delivered');
}

/* ------------------------------------------------------------------ */
/* Admin new-order alert (Gap A)                                       */
/* ------------------------------------------------------------------ */

/**
 * Alert the ops inbox about a new order — best-effort, never throws. Recipients
 * come from `store_settings` (`ops_alert_email` / `ops_alert_phone`); if neither
 * is set, this is a no-op. `admin-new-order-<id>` dedups the prepaid double-fire.
 */
export async function sendAdminNewOrderAlert(orderId: string): Promise<void> {
  try {
    const settingRows = await db
      .select({ key: storeSettings.key, value: storeSettings.value })
      .from(storeSettings)
      .where(sql`${storeSettings.key} in ('ops_alert_email', 'ops_alert_phone')`);
    const byKey = new Map(settingRows.map((r) => [r.key, r.value]));
    const alertEmail = typeof byKey.get('ops_alert_email') === 'string' ? (byKey.get('ops_alert_email') as string) : '';
    const alertPhone = typeof byKey.get('ops_alert_phone') === 'string' ? (byKey.get('ops_alert_phone') as string) : '';
    if (alertEmail === '' && alertPhone === '') return; // no recipient configured

    const [order] = await db
      .select({
        orderNumber: orders.orderNumber,
        paymentMode: orders.paymentMode,
        totalPaise: orders.totalPaise,
        shippingAddress: orders.shippingAddress,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) return;

    const [countRow] = await db
      .select({ n: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    const itemCount = Number(countRow?.n ?? 0);

    const model = {
      orderNumber: order.orderNumber,
      paymentMode: order.paymentMode === 'cod' ? ('cod' as const) : ('prepaid' as const),
      totalPaise: order.totalPaise,
      itemCount,
      city: order.shippingAddress.city,
      adminUrl: `${siteUrl()}/admin/orders/${encodeURIComponent(order.orderNumber)}`,
    };

    if (alertEmail !== '') {
      const { subject, html, text } = adminNewOrderAlertEmail(model);
      await getEmailProvider().send({
        to: alertEmail,
        subject,
        html,
        text,
        idempotencyKey: `admin-new-order-${orderId}`,
      });
    }
    if (alertPhone !== '') {
      await sendSmsBestEffort(
        alertPhone,
        `KAKAO new order ${order.orderNumber}: ₹${(order.totalPaise / 100).toFixed(0)} · ${itemCount} item(s) · ${model.paymentMode.toUpperCase()}`,
        'admin_new_order',
      );
    }
  } catch (cause) {
    console.error('email.admin_new_order_alert_failed', {
      order_id: orderId,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}
