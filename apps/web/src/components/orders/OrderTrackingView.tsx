"use client";

/**
 * Shared tracking render (order-tracking.md §3): order summary card +
 * `TrackingTimeline` + shipment block. Reused by the guest `/account/track`
 * view and the logged-in order-detail page, so it is presentation-only — the
 * order/timeline/shipment come in as props, and cancel is delegated to an
 * optional `onCancel` (present only when the credential can mutate: session or
 * bearer JWT, never accessToken).
 *
 * Shipment block renders "Tracking details appear once shipped" while
 * `shipment` is `null` (pre-AWB, fulfilment module unbuilt) — never a fake AWB.
 */
import type { ReactNode } from "react";
import {
  formatIST,
  formatPaise,
  type OrderTracking,
} from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { TrackingTimeline } from "./TrackingTimeline";
import { isCancellable } from "./useTracking";

const CARD = "rounded-[18px] border border-[#EEE1CE] bg-white";
const SERIF = { fontFamily: "var(--font-display), serif" } as const;

/** Human status label + badge palette (mirrors AccountDashboard STATUS_META). */
const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  pending_payment: { label: "Payment pending", bg: "#F5E3C4", fg: "#9A6B1E" },
  payment_failed: { label: "Payment failed", bg: "#F6D9D9", fg: "#B2453F" },
  cod_pending_confirmation: { label: "Confirming", bg: "#F5E3C4", fg: "#9A6B1E" },
  confirmed: { label: "Confirmed", bg: "#E1EAD0", fg: "#5C6B34" },
  packed: { label: "Packed", bg: "#E1EAD0", fg: "#5C6B34" },
  shipped: { label: "Shipped", bg: "#DCE6EF", fg: "#3D5A73" },
  out_for_delivery: { label: "Out for delivery", bg: "#DCE6EF", fg: "#3D5A73" },
  delivered: { label: "Delivered", bg: "#E1EAD0", fg: "#5C6B34" },
  cancelled: { label: "Cancelled", bg: "#EDE6DD", fg: "#7A6A58" },
  rto_initiated: { label: "Return in transit", bg: "#F6D9D9", fg: "#B2453F" },
  rto_delivered: { label: "Returned", bg: "#EDE6DD", fg: "#7A6A58" },
};

function statusMeta(status: string): { label: string; bg: string; fg: string } {
  return STATUS_META[status] ?? { label: status, bg: "#EDE6DD", fg: "#7A6A58" };
}

export interface OrderTrackingViewProps {
  tracking: OrderTracking;
  /** Present when this credential can cancel (session/bearer). Omit for accessToken. */
  onCancel?: () => void;
  /** Extra slot rendered above the timeline (e.g. order items on detail page). */
  itemsSlot?: ReactNode;
}

export function OrderTrackingView({
  tracking,
  onCancel,
  itemsSlot,
}: OrderTrackingViewProps): ReactNode {
  const { order, timeline, shipment } = tracking;
  const meta = statusMeta(order.status);
  const cancellable = isCancellable(order.status);
  const placedIST = safePlaced(order.placedAt);

  return (
    <div className="grid grid-cols-[1.4fr_0.9fr] items-start gap-6 max-[860px]:grid-cols-1">
      {/* LEFT: progress */}
      <div className={cx(CARD, "p-7 max-[560px]:p-5")}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <span className="text-[22px] text-ink" style={SERIF}>
            Progress
          </span>
          <span
            className="rounded-pill px-[14px] py-1.5 font-body text-[12.5px] font-semibold"
            style={{ background: meta.bg, color: meta.fg }}
          >
            {meta.label}
          </span>
        </div>

        {itemsSlot}

        <TrackingTimeline steps={timeline} />
      </div>

      {/* RIGHT: order meta + shipment + cancel */}
      <div className="flex flex-col gap-4">
        <div className={cx(CARD, "p-[22px]")}>
          <div className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8a5a34]">
            Order
          </div>
          <dl className="flex flex-col gap-3 font-body text-[14px] text-ink">
            <Row label="Number" value={`#${order.orderNumber}`} />
            <Row
              label="Placed"
              value={placedIST ?? "—"}
            />
            <Row
              label="Payment"
              value={order.paymentMode === "cod" ? "Cash on delivery" : "Prepaid"}
            />
            <Row label="Items" value={`${order.itemCount}`} />
            <Row label="Total" value={formatPaise(order.totalPaise)} valueClass="font-bold" />
            <Row label="Contact" value={order.contactPhoneMasked} />
          </dl>
        </div>

        {/* Shipment block — null until fulfilment populates AWB/courier. */}
        <div className={cx(CARD, "p-[22px]")}>
          <div className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8a5a34]">
            Shipment
          </div>
          {shipment !== null ? (
            <div className="font-body text-[14px] leading-[1.6] text-ink">
              <div>{shipment.courierName}</div>
              <div className="text-[#6B5A49]">AWB {shipment.awb}</div>
              {shipment.expectedDeliveryAt !== null &&
              safePlaced(shipment.expectedDeliveryAt) !== null ? (
                <div className="mt-2 text-[#7C8A4E]">
                  Expected {safePlaced(shipment.expectedDeliveryAt)}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="font-body text-[13.5px] leading-relaxed text-[#8a7a68]">
              Tracking details appear here once your order ships.
            </p>
          )}
        </div>

        {onCancel !== undefined && cancellable ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[14px] border-[1.5px] border-[#E0CFB6] bg-transparent px-4 py-3.5 font-body text-[13.5px] font-bold text-raspberry transition-colors hover:bg-[#F6D9D9]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Cancel this order
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex-none text-[#8a7a68]">{label}</dt>
      <dd className={cx("text-right text-ink", valueClass)}>{value}</dd>
    </div>
  );
}

/** IST render that degrades to `null` on a bad instant. */
function safePlaced(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatIST(date);
}
