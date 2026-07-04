import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPaise } from "@kakoa/core";
import { resolveAdminContext } from "@/lib/admin/context";
import { getOrderDetail } from "@/lib/admin/orders";
import { getActiveShipmentForOrder } from "@/lib/admin/shipping";
import { shipmentStatusLabel } from "@/lib/admin/shipping-status";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { NoAccess } from "@/components/admin/NoAccess";
import { OrderActions } from "@/components/admin/OrderActions";
import { CreateShipmentButton } from "@/components/admin/CreateShipmentButton";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("orders:read")) return <NoAccess module="Orders" />;

  const { orderNumber } = await params;
  const order = await getOrderDetail(orderNumber);
  if (order === null) notFound();

  const addr = order.shippingAddress;

  const canReadShipping = resolved.ctx.can("shipping:read");
  const canManageShipping = resolved.ctx.can("shipping:manage");
  const shipment = canReadShipping ? await getActiveShipmentForOrder(order.id) : null;
  const canCreateShipment =
    canManageShipping &&
    shipment === null &&
    (order.status === "confirmed" || order.status === "packed");

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href={"/admin/orders" as Route}
        className="text-[13px] text-[#8a7a68] hover:text-[#2a1d12]"
      >
        ← Orders
      </Link>
      <div className="mb-6 mt-2 flex items-center gap-3">
        <h1
          className="text-[24px] text-[#2a1d12]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          {order.orderNumber}
        </h1>
        <StatusBadge status={order.status} />
        <span className="rounded-full bg-[#f3e7d5] px-2.5 py-1 text-[11.5px] font-medium capitalize text-[#5c4b3a]">
          {order.paymentMode}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Items + totals */}
        <div className="lg:col-span-2">
          <Card title="Items">
            <table className="w-full text-left text-[13px]">
              <tbody>
                {order.items.map((it, i) => (
                  <tr key={i} className="border-b border-[#f3ece1] last:border-0">
                    <td className="py-2.5">
                      <div className="text-[#2a1d12]">{it.productName}</div>
                      <div className="text-[11.5px] text-[#8a7a68]">
                        {it.variantName} · ×{it.quantity}
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-medium text-[#2a1d12]">
                      {formatPaise(it.lineTotalPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 border-t border-[#eadbc6] pt-3 text-[13px]">
              <TotalRow label="Subtotal" value={order.subtotalPaise} />
              {order.discountPaise > 0 ? (
                <TotalRow
                  label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
                  value={-order.discountPaise}
                />
              ) : null}
              {order.shippingFeePaise > 0 ? (
                <TotalRow label="Shipping" value={order.shippingFeePaise} />
              ) : null}
              {order.codFeePaise > 0 ? (
                <TotalRow label="COD fee" value={order.codFeePaise} />
              ) : null}
              {order.giftWrapTotalPaise > 0 ? (
                <TotalRow label="Gift wrap" value={order.giftWrapTotalPaise} />
              ) : null}
              <div className="flex justify-between border-t border-[#eadbc6] pt-2 text-[15px] font-semibold text-[#2a1d12]">
                <span>Total</span>
                <span>{formatPaise(order.totalPaise)}</span>
              </div>
            </div>
          </Card>

          {/* Status timeline */}
          <Card title="Status history" className="mt-4">
            {order.history.length === 0 ? (
              <p className="text-[13px] text-[#8a7a68]">No history.</p>
            ) : (
              <ol className="space-y-2.5">
                {order.history.map((h, i) => (
                  <li key={i} className="flex items-start gap-3 text-[13px]">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#c69a4c]" />
                    <span>
                      <span className="font-medium text-[#2a1d12]">
                        {h.fromStatus ? `${h.fromStatus} → ` : ""}
                        {h.toStatus}
                      </span>
                      <span className="text-[#8a7a68]">
                        {" "}
                        · {h.actorType} · {DATE_FMT.format(new Date(h.at))}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Sidebar: customer, payment */}
        <div className="space-y-4">
          <Card title="Customer">
            <div className="text-[13px] text-[#2a1d12]">{order.customerName}</div>
            <div className="text-[12.5px] text-[#6b5844]">
              {order.contactPhoneMasked}
            </div>
            {order.contactEmail ? (
              <div className="text-[12.5px] text-[#6b5844]">
                {order.contactEmail}
              </div>
            ) : null}
            <div className="mt-3 text-[12.5px] leading-relaxed text-[#6b5844]">
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}
              <br />
              {addr.city}, {addr.state} {addr.pincode}
            </div>
          </Card>

          <Card title="Payment">
            {order.payment === null ? (
              <p className="text-[13px] text-[#8a7a68]">No payment record.</p>
            ) : (
              <div className="space-y-1 text-[13px]">
                <Row label="Status" value={order.payment.status} />
                <Row label="Method" value={order.payment.method} />
                <Row
                  label="Amount"
                  value={formatPaise(order.payment.amountPaise)}
                />
                {order.payment.amountRefundedPaise > 0 ? (
                  <Row
                    label="Refunded"
                    value={formatPaise(order.payment.amountRefundedPaise)}
                  />
                ) : null}
              </div>
            )}
          </Card>

          {canReadShipping ? (
            <Card title="Shipment">
              {shipment !== null ? (
                <div className="space-y-1 text-[13px]">
                  <Row label="Status" value={shipmentStatusLabel(shipment.status)} />
                  <Row label="AWB" value={shipment.awbCode ?? "—"} />
                  {shipment.courierName ? <Row label="Courier" value={shipment.courierName} /> : null}
                  <Link
                    href={`/admin/shipping/${shipment.id}` as Route}
                    className="mt-2 inline-block text-[12.5px] font-medium text-[#8a5a34] hover:underline"
                  >
                    Open shipment →
                  </Link>
                </div>
              ) : canCreateShipment ? (
                <CreateShipmentButton orderId={order.id} />
              ) : (
                <p className="text-[13px] text-[#8a7a68]">
                  {order.status === "confirmed" || order.status === "packed"
                    ? "No shipment yet."
                    : "A shipment can be created once the order is confirmed or packed."}
                </p>
              )}
            </Card>
          ) : null}

          <OrderActions
            orderNumber={order.orderNumber}
            status={order.status}
            canConfirmCod={resolved.ctx.can("orders:cod-manage")}
            canAdvance={resolved.ctx.can("orders:transition")}
            canCancel={resolved.ctx.can("orders:refund")}
          />
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <div
      className={`rounded-2xl border border-[#eadbc6] bg-white p-5 ${className ?? ""}`}
    >
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
        {title}
      </div>
      {children}
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <div className="flex justify-between text-[#5c4b3a]">
      <span>{label}</span>
      <span>{formatPaise(value)}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="flex justify-between">
      <span className="text-[#8a7a68]">{label}</span>
      <span className="font-medium capitalize text-[#2a1d12]">
        {value.replace(/_/g, " ")}
      </span>
    </div>
  );
}
