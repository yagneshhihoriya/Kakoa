"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShipmentStatus } from "@kakoa/core";
import { nextShipmentStatuses, shipmentStatusLabel } from "@/lib/admin/shipping-status";

const INPUT =
  "w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c69a4c]";

const ADVANCE_LABEL: Partial<Record<ShipmentStatus, string>> = {
  pickup_scheduled: "Schedule pickup",
  picked_up: "Mark picked up",
  in_transit: "Mark in transit",
  out_for_delivery: "Mark out for delivery",
  delivered: "Mark delivered",
  rto_initiated: "Initiate RTO",
  rto_in_transit: "Mark RTO in transit",
  rto_delivered: "Mark RTO delivered",
};

export function ShipmentActions({
  shipmentId,
  status,
  superseded,
}: {
  shipmentId: string;
  status: ShipmentStatus;
  superseded: boolean;
}): React.ReactNode {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [awb, setAwb] = useState("");
  const [courier, setCourier] = useState("");

  async function post(key: string, path: string, body?: unknown): Promise<void> {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/shipping/${shipmentId}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error?.message ?? "Action failed.");
        setBusy(null);
        return;
      }
      router.refresh();
      setTimeout(() => setBusy(null), 500);
    } catch {
      setError("Network error. Please try again.");
      setBusy(null);
    }
  }

  async function bulk(key: string, action: "label" | "pickup"): Promise<void> {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/shipping/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, shipmentIds: [shipmentId] }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error?.message ?? "Action failed.");
        setBusy(null);
        return;
      }
      router.refresh();
      setTimeout(() => setBusy(null), 500);
    } catch {
      setError("Network error. Please try again.");
      setBusy(null);
    }
  }

  // Label/pickup available once an AWB is assigned (i.e. beyond `pending`).
  const hasAwb = status !== "pending";
  const canPickup = status === "awb_assigned";

  if (superseded) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d8c7b0] p-4 text-[12.5px] text-[#8a7a68]">
        This shipment is superseded — read-only history.
      </div>
    );
  }

  const advances = nextShipmentStatuses(status);
  const showCancel = status !== "delivered" && status !== "rto_delivered" && status !== "cancelled" && status !== "lost";

  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
        Actions
      </div>

      <div className="space-y-3">
        {status === "pending" ? (
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#5c4b3a]">
                AWB (leave blank to auto-assign via provider)
              </label>
              <input
                className={INPUT}
                value={awb}
                placeholder="e.g. KKMOCK1A2B3C4D"
                onChange={(e) => setAwb(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#5c4b3a]">
                Courier name (optional)
              </label>
              <input
                className={INPUT}
                value={courier}
                placeholder="e.g. Blue Dart"
                onChange={(e) => setCourier(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                post("awb", "/awb", {
                  awbCode: awb.trim() || undefined,
                  courierName: courier.trim() || undefined,
                })
              }
              className="w-full rounded-lg bg-[#2a1d12] px-4 py-2.5 text-[13.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy === "awb" ? "Assigning…" : "Assign AWB"}
            </button>
          </div>
        ) : null}

        {hasAwb ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => bulk("label", "label")}
              className="flex-1 rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#5c4b3a] hover:bg-[#f3e7d5] disabled:opacity-50"
            >
              {busy === "label" ? "Generating…" : "Generate label"}
            </button>
            {canPickup ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => bulk("pickup", "pickup")}
                className="flex-1 rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#5c4b3a] hover:bg-[#f3e7d5] disabled:opacity-50"
              >
                {busy === "pickup" ? "Requesting…" : "Request pickup"}
              </button>
            ) : null}
          </div>
        ) : null}

        {advances.map((to) => {
          const isRto = to === "rto_initiated";
          return (
            <button
              key={to}
              type="button"
              disabled={busy !== null}
              onClick={() => {
                if (isRto && !window.confirm("Initiate RTO (return to origin) for this shipment?")) return;
                void post(`advance-${to}`, "/advance", { toStatus: to });
              }}
              className={
                "w-full rounded-lg px-4 py-2.5 text-[13.5px] font-semibold transition-colors disabled:opacity-50 " +
                (isRto
                  ? "border border-[#e2c4c4] text-[#b25b5b] hover:bg-[#f6dede]"
                  : "bg-[#2a1d12] text-[#f3e7d5] hover:opacity-90")
              }
            >
              {busy === `advance-${to}`
                ? "Updating…"
                : ADVANCE_LABEL[to] ?? `Advance to ${shipmentStatusLabel(to)}`}
            </button>
          );
        })}

        {showCancel ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm("Cancel this shipment? It will be superseded so the order can be re-shipped.")) return;
              void post("cancel", "/cancel");
            }}
            className="w-full rounded-lg border border-[#eadbc6] px-4 py-2.5 text-[13px] font-semibold text-[#5c4b3a] transition-colors hover:bg-[#f3e7d5] disabled:opacity-50"
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel / supersede shipment"}
          </button>
        ) : null}

        {error !== null ? <p className="text-[12.5px] text-[#b25b5b]">{error}</p> : null}
      </div>
    </div>
  );
}
