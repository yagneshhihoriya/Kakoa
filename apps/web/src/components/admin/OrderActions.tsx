"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@kakoa/core";

/**
 * The admin-drivable "advance" step from each status. Only `confirmed→packed`
 * and `packed→shipped` — delivery (out_for_delivery / delivered) is courier-
 * driven (shipping integration), never a manual admin action.
 */
const NEXT_ADVANCE: Partial<Record<OrderStatus, { toStatus: OrderStatus; label: string }>> = {
  confirmed: { toStatus: "packed", label: "Mark packed" },
  packed: { toStatus: "shipped", label: "Mark shipped" },
};

const ADMIN_CANCELLABLE = new Set<OrderStatus>([
  "pending_payment",
  "payment_failed",
  "cod_pending_confirmation",
  "confirmed",
  "packed",
]);

export function OrderActions({
  orderNumber,
  status,
  canConfirmCod,
  canAdvance,
  canCancel,
}: {
  orderNumber: string;
  status: OrderStatus;
  canConfirmCod: boolean;
  canAdvance: boolean;
  canCancel: boolean;
}): React.ReactNode {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function run(
    key: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${orderNumber}/action`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!data.ok) {
        setError(data.error?.message ?? "Action failed.");
        setBusy(null);
        return;
      }
      setCancelOpen(false);
      router.refresh();
      // keep the button disabled briefly while the server re-renders
      setTimeout(() => setBusy(null), 600);
    } catch {
      setError("Network error. Please try again.");
      setBusy(null);
    }
  }

  const showConfirmCod = canConfirmCod && status === "cod_pending_confirmation";
  const advance = NEXT_ADVANCE[status];
  const showAdvance = canAdvance && advance !== undefined;
  const showCancel = canCancel && ADMIN_CANCELLABLE.has(status);

  if (!showConfirmCod && !showAdvance && !showCancel) {
    return (
      <div className="rounded-xl border border-dashed border-[#d8c7b0] p-3 text-[12px] text-[#8a7a68]">
        No actions available for this order in its current state.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
        Actions
      </div>
      <div className="space-y-2">
        {showConfirmCod ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("confirm-cod", { action: "confirm-cod" })}
            className="w-full rounded-lg bg-[#2a1d12] px-4 py-2.5 text-[13.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === "confirm-cod" ? "Confirming…" : "Confirm COD order"}
          </button>
        ) : null}

        {showAdvance ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              run("advance", { action: "advance", toStatus: advance.toStatus })
            }
            className="w-full rounded-lg bg-[#2a1d12] px-4 py-2.5 text-[13.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === "advance" ? "Updating…" : advance.label}
          </button>
        ) : null}

        {showCancel ? (
          cancelOpen ? (
            <div className="rounded-lg border border-[#eadbc6] p-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Reason for cancelling (optional)"
                className="w-full rounded-md border border-[#eadbc6] bg-[#faf6ef] px-2.5 py-2 text-[13px] outline-none focus:border-[#c69a4c]"
              />
              <p className="mt-1 mb-2 text-[11.5px] text-[#8a7a68]">
                Prepaid orders are refunded to the original method automatically.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run("cancel", { action: "cancel", reason })}
                  className="flex-1 rounded-lg bg-[#b25b5b] px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "cancel" ? "Cancelling…" : "Confirm cancel"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setCancelOpen(false)}
                  className="rounded-lg border border-[#eadbc6] px-3 py-2 text-[13px] text-[#5c4b3a] hover:bg-[#f3e7d5]"
                >
                  Keep
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setCancelOpen(true)}
              className="w-full rounded-lg border border-[#e2c4c4] px-4 py-2.5 text-[13.5px] font-semibold text-[#b25b5b] transition-colors hover:bg-[#f6dede] disabled:opacity-50"
            >
              Cancel order
            </button>
          )
        ) : null}

        {error !== null ? (
          <p className="text-[12.5px] text-[#b25b5b]">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
