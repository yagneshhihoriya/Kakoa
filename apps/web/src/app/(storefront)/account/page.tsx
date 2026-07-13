import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth/session";
import { loadAccountData } from "@/lib/auth/account-data";
import {
  AccountDashboard,
  type AccountAddress,
  type AccountOrder,
  type AccountWishlistItem,
} from "@/components/auth/AccountDashboard";

export const metadata = { title: "Your account" };

// Session cookie read + per-customer queries — never statically rendered.
export const dynamic = "force-dynamic";

/**
 * Account dashboard (auth-otp.md §2, accounts.md). Server component: resolves
 * the session via `getCurrentCustomer()`; anonymous visitors are redirected
 * home with `?login=1` so the AuthProvider opens the login sheet. Signed-in
 * visitors get the read-only Orders / Addresses / Wishlist / Profile shell
 * with real live data (full CRUD ships with the accounts module).
 */
export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (customer === null) {
    redirect("/?login=1");
  }

  let orders: AccountOrder[] = [];
  let addresses: AccountAddress[] = [];
  let wishlist: AccountWishlistItem[] = [];
  let loadError = false;

  try {
    const data = await loadAccountData(customer.id);
    orders = data.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      placedAtIso: order.placedAt.toISOString(),
      totalPaise: order.totalPaise,
      itemCount: order.itemCount,
      invoiceAvailable: order.invoiceAvailable,
    }));
    addresses = data.addresses.map((address) => ({
      id: address.id,
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      stateCode: address.stateCode,
      pincode: address.pincode,
      isDefault: address.isDefault,
    }));
    wishlist = data.wishlist.map((item) => ({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      fromPricePaise: item.fromPricePaise,
    }));
  } catch {
    // Partial/error state — render the shell with a non-fatal banner.
    loadError = true;
  }

  return (
    <AccountDashboard
      customer={customer}
      orders={orders}
      addresses={addresses}
      wishlist={wishlist}
      loadError={loadError}
    />
  );
}
