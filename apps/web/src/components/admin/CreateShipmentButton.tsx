"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

/** Create a shipment for a fulfilment-ready order, then jump to its detail page. */
export function CreateShipmentButton({ orderId }: { orderId: string }): React.ReactNode {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/shipping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error?.message ?? "Could not create shipment.");
        setBusy(false);
        return;
      }
      router.push(`/admin/shipping/${data.data.shipmentId}` as Route);
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={create}
        className="w-full rounded-lg bg-[#2a1d12] px-4 py-2.5 text-[13.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create shipment"}
      </button>
      {error !== null ? <p className="mt-2 text-[12.5px] text-[#b25b5b]">{error}</p> : null}
    </div>
  );
}
