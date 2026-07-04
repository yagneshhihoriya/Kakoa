import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { formatPaise } from "@kakoa/core";
import { resolveAdminContext } from "@/lib/admin/context";
import {
  listCodRemittanceQueue,
  listPayments,
} from "@/lib/admin/payments";
import { methodLabel } from "@/lib/admin/payment-format";
import { NoAccess } from "@/components/admin/NoAccess";
import { PaymentStatusBadge } from "@/components/admin/PaymentStatusBadge";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { label: string; value: string | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Captured", value: "captured" },
  { label: "Partially refunded", value: "partially_refunded" },
  { label: "Refunded", value: "refunded" },
  { label: "COD collected", value: "cod_collected" },
  { label: "COD pending remittance", value: "cod_pending_remittance" },
  { label: "Failed", value: "failed" },
];

const METHOD_FILTERS = ["card", "upi", "netbanking", "wallet", "emi", "cod"];

function payHref(params: Record<string, string | undefined>): Route {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return (qs ? `/admin/payments?${qs}` : "/admin/payments") as Route;
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("payments:read")) return <NoAccess module="Payments" />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = one(sp.status);
  const method = one(sp.method);
  const search = (one(sp.search) ?? "").slice(0, 80);
  const view = one(sp.view) === "remittance" ? "remittance" : "list";
  const page = Math.max(1, Number(one(sp.page) ?? "1") || 1);

  const remittanceQueue =
    view === "remittance" ? await listCodRemittanceQueue() : null;
  const list =
    view === "list"
      ? await listPayments({ status, method, search, page })
      : null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-[24px] text-[#2a1d12]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Payments
          </h1>
          <p className="text-[13px] text-[#8a7a68]">
            {view === "remittance"
              ? `${remittanceQueue?.length ?? 0} COD payment${(remittanceQueue?.length ?? 0) === 1 ? "" : "s"} awaiting remittance`
              : "Transactions, refunds and COD remittance"}
          </p>
        </div>
        {view === "list" ? (
          <form action="/admin/payments" className="flex gap-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {method ? <input type="hidden" name="method" value={method} /> : null}
            <input
              name="search"
              defaultValue={search}
              placeholder="Search order # or payment id"
              className="w-64 rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c69a4c]"
            />
            <button
              type="submit"
              className="rounded-lg border border-[#eadbc6] bg-white px-4 py-2 text-[13px] font-semibold text-[#2a1d12] hover:bg-[#f3e7d5]"
            >
              Search
            </button>
          </form>
        ) : null}
      </div>

      {/* View tabs */}
      <div className="mb-4 flex gap-1.5 border-b border-[#eadbc6]">
        <TabLink href={payHref({})} active={view === "list"}>
          Transactions
        </TabLink>
        <TabLink href={payHref({ view: "remittance" })} active={view === "remittance"}>
          COD remittance
        </TabLink>
      </div>

      {view === "list" && list !== null ? (
        <>
          {/* Status pills */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <Link
                key={f.label}
                href={payHref({ status: f.value, method, search: search || undefined })}
                className={
                  "rounded-full px-3 py-1 text-[12.5px] transition-colors " +
                  ((status ?? undefined) === f.value
                    ? "bg-[#2a1d12] font-semibold text-[#f3e7d5]"
                    : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
                }
              >
                {f.label}
              </Link>
            ))}
          </div>

          {/* Method filter */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-[#8a7a68]">Method:</span>
            <Link
              href={payHref({ status, search: search || undefined })}
              className={
                "rounded-full px-2.5 py-0.5 " +
                (!method
                  ? "bg-[#2a1d12] font-semibold text-[#f3e7d5]"
                  : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
              }
            >
              Any
            </Link>
            {METHOD_FILTERS.map((m) => (
              <Link
                key={m}
                href={payHref({ status, method: m, search: search || undefined })}
                className={
                  "rounded-full px-2.5 py-0.5 " +
                  (method === m
                    ? "bg-[#2a1d12] font-semibold text-[#f3e7d5]"
                    : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
                }
              >
                {methodLabel(m)}
              </Link>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Provider / Method</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-right font-medium">Refunded</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[#8a7a68]">
                      No payments match this filter.
                    </td>
                  </tr>
                ) : (
                  list.rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/payments/${r.id}` as Route}
                          className="font-mono font-semibold text-[#2a1d12] hover:text-[#8a5a34]"
                        >
                          {r.orderNumber}
                        </Link>
                        <div className="text-[11.5px] text-[#8a7a68]">
                          {r.contactPhoneMasked}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#5c4b3a]">
                        <span className="capitalize">{r.provider}</span>
                        <span className="text-[#8a7a68]"> · {methodLabel(r.method)}</span>
                        {!r.signatureVerified && r.provider !== "cod" ? (
                          <span
                            title="Signature not verified"
                            className="ml-1.5 rounded bg-[#f6e0d2] px-1.5 text-[10px] text-[#a5623a]"
                          >
                            unverified
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#2a1d12]">
                        {formatPaise(r.amountPaise)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#8a5a34]">
                        {r.amountRefundedPaise > 0
                          ? formatPaise(r.amountRefundedPaise)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-[#5c4b3a]">
                        {new Date(r.createdAt).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {list.pageCount > 1 ? (
            <div className="mt-4 flex items-center justify-between text-[13px] text-[#6b5844]">
              <span>
                Page {list.page} of {list.pageCount}
              </span>
              <div className="flex gap-2">
                <PageLink
                  href={payHref({ status, method, search: search || undefined, page: String(list.page - 1) })}
                  disabled={list.page <= 1}
                >
                  Previous
                </PageLink>
                <PageLink
                  href={payHref({ status, method, search: search || undefined, page: String(list.page + 1) })}
                  disabled={list.page >= list.pageCount}
                >
                  Next
                </PageLink>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {view === "remittance" && remittanceQueue !== null ? (
        <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Collected</th>
              </tr>
            </thead>
            <tbody>
              {remittanceQueue.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[#8a7a68]">
                    No COD payments are awaiting remittance.
                  </td>
                </tr>
              ) : (
                remittanceQueue.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/payments/${r.id}` as Route}
                        className="font-mono font-semibold text-[#2a1d12] hover:text-[#8a5a34]"
                      >
                        {r.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#2a1d12]">
                      {formatPaise(r.amountPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-[#5c4b3a]">
                      {new Date(r.createdAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: Route;
  active: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <Link
      href={href}
      className={
        "-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors " +
        (active
          ? "border-[#2a1d12] font-semibold text-[#2a1d12]"
          : "border-transparent text-[#8a7a68] hover:text-[#2a1d12]")
      }
    >
      {children}
    </Link>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: Route;
  disabled: boolean;
  children: ReactNode;
}): ReactNode {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-[#eadbc6] px-3 py-1.5 text-[#c9bba6]">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-[#eadbc6] bg-white px-3 py-1.5 hover:bg-[#f3e7d5]"
    >
      {children}
    </Link>
  );
}
