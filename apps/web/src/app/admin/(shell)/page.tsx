import type { ReactNode } from "react";
import { formatPaise, type OrderStatus } from "@kakoa/core";
import { resolveAdminContext } from "@/lib/admin/context";
import { adminRegistry } from "@/lib/admin/modules";
import { computeDashboardMetrics, type DashboardMetrics } from "@/lib/admin/metrics";
import { AdminIcon } from "@/components/admin/icons";
import { NoAccess } from "@/components/admin/NoAccess";

export const dynamic = "force-dynamic";

/** Presentation + value resolver for each dashboard widget slot. */
const WIDGET_META: Record<
  string,
  { label: string; icon: string; badge: string; value: (m: DashboardMetrics) => string }
> = {
  revenue: {
    label: "Net revenue",
    icon: "wallet",
    badge: "bg-[#f6e6c9] text-[#a9772f]",
    value: (m) => formatPaise(m.netRevenuePaise),
  },
  "orders-today": {
    label: "Orders today",
    icon: "receipt",
    badge: "bg-[#dfeaf6] text-[#3f6fa3]",
    value: (m) => String(m.ordersToday),
  },
  "low-stock": {
    label: "Low stock",
    icon: "layers",
    badge: "bg-[#f6dede] text-[#b25b5b]",
    value: (m) => String(m.lowStockCount),
  },
};

/** Human labels + tints for order statuses in the breakdown. */
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  payment_failed: "Payment failed",
  cod_pending_confirmation: "COD to confirm",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rto_initiated: "RTO initiated",
  rto_delivered: "RTO delivered",
};

export default async function AdminDashboardPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null; // the shell layout already redirects
  const { admin, ctx } = resolved;
  // Defense-in-depth vs direct-URL access (the nav already hides this): the
  // MiniStats + status breakdown render from `metrics`, not the permission-
  // filtered widget list, so gate the whole page on `dashboard:read`.
  if (!ctx.can("dashboard:read")) return <NoAccess module="Dashboard" />;
  const composed = adminRegistry.compose(ctx);
  const metrics = await computeDashboardMetrics();

  const activeStatuses = metrics.statusBreakdown.filter((s) => s.count > 0);

  return (
    <div className="mx-auto max-w-7xl">
      <h1
        className="mb-1 text-[26px] text-[#2a1d12]"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Welcome, {admin.name.split(" ")[0]}
      </h1>
      <p className="mb-6 text-[14px] text-[#6b5844]">
        {ctx.profile.name} · signed in as{" "}
        <span className="font-semibold">{admin.roleKey}</span>
      </p>

      {/* Primary widgets */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {composed.widgets.length === 0 ? (
          <p className="text-[13px] text-[#8a7a68]">
            No dashboard widgets available for your role.
          </p>
        ) : (
          composed.widgets.map((w) => {
            const meta = WIDGET_META[w.key];
            if (meta === undefined) return null;
            return (
              <div
                key={w.key}
                className="rounded-2xl border border-[#eadbc6] bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="text-[12.5px] font-medium text-[#6b5844]">
                    {meta.label}
                  </div>
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full ${meta.badge}`}
                  >
                    <AdminIcon name={meta.icon} className="h-[18px] w-[18px]" />
                  </span>
                </div>
                <div className="mt-2 text-[27px] font-semibold tracking-tight text-[#2a1d12]">
                  {meta.value(metrics)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Secondary stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Total orders" value={String(metrics.ordersTotal)} />
        <MiniStat label="Paid orders" value={String(metrics.paidOrders)} />
        <MiniStat label="Avg. order value" value={formatPaise(metrics.aovPaise)} />
        <MiniStat label="COD to confirm" value={String(metrics.codPendingCount)} />
      </div>

      {/* Orders by status */}
      <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
        <div className="mb-3 text-[13px] font-semibold text-[#2a1d12]">
          Orders by status
        </div>
        {activeStatuses.length === 0 ? (
          <p className="text-[13px] text-[#8a7a68]">No orders yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeStatuses.map((s) => (
              <span
                key={s.status}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f2ea] px-3 py-1 text-[12.5px] text-[#5c4b3a]"
              >
                {STATUS_LABEL[s.status]}
                <span className="rounded-full bg-[#2a1d12] px-1.5 text-[11px] font-semibold text-[#f3e7d5]">
                  {s.count}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="rounded-xl border border-[#eadbc6] bg-white px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[#8a7a68]">
        {label}
      </div>
      <div className="mt-0.5 text-[18px] font-semibold text-[#2a1d12]">
        {value}
      </div>
    </div>
  );
}
