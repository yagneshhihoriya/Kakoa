"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPaise } from "@kakoa/core";

const INPUT =
  "rounded-lg border border-[#eadbc6] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#c69a4c]";

interface Props {
  paymentId: string;
  isCod: boolean;
  remainingRefundablePaise: number;
  /** True when the payment is in a collected-COD state (can be marked remitted). */
  isRemittable: boolean;
}

type Msg = { kind: "ok" | "err"; text: string } | null;

/**
 * Money-action panel: partial/full refund (prepaid → original method, COD →
 * bank/UPI payout with a reference) and — for a collected-COD payment — mark
 * remitted. Confirms before every money move; disables refund when nothing is
 * left to refund; surfaces server errors verbatim.
 */
export function PaymentRefundPanel({
  paymentId,
  isCod,
  remainingRefundablePaise,
  isRemittable,
}: Props): React.ReactNode {
  const router = useRouter();

  const [amount, setAmount] = useState<string>(
    remainingRefundablePaise > 0
      ? String((remainingRefundablePaise / 100).toFixed(2))
      : "",
  );
  const [destination, setDestination] = useState<string>(
    isCod ? "bank_transfer" : "original_method",
  );
  const [reason, setReason] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const [remitRef, setRemitRef] = useState<string>("");
  const [remitBusy, setRemitBusy] = useState(false);
  const [remitMsg, setRemitMsg] = useState<Msg>(null);

  const canRefund = remainingRefundablePaise > 0;

  async function submitRefund(): Promise<void> {
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setMsg({ kind: "err", text: "Enter a refund amount greater than ₹0." });
      return;
    }
    const amountPaise = Math.round(rupees * 100);
    if (amountPaise > remainingRefundablePaise) {
      setMsg({
        kind: "err",
        text: `You can refund at most ${formatPaise(remainingRefundablePaise)} more.`,
      });
      return;
    }
    if (reason.trim().length === 0) {
      setMsg({ kind: "err", text: "Enter a reason for this refund." });
      return;
    }
    if (isCod && reference.trim().length === 0) {
      setMsg({ kind: "err", text: "Enter the payout reference (UTR / UPI ref)." });
      return;
    }
    if (
      !window.confirm(
        `Refund ${formatPaise(amountPaise)}? This moves money and cannot be undone.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountPaise,
          destination,
          reason: reason.trim(),
          reference: reference.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Refund failed." });
        return;
      }
      setMsg({
        kind: "ok",
        text: `Refunded ${formatPaise(amountPaise)} (${data.data?.gatewayStatus ?? "processed"}).`,
      });
      setReason("");
      setReference("");
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  async function submitRemit(): Promise<void> {
    if (remitRef.trim().length === 0) {
      setRemitMsg({ kind: "err", text: "Enter a remittance reference." });
      return;
    }
    if (!window.confirm("Mark this COD payment as remitted?")) return;

    setRemitBusy(true);
    setRemitMsg(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/remit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: remitRef.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setRemitMsg({ kind: "err", text: data.error?.message ?? "Could not mark remitted." });
        return;
      }
      setRemitMsg({ kind: "ok", text: "Marked remitted." });
      router.refresh();
    } catch {
      setRemitMsg({ kind: "err", text: "Network error." });
    } finally {
      setRemitBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Refund */}
      <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
          Refund
        </div>
        {!canRefund ? (
          <p className="text-[13px] text-[#8a7a68]">
            Nothing left to refund on this payment.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-[12.5px] text-[#6b5844]">
              Up to{" "}
              <span className="font-semibold text-[#2a1d12]">
                {formatPaise(remainingRefundablePaise)}
              </span>{" "}
              refundable.
            </p>
            <label className="block text-[12px] text-[#5c4b3a]">
              <span className="mb-1 block font-medium">Amount (₹)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className={INPUT + " w-40"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="block text-[12px] text-[#5c4b3a]">
              <span className="mb-1 block font-medium">Destination</span>
              <select
                className={INPUT + " w-full"}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                {isCod ? (
                  <>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="upi">UPI</option>
                  </>
                ) : (
                  <option value="original_method">Original method</option>
                )}
              </select>
            </label>
            {isCod ? (
              <label className="block text-[12px] text-[#5c4b3a]">
                <span className="mb-1 block font-medium">Payout reference (UTR / UPI)</span>
                <input
                  className={INPUT + " w-full"}
                  value={reference}
                  placeholder="e.g. UTR123456789"
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
            ) : null}
            <label className="block text-[12px] text-[#5c4b3a]">
              <span className="mb-1 block font-medium">Reason</span>
              <input
                className={INPUT + " w-full"}
                value={reason}
                placeholder="e.g. damaged in transit, goodwill"
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={submitRefund}
              className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[13px] font-semibold text-[#f3e7d5] hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Refunding…" : "Refund"}
            </button>
          </div>
        )}
        {msg !== null ? (
          <p
            className={
              "mt-2 text-[12.5px] " +
              (msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")
            }
          >
            {msg.text}
          </p>
        ) : null}
      </div>

      {/* Mark COD remitted */}
      {isRemittable ? (
        <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
          <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
            Mark COD remitted
          </div>
          <div className="space-y-3">
            <label className="block text-[12px] text-[#5c4b3a]">
              <span className="mb-1 block font-medium">Remittance reference</span>
              <input
                className={INPUT + " w-full"}
                value={remitRef}
                placeholder="e.g. Shiprocket batch #A123"
                onChange={(e) => setRemitRef(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={remitBusy}
              onClick={submitRemit}
              className="rounded-lg border border-[#eadbc6] bg-white px-4 py-2 text-[13px] font-semibold text-[#2a1d12] hover:bg-[#f3e7d5] disabled:opacity-50"
            >
              {remitBusy ? "Saving…" : "Mark remitted"}
            </button>
          </div>
          {remitMsg !== null ? (
            <p
              className={
                "mt-2 text-[12.5px] " +
                (remitMsg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")
              }
            >
              {remitMsg.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
