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
import { db, orders, orderItems } from '@kakoa/db';
import { getEmailProvider } from '@kakoa/integrations';
import { eq } from 'drizzle-orm';

import { siteUrl } from '@/lib/seo/site';
import {
  orderCancelledEmail,
  orderConfirmationEmail,
  type OrderEmailModel,
} from './templates';

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
    const { subject, html, text } = orderConfirmationEmail(loaded.model);
    await getEmailProvider().send({
      to: loaded.to,
      subject,
      html,
      text,
      idempotencyKey: `order-confirm-${orderId}`,
    });
  } catch (cause) {
    console.error('email.order_confirmation_failed', {
      order_id: orderId,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}

/**
 * Send the order-cancellation email. Best-effort: swallows every error. Called
 * after the cancel tx commits. `order-cancel-<id>` dedups any retried cancel.
 */
export async function sendOrderCancellation(orderId: string): Promise<void> {
  try {
    const loaded = await loadOrderEmailModel(orderId);
    if (loaded === null) return;
    const { subject, html, text } = orderCancelledEmail(loaded.model);
    await getEmailProvider().send({
      to: loaded.to,
      subject,
      html,
      text,
      idempotencyKey: `order-cancel-${orderId}`,
    });
  } catch (cause) {
    console.error('email.order_cancellation_failed', {
      order_id: orderId,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}
