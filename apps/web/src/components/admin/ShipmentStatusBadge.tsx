import type { ReactNode } from "react";
import { shipmentStatusLabel } from "@/lib/admin/shipping-status";
import { StatusPill, type Tone } from "./StatusPill";

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
  return <StatusPill tone={tone} label={shipmentStatusLabel(status)} />;
}
