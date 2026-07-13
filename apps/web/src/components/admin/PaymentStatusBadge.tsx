import type { ReactNode } from "react";
import {
  paymentStatusLabel,
  PAYMENT_STATUS_TONE,
  REFUND_STATUS_LABEL,
  type Tone,
} from "@/lib/admin/payment-format";
import { StatusPill, type Tone as PillTone } from "./StatusPill";

/** Map the payment-format tone set onto the shared pill tones. */
const TO_PILL: Record<Tone, PillTone> = {
  success: "success",
  danger: "danger",
  warn: "warn",
  refund: "purple",
  neutral: "neutral",
};

export function PaymentStatusBadge({ status }: { status: string }): ReactNode {
  const tone = PAYMENT_STATUS_TONE[status] ?? "neutral";
  return <StatusPill tone={TO_PILL[tone]} label={paymentStatusLabel(status)} />;
}

const REFUND_TONE: Record<string, Tone> = {
  initiated: "warn",
  processed: "success",
  failed: "danger",
};

export function RefundStatusBadge({ status }: { status: string }): ReactNode {
  const tone = REFUND_TONE[status] ?? "neutral";
  return (
    <StatusPill tone={TO_PILL[tone]} label={REFUND_STATUS_LABEL[status] ?? status} size="sm" />
  );
}
