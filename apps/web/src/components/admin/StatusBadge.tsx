import type { ReactNode } from "react";
import type { OrderStatus } from "@kakoa/core";

/** Tint + label per order status. Exhaustive over the 11 states. */
const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  pending_payment: { label: "Pending payment", cls: "bg-[#f3e7d5] text-[#8a6d3b]" },
  payment_failed: { label: "Payment failed", cls: "bg-[#f6dede] text-[#b25b5b]" },
  cod_pending_confirmation: { label: "COD to confirm", cls: "bg-[#f5e3c4] text-[#9a6b1e]" },
  confirmed: { label: "Confirmed", cls: "bg-[#dfeaf6] text-[#3f6fa3]" },
  packed: { label: "Packed", cls: "bg-[#e6e2f6] text-[#5b4fa3]" },
  shipped: { label: "Shipped", cls: "bg-[#dfeef0] text-[#2f7f88]" },
  out_for_delivery: { label: "Out for delivery", cls: "bg-[#dfeef0] text-[#2f7f88]" },
  delivered: { label: "Delivered", cls: "bg-[#dff0e3] text-[#3f8a54]" },
  cancelled: { label: "Cancelled", cls: "bg-[#ece6df] text-[#8a7a68]" },
  rto_initiated: { label: "RTO initiated", cls: "bg-[#f6e0d2] text-[#a5623a]" },
  rto_delivered: { label: "RTO delivered", cls: "bg-[#f6e0d2] text-[#a5623a]" },
};

export function StatusBadge({ status }: { status: OrderStatus }): ReactNode {
  const s = STATUS[status];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
