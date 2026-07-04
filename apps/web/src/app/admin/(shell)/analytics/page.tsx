import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { formatPaise } from "@kakoa/core";
import { resolveAdminContext } from "@/lib/admin/context";
import {
  getBestSellers,
  getCouponUsage,
  getLowStock,
  getPaymentSplit,
  getRevenueTimeseries,
  getSalesByCategory,
  getStatusBreakdown,
  getSummary,
} from "@/lib/admin/analytics";
import { resolveRange, type RangePreset } from "@/lib/admin/analytics-range";
import { NoAccess } from "@/components/admin/NoAccess";
import { RevenueChart } from "@/components/admin/RevenueChart";

export const dynamic = "force-dynamic";

const PRESETS: { label: string; value: RangePreset }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "MTD", value: "mtd" },
  { label: "YTD", value: "ytd" },
  { label: "All", value: "all" },
];

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("analytics:read")) return <NoAccess module="Analytics" />;
  const canExport = resolved.ctx.can("reports:export");

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const presetParam = one(sp.preset) ?? "30d";

  // Preset-only input always resolves (an unknown preset falls back to 30d).
  const rangeResult = resolveRange({ preset: presetParam });
  if (!rangeResult.ok) return <NoAccess module="Analytics" />;
  const range = rangeResult.range;
  const activePreset = range.preset;

  const [summary, series, bestSellers, categorySales, paymentSplit, statusBreakdown, couponUsage, lowStock] =
    await Promise.all([
      getSummary(range),
      getRevenueTimeseries(range, range.bucketDefault),
      getBestSellers(range, { by: "revenue", limit: 10 }),
      getSalesByCategory(range),
      getPaymentSplit(range),
      getStatusBreakdown(range),
      getCouponUsage(range),
      getLowStock(),
    ]);

  const activeStatuses = statusBreakdown.filter((s) => s.count > 0);
  const exportHref = (report: string): Route =>
    `/api/admin/analytics/export?report=${report}&preset=${activePreset}` as Route;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
            Analytics
          </h1>
          <p className="text-[13px] text-[#8a7a68]">Revenue, orders and best-sellers · IST</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Link
              key={p.value}
              href={`/admin/analytics?preset=${p.value}` as Route}
              className={
                "rounded-full px-3 py-1 text-[12.5px] transition-colors " +
                (activePreset === p.value
                  ? "bg-[#2a1d12] font-semibold text-[#f3e7d5]"
                  : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
              }
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Headline cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Net revenue" value={formatPaise(summary.netRevenuePaise)} big />
        <Card label="Orders" value={String(summary.orders)} />
        <Card label="Paid orders" value={String(summary.paidOrders)} />
        <Card label="Avg. order value" value={formatPaise(summary.aovPaise)} />
        <Card label="Units sold" value={String(summary.unitsSold)} />
        <Card label="Refund rate" value={`${summary.refundRatePct}%`} />
      </div>

      <div className="mb-4">
        <RevenueChart points={series.points} bucket={series.bucket} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Best sellers */}
        <div className="lg:col-span-2">
          <Panel
            title="Best sellers"
            action={canExport ? <ExportLink href={exportHref("best-sellers")}>Export CSV</ExportLink> : null}
          >
            {bestSellers.length === 0 ? (
              <Empty />
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
                    <th className="py-2 font-medium">Product</th>
                    <th className="py-2 text-right font-medium">Units</th>
                    <th className="py-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {bestSellers.map((r) => (
                    <tr key={r.productId} className="border-b border-[#f3ece1] last:border-0">
                      <td className="py-2">
                        <div className="text-[#2a1d12]">{r.productName}</div>
                        <div className="font-mono text-[11px] text-[#8a7a68]">{r.sku}</div>
                      </td>
                      <td className="py-2 text-right tabular-nums text-[#5c4b3a]">{r.unitsSold}</td>
                      <td className="py-2 text-right tabular-nums text-[#2a1d12]">{formatPaise(r.revenuePaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        {/* Payment split */}
        <Panel title="Payment split">
          <SplitRow label="Prepaid" orders={paymentSplit.prepaid.orders} net={paymentSplit.prepaid.netRevenuePaise} />
          <SplitRow label="COD" orders={paymentSplit.cod.orders} net={paymentSplit.cod.netRevenuePaise} />
          <div className="mt-2 border-t border-[#f3ece1] pt-2 text-[12px] text-[#8a7a68]">
            New customers <span className="font-semibold text-[#2a1d12]">{summary.newCustomers}</span> ·
            Returning <span className="font-semibold text-[#2a1d12]">{summary.returningCustomers}</span>
          </div>
        </Panel>

        {/* Sales by category */}
        <div className="lg:col-span-2">
          <Panel title="Sales by category">
            {categorySales.length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-1.5">
                {categorySales.map((c) => (
                  <li key={c.categoryId} className="flex items-baseline justify-between text-[13px]">
                    <span className="text-[#2a1d12]">{c.categoryName}</span>
                    <span className="text-[#5c4b3a]">
                      <span className="tabular-nums">{c.unitsSold}</span> units ·{" "}
                      <span className="font-semibold tabular-nums text-[#2a1d12]">{formatPaise(c.revenuePaise)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Coupon usage */}
        <Panel title="Coupon usage">
          {couponUsage.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-1.5">
              {couponUsage.map((c) => (
                <li key={c.code} className="flex items-baseline justify-between text-[13px]">
                  <span className="font-mono text-[#2a1d12]">{c.code}</span>
                  <span className="text-[#5c4b3a]">
                    <span className="tabular-nums">{c.redemptions}</span>× ·{" "}
                    <span className="tabular-nums">{formatPaise(c.totalDiscountPaise)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Status breakdown */}
        <div className="lg:col-span-2">
          <Panel
            title="Orders by status"
            action={canExport ? <ExportLink href={exportHref("orders")}>Export orders CSV</ExportLink> : null}
          >
            {activeStatuses.length === 0 ? (
              <Empty />
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeStatuses.map((s) => (
                  <span key={s.status} className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f2ea] px-3 py-1 text-[12.5px] text-[#5c4b3a]">
                    {s.status.replace(/_/g, " ")}
                    <span className="rounded-full bg-[#2a1d12] px-1.5 text-[11px] font-semibold text-[#f3e7d5]">{s.count}</span>
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Low stock */}
        <Panel title={`Low stock (${lowStock.count})`}>
          {lowStock.items.length === 0 ? (
            <Empty text="Nothing low." />
          ) : (
            <ul className="space-y-1.5">
              {lowStock.items.map((l) => (
                <li key={l.sku} className="flex items-baseline justify-between text-[12.5px]">
                  <span className="text-[#2a1d12]">
                    {l.productName} <span className="text-[#8a7a68]">{l.variantName}</span>
                  </span>
                  <span className={"tabular-nums font-semibold " + (l.stockQuantity === 0 ? "text-[#b25b5b]" : "text-[#a9791f]")}>
                    {l.stockQuantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {canExport ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ExportLink href={exportHref("revenue")}>Export revenue CSV</ExportLink>
        </div>
      ) : null}
    </div>
  );
}

function Card({ label, value, big }: { label: string; value: string; big?: boolean }): ReactNode {
  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-4">
      <div className="text-[11px] uppercase tracking-wider text-[#8a7a68]">{label}</div>
      <div className={(big ? "text-[22px] " : "text-[18px] ") + "mt-0.5 font-semibold tabular-nums tracking-tight text-[#2a1d12]"}>
        {value}
      </div>
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }): ReactNode {
  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ExportLink({ href, children }: { href: Route; children: ReactNode }): ReactNode {
  return (
    <a
      href={href}
      className="rounded-lg border border-[#eadbc6] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5c4b3a] hover:bg-[#f3e7d5]"
    >
      {children}
    </a>
  );
}

function SplitRow({ label, orders, net }: { label: string; orders: number; net: number }): ReactNode {
  return (
    <div className="flex items-baseline justify-between py-1 text-[13px]">
      <span className="text-[#2a1d12]">{label}</span>
      <span className="text-[#5c4b3a]">
        <span className="tabular-nums">{orders}</span> orders ·{" "}
        <span className="font-semibold tabular-nums text-[#2a1d12]">{formatPaise(net)}</span>
      </span>
    </div>
  );
}

function Empty({ text = "No data in this range." }: { text?: string }): ReactNode {
  return <p className="text-[13px] text-[#8a7a68]">{text}</p>;
}
