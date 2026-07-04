import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPaise } from "@kakoa/core";
import { resolveAdminContext } from "@/lib/admin/context";
import { getPaymentDetail } from "@/lib/admin/payments";
import {
  isCodRemittable,
  methodLabel,
  REFUND_DESTINATION_LABEL,
} from "@/lib/admin/payment-format";
import { NoAccess } from "@/components/admin/NoAccess";
import {
  PaymentStatusBadge,
  RefundStatusBadge,
} from "@/components/admin/PaymentStatusBadge";
import { PaymentRefundPanel } from "@/components/admin/PaymentRefundPanel";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("payments:read")) return <NoAccess module="Payments" />;

  const { id } = await params;
  const payment = await getPaymentDetail(id);
  if (payment === null) notFound();

  const canRefund = resolved.ctx.can("payments:refund");

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={"/admin/payments" as Route}
        className="text-[13px] text-[#8a7a68] hover:text-[#2a1d12]"
      >
        ← Payments
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1
          className="text-[24px] text-[#2a1d12]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          <Link
            href={`/admin/orders/${payment.orderNumber}` as Route}
            className="hover:text-[#8a5a34]"
          >
            {payment.orderNumber}
          </Link>
        </h1>
        <PaymentStatusBadge status={payment.status} />
        <span className="rounded-full bg-[#f3e7d5] px-2.5 py-1 text-[11.5px] font-medium capitalize text-[#5c4b3a]">
          {payment.provider} · {methodLabel(payment.method)}
        </span>
      </div>

      {!payment.signatureVerified && !payment.isCod ? (
        <div className="mb-4 rounded-xl border border-[#f0d3bd] bg-[#fbf1e8] px-4 py-2.5 text-[12.5px] text-[#a5623a]">
          ⚠ This payment's gateway signature was not verified — treat with caution
          before refunding.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Payment">
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Amount" value={formatPaise(payment.amountPaise)} />
              <Row
                label="Refunded"
                value={
                  payment.amountRefundedPaise > 0
                    ? formatPaise(payment.amountRefundedPaise)
                    : "—"
                }
              />
              <Row
                label="Remaining refundable"
                value={formatPaise(payment.remainingRefundablePaise)}
              />
              <Row label="Order status" value={payment.orderStatus.replace(/_/g, " ")} />
              <Row label="Created" value={DATE_FMT.format(new Date(payment.createdAt))} />
              {payment.codRemittedAt ? (
                <Row
                  label="COD remitted"
                  value={DATE_FMT.format(new Date(payment.codRemittedAt))}
                />
              ) : null}
              {payment.codRemittanceRef ? (
                <Row label="Remittance ref" value={payment.codRemittanceRef} />
              ) : null}
            </div>
            {payment.failureCode || payment.failureReason ? (
              <div className="mt-3 rounded-lg bg-[#f9efe6] px-3 py-2 text-[12.5px] text-[#a5623a]">
                <span className="font-medium">Failure:</span>{" "}
                {payment.failureCode ? `${payment.failureCode} · ` : ""}
                {payment.failureReason ?? "—"}
              </div>
            ) : null}
          </Card>

          <Card title="Refund history">
            {payment.refunds.length === 0 ? (
              <p className="text-[13px] text-[#8a7a68]">No refunds on this payment.</p>
            ) : (
              <ul className="space-y-2.5">
                {payment.refunds.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[#f3ece1] pb-2.5 text-[12.5px] last:border-0 last:pb-0"
                  >
                    <span className="font-semibold tabular-nums text-[#8a5a34]">
                      {formatPaise(r.amountPaise)}
                    </span>
                    <RefundStatusBadge status={r.status} />
                    <span className="text-[#8a7a68]">
                      {REFUND_DESTINATION_LABEL[r.destination] ?? r.destination}
                    </span>
                    {r.payoutReference ? (
                      <span className="font-mono text-[11.5px] text-[#6b5844]">
                        {r.payoutReference}
                      </span>
                    ) : null}
                    <span className="text-[#b8a88f]">· {r.reason}</span>
                    <span className="ml-auto text-[11px] text-[#b8a88f]">
                      {DATE_FMT.format(new Date(r.createdAt))}
                      {r.initiatedByEmail ? ` · ${r.initiatedByEmail}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Order">
            <div className="text-[13px] text-[#2a1d12]">{payment.customerName}</div>
            <div className="text-[12.5px] text-[#6b5844]">
              {payment.contactPhoneMasked}
            </div>
            <Link
              href={`/admin/orders/${payment.orderNumber}` as Route}
              className="mt-2 inline-block text-[12.5px] font-medium text-[#8a5a34] hover:underline"
            >
              View order →
            </Link>
          </Card>

          {canRefund ? (
            <PaymentRefundPanel
              paymentId={payment.id}
              isCod={payment.isCod}
              remainingRefundablePaise={payment.remainingRefundablePaise}
              isRemittable={isCodRemittable(payment.status)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div>
      <div className="text-[11.5px] uppercase tracking-wide text-[#b8a88f]">
        {label}
      </div>
      <div className="mt-0.5 text-[13.5px] font-medium capitalize text-[#2a1d12]">
        {value}
      </div>
    </div>
  );
}
