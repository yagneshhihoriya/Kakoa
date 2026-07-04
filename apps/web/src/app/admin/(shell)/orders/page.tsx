import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import {
  formatPaise,
  ORDER_STATUSES,
  PAYMENT_MODES,
  type OrderStatus,
  type PaymentMode,
} from "@kakoa/core";
import { resolveAdminContext } from "@/lib/admin/context";
import { listOrders } from "@/lib/admin/orders";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { NoAccess } from "@/components/admin/NoAccess";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

const STATUS_SHORT: Record<OrderStatus, string> = {
  pending_payment: "Pending",
  payment_failed: "Failed",
  cod_pending_confirmation: "COD confirm",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rto_initiated: "RTO",
  rto_delivered: "RTO delivered",
};

function ordersHref(params: Record<string, string | undefined>): Route {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return (qs ? `/admin/orders?${qs}` : "/admin/orders") as Route;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("orders:read")) return <NoAccess module="Orders" />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const statusRaw = one(sp.status);
  const status =
    statusRaw && (ORDER_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as OrderStatus)
      : undefined;
  const modeRaw = one(sp.paymentMode);
  const paymentMode =
    modeRaw && (PAYMENT_MODES as readonly string[]).includes(modeRaw)
      ? (modeRaw as PaymentMode)
      : undefined;
  const search = (one(sp.search) ?? "").slice(0, 80);
  const page = Math.max(1, Number(one(sp.page) ?? "1") || 1);

  const list = await listOrders({ status, paymentMode, search, page });

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1
            className="text-[24px] text-[#2a1d12]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Orders
          </h1>
          <p className="text-[13px] text-[#8a7a68]">{list.total} total</p>
        </div>
        <form action="/admin/orders" className="flex gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            name="search"
            defaultValue={search}
            placeholder="Search order #, phone, email, name"
            className="w-64 rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c69a4c]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[13px] font-semibold text-[#f3e7d5]"
          >
            Search
          </button>
        </form>
      </div>

      {/* Status filter chips */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip
          href={ordersHref({ search: search || undefined, paymentMode })}
          active={status === undefined}
        >
          All
        </FilterChip>
        {ORDER_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={ordersHref({ status: s, search: search || undefined, paymentMode })}
            active={status === s}
          >
            {STATUS_SHORT[s]}
          </FilterChip>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Placed</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#8a7a68]">
                  No orders match these filters.
                </td>
              </tr>
            ) : (
              list.rows.map((o) => (
                <tr
                  key={o.orderNumber}
                  className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${o.orderNumber}` as Route}
                      className="font-semibold text-[#2a1d12] hover:text-[#8a5a34]"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[#2a1d12]">{o.customerName}</div>
                    <div className="text-[11.5px] text-[#8a7a68]">
                      {o.contactPhoneMasked}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-[#5c4b3a]">
                    {o.paymentMode}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#2a1d12]">
                    {formatPaise(o.totalPaise)}
                  </td>
                  <td className="px-4 py-3 text-[#6b5844]">
                    {DATE_FMT.format(new Date(o.placedAt))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {list.pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-between text-[13px] text-[#6b5844]">
          <span>
            Page {list.page} of {list.pageCount}
          </span>
          <div className="flex gap-2">
            <PageLink
              href={ordersHref({
                status,
                paymentMode,
                search: search || undefined,
                page: String(list.page - 1),
              })}
              disabled={list.page <= 1}
            >
              Previous
            </PageLink>
            <PageLink
              href={ordersHref({
                status,
                paymentMode,
                search: search || undefined,
                page: String(list.page + 1),
              })}
              disabled={list.page >= list.pageCount}
            >
              Next
            </PageLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
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
        "rounded-full px-3 py-1 text-[12.5px] transition-colors " +
        (active
          ? "bg-[#2a1d12] font-semibold text-[#f3e7d5]"
          : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
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
