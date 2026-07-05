/**
 * Read-only account dashboard queries (docs/modules/auth-otp.md §2 / accounts.md).
 *
 * Module 3 renders real seeded/live data for Orders / Addresses / Wishlist as
 * read-only lists — full CRUD (address book, wishlist toggle) ships with the
 * accounts module. Every query is scoped to a single `customerId`; nothing here
 * trusts a client-supplied id (the caller resolves it from the session cookie).
 */
import "server-only";
import {
  customerAddresses,
  db,
  orderItems,
  orders,
  productImages,
  products,
  productVariants,
  wishlistItems,
} from "@kakoa/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type { OrderStatus } from "@kakoa/core";

export interface AccountOrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  placedAt: Date;
  totalPaise: number;
  itemCount: number;
  /** A tax invoice is available once the order is confirmed. */
  invoiceAvailable: boolean;
}

export interface AccountAddressRow {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  isDefault: boolean;
}

export interface AccountWishlistRow {
  productId: string;
  slug: string;
  name: string;
  fromPricePaise: number;
  imageUrl: string | null;
}

export interface AccountData {
  orders: AccountOrderRow[];
  addresses: AccountAddressRow[];
  wishlist: AccountWishlistRow[];
}

const RECENT_ORDER_LIMIT = 10;

/** Recent orders for a customer, newest first, with a summed line count. */
export async function loadCustomerOrders(
  customerId: string,
): Promise<AccountOrderRow[]> {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      placedAt: orders.placedAt,
      totalPaise: orders.totalPaise,
      itemCount: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      invoiceAvailable: sql<boolean>`${orders.confirmedAt} is not null`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(orders.customerId, customerId))
    .groupBy(orders.id)
    .orderBy(desc(orders.placedAt))
    .limit(RECENT_ORDER_LIMIT);
  return rows;
}

/** Saved addresses, default first. */
export async function loadCustomerAddresses(
  customerId: string,
): Promise<AccountAddressRow[]> {
  return db
    .select({
      id: customerAddresses.id,
      label: customerAddresses.label,
      fullName: customerAddresses.fullName,
      phone: customerAddresses.phone,
      line1: customerAddresses.line1,
      line2: customerAddresses.line2,
      landmark: customerAddresses.landmark,
      city: customerAddresses.city,
      state: customerAddresses.state,
      stateCode: customerAddresses.stateCode,
      pincode: customerAddresses.pincode,
      isDefault: customerAddresses.isDefault,
    })
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customerId))
    .orderBy(
      desc(customerAddresses.isDefault),
      desc(customerAddresses.createdAt),
    );
}

/** Wishlist entries joined to product + a lead image + cheapest variant price. */
export async function loadCustomerWishlist(
  customerId: string,
): Promise<AccountWishlistRow[]> {
  const rows = await db
    .select({
      productId: products.id,
      slug: products.slug,
      name: products.name,
      fromPricePaise: sql<number>`coalesce(min(${productVariants.pricePaise}), 0)::int`,
      imageUrl: sql<string | null>`min(${productImages.url})`,
      createdAt: wishlistItems.createdAt,
    })
    .from(wishlistItems)
    .innerJoin(products, eq(products.id, wishlistItems.productId))
    .leftJoin(
      productVariants,
      and(
        eq(productVariants.productId, products.id),
        eq(productVariants.isActive, true),
      ),
    )
    .leftJoin(productImages, eq(productImages.productId, products.id))
    .where(eq(wishlistItems.customerId, customerId))
    .groupBy(products.id, wishlistItems.createdAt)
    .orderBy(desc(wishlistItems.createdAt));
  return rows.map(({ createdAt: _createdAt, ...rest }) => rest);
}

/** Load all three dashboard datasets in parallel. */
export async function loadAccountData(
  customerId: string,
): Promise<AccountData> {
  const [ordersList, addresses, wishlist] = await Promise.all([
    loadCustomerOrders(customerId),
    loadCustomerAddresses(customerId),
    loadCustomerWishlist(customerId),
  ]);
  return { orders: ordersList, addresses, wishlist };
}
