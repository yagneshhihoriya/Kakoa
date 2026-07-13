import type { ReactNode } from "react";
import type { OrderStatus } from "@kakoa/core";
import { StatusPill, type Tone } from "./StatusPill";

/** Label + tone per order status. Exhaustive over the 11 states. */
const STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: "Pending payment", tone: "warn" },
  payment_failed: { label: "Payment failed", tone: "danger" },
  cod_pending_confirmation: { label: "COD to confirm", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "info" },
  packed: { label: "Packed", tone: "purple" },
  shipped: { label: "Shipped", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  rto_initiated: { label: "RTO initiated", tone: "warn" },
  rto_delivered: { label: "RTO delivered", tone: "danger" },
};

export function StatusBadge({ status }: { status: OrderStatus }): ReactNode {
  const s = STATUS[status];
  return <StatusPill tone={s.tone} label={s.label} />;
}
