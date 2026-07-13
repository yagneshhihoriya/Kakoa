import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPaise } from "@kakoa/core";
import { resolveAdminContext } from "@/lib/admin/context";
import {
  getCustomerDetail,
  listCustomerAddresses,
  listCustomerOrders,
} from "@/lib/admin/customers";
import { NoAccess } from "@/components/admin/NoAccess";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { StatusPill } from "@/components/admin/StatusPill";
import { CustomerBlockButton } from "@/components/admin/CustomerBlockButton";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("customers:read")) return <NoAccess module="Customers" />;

  const { id } = await params;
  const canViewPii = resolved.ctx.can("customers:pii-view");
  const customer = await getCustomerDetail(id, canViewPii);
  if (customer === null) notFound();

  const [orders, addresses] = await Promise.all([
    listCustomerOrders(id),
    listCustomerAddresses(id, canViewPii),
  ]);
  const canBlock = resolved.ctx.can("customers:block");
  const displayName = customer.name ?? "Customer";

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={"/admin/customers" as Route} className="text-[13px] text-[#8a7a68] hover:text-[#2a1d12]">
        ← Customers
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
          {displayName}
        </h1>
        <StatusPill tone={customer.isBlocked ? "danger" : "success"} label={customer.isBlocked ? "Blocked" : "Active"} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Profile */}
        <div className="rounded-2xl border border-[#eadbc6] bg-white p-5 md:col-span-2">
          <h2 className="mb-3 text-[12px] uppercase tracking-wider text-[#8a7a68]">Profile</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone">
              {customer.phone ? (
                <span className="font-mono">
                  {customer.phone}
                  {customer.phoneVerified ? <VerifiedTick /> : null}
                </span>
              ) : (
                <span className="text-[#b8a88f]">—</span>
              )}
            </Field>
            <Field label="Email">
              {customer.email ? (
                <span>
                  {customer.email}
                  {customer.emailVerified ? <VerifiedTick /> : null}
                </span>
              ) : (
                <span className="text-[#b8a88f]">—</span>
              )}
            </Field>
            <Field label="Joined">{new Date(customer.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Field>
            <Field label="Contact visibility">
              {canViewPii ? "Full (PII access)" : <span className="text-[#a9791f]">Masked</span>}
            </Field>
          </dl>
          {canBlock ? (
            <div className="mt-5 border-t border-[#f3ece1] pt-4">
              <CustomerBlockButton customerId={customer.id} isBlocked={customer.isBlocked} name={displayName} />
            </div>
          ) : null}
        </div>

        {/* Stats */}
        <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
          <h2 className="mb-3 text-[12px] uppercase tracking-wider text-[#8a7a68]">Lifetime</h2>
          <div className="space-y-3">
            <Stat label="Lifetime spend" value={formatPaise(customer.lifetimeSpendPaise)} big />
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Orders" value={String(customer.orderCount)} />
              <Stat label="Delivered" value={String(customer.deliveredCount)} />
              <Stat label="Cancelled" value={String(customer.cancelledCount)} />
            </div>
          </div>
        </div>
      </div>

      {/* Orders */}
      <h2 className="mb-3 mt-8 text-[15px] font-semibold text-[#2a1d12]">Orders</h2>
      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Placed</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#8a7a68]">No orders yet.</td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.orderNumber} className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.orderNumber}` as Route} className="font-mono font-semibold text-[#2a1d12] hover:text-[#8a5a34]">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 uppercase text-[#5c4b3a]">{o.paymentMode}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#2a1d12]">{formatPaise(o.totalPaise)}</td>
                  <td className="px-4 py-3 text-[#5c4b3a]">{new Date(o.placedAt).toLocaleDateString("en-IN")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Addresses */}
      <h2 className="mb-3 mt-8 text-[15px] font-semibold text-[#2a1d12]">Addresses</h2>
      {addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8c7b0] bg-white p-6 text-center text-[13px] text-[#8a7a68]">
          No saved addresses.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-2xl border border-[#eadbc6] bg-white p-4 text-[13px]">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-semibold text-[#2a1d12]">{a.label}</span>
                {a.isDefault ? (
                  <span className="rounded-full bg-[#f3e7d5] px-2 py-0.5 text-[10.5px] font-medium text-[#8a6d3b]">Default</span>
                ) : null}
              </div>
              <div className="text-[#5c4b3a]">{a.fullName}</div>
              {a.phone ? <div className="font-mono text-[12px] text-[#8a7a68]">{a.phone}</div> : null}
              <div className="mt-1 text-[#5c4b3a]">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
              </div>
              <div className="text-[#8a7a68]">{a.city}, {a.state} {a.pincode}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div>
      <dt className="text-[11.5px] uppercase tracking-wide text-[#b8a88f]">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] text-[#2a1d12]">{children}</dd>
    </div>
  );
}

function VerifiedTick(): ReactNode {
  return (
    <span title="Verified" className="ml-1.5 text-[11px] font-medium text-[#3f8a54]">✓ verified</span>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }): ReactNode {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#b8a88f]">{label}</div>
      <div className={(big ? "text-[20px] " : "text-[16px] ") + "font-semibold tabular-nums text-[#2a1d12]"}>{value}</div>
    </div>
  );
}
