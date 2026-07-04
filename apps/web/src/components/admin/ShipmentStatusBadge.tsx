import type { ReactNode } from "react";
import { shipmentStatusLabel } from "@/lib/admin/shipping-status";

type Tone = "success" | "danger" | "warn" | "info" | "neutral";

const TONE_CLS: Record<Tone, string> = {
  success: "bg-[#dff0e3] text-[#3f8a54]",
  danger: "bg-[#f6dede] text-[#b25b5b]",
  warn: "bg-[#f5e3c4] text-[#9a6b1e]",
  info: "bg-[#dfeaf6] text-[#4a6b8a]",
  neutral: "bg-[#ece6df] text-[#8a7a68]",
};

const STATUS_TONE: Record<string, Tone> = {
  pending: "neutral",
  awb_assigned: "info",
  pickup_scheduled: "info",
  picked_up: "info",
  in_transit: "info",
  out_for_delivery: "warn",
  delivered: "success",
  rto_initiated: "warn",
  rto_in_transit: "warn",
  rto_delivered: "danger",
  cancelled: "neutral",
  lost: "danger",
};

export function ShipmentStatusBadge({ status }: { status: string }): ReactNode {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium ${TONE_CLS[tone]}`}
    >
      {shipmentStatusLabel(status)}
    </span>
  );
}
