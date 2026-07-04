import type { ReactNode } from "react";
import {
  paymentStatusLabel,
  PAYMENT_STATUS_TONE,
  REFUND_STATUS_LABEL,
  type Tone,
} from "@/lib/admin/payment-format";

const TONE_CLS: Record<Tone, string> = {
  success: "bg-[#dff0e3] text-[#3f8a54]",
  danger: "bg-[#f6dede] text-[#b25b5b]",
  warn: "bg-[#f5e3c4] text-[#9a6b1e]",
  refund: "bg-[#e6e2f6] text-[#5b4fa3]",
  neutral: "bg-[#ece6df] text-[#8a7a68]",
};

export function PaymentStatusBadge({ status }: { status: string }): ReactNode {
  const tone = PAYMENT_STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium ${TONE_CLS[tone]}`}
    >
      {paymentStatusLabel(status)}
    </span>
  );
}

const REFUND_TONE: Record<string, Tone> = {
  initiated: "warn",
  processed: "success",
  failed: "danger",
};

export function RefundStatusBadge({ status }: { status: string }): ReactNode {
  const tone = REFUND_TONE[status] ?? "neutral";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_CLS[tone]}`}
    >
      {REFUND_STATUS_LABEL[status] ?? status}
    </span>
  );
}
