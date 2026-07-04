/**
 * `/account/orders/[orderNumber]` — logged-in order detail (order-tracking.md
 * §2 parallel path). Server component: the session is the credential.
 *   - anonymous          → redirect home with `?login=1` (opens login sheet)
 *   - signed-in non-owner → `notFound()` (indistinguishable 404, no oracle)
 *   - owner              → render items + client tracking view + cancel
 *
 * The timeline/shipment are fetched client-side (session cookie) so this stays
 * a thin ownership gate. Dynamic; never cached.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth/session";
import { loadOwnedOrderDetail } from "@/lib/orders/order-detail-data";
import { OrderDetailClient } from "@/components/orders/OrderDetailClient";

export const metadata: Metadata = {
  title: "Order detail · Kakoa",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ORDER_NUMBER_RE = /^KK-\d{5}$/;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber: raw } = await params;
  const orderNumber = decodeURIComponent(raw).toUpperCase();

  const customer = await getCurrentCustomer();
  if (customer === null) {
    redirect("/?login=1");
  }

  if (!ORDER_NUMBER_RE.test(orderNumber)) {
    notFound();
  }

  const detail = await loadOwnedOrderDetail(orderNumber, customer.id);
  if (detail === null) {
    // Order doesn't exist OR isn't owned by this session — same 404.
    notFound();
  }

  return (
    <OrderDetailClient orderNumber={detail.orderNumber} items={detail.items} />
  );
}
