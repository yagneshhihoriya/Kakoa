/**
 * Server-side loader for the logged-in order-detail page
 * (`/account/orders/[orderNumber]`). Resolves ownership by `customerId` — the
 * page is only reachable by the owning session, so a wrong owner / missing
 * order returns `null` (the page then 404s indistinguishably).
 *
 * This is a READ of `orders` + `order_items` snapshots for the item list; the
 * timeline + shipment come from the client tracking fetch (session-cookie
 * credential), so this loader intentionally does not build the timeline.
 */
import { db, orderItems, orders } from "@kakoa/db";
import { and, eq } from "drizzle-orm";

export interface OrderDetailItem {
  id: string;
  productName: string;
  variantName: string;
  quantity: number;
  lineTotalPaise: number;
  giftWrap: boolean;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  items: OrderDetailItem[];
}

/**
 * Load an owned order + its item snapshots, or `null` if the order does not
 * exist OR is not owned by `customerId` (both → 404 at the page).
 */
export async function loadOwnedOrderDetail(
  orderNumber: string,
  customerId: string,
): Promise<OrderDetail | null> {
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(
        eq(orders.orderNumber, orderNumber),
        eq(orders.customerId, customerId),
      ),
    )
    .limit(1);

  if (!order) return null;

  const items = await db
    .select({
      id: orderItems.id,
      productName: orderItems.productName,
      variantName: orderItems.variantName,
      quantity: orderItems.quantity,
      lineTotalPaise: orderItems.lineTotalPaise,
      giftWrap: orderItems.giftWrap,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    items,
  };
}
