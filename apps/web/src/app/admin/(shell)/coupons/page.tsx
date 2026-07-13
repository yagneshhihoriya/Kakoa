import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { resolveAdminContext } from "@/lib/admin/context";
import { listCoupons } from "@/lib/admin/coupons";
import type { CouponStatus } from "@/lib/admin/coupon-validation";
import { NoAccess } from "@/components/admin/NoAccess";
import { StatusPill, type Tone } from "@/components/admin/StatusPill";

export const dynamic = "force-dynamic";

function couponsHref(params: Record<string, string | undefined>): Route {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return (qs ? `/admin/coupons?${qs}` : "/admin/coupons") as Route;
}

const STATUS_TONE: Record<CouponStatus, Tone> = {
  active: "success",
  scheduled: "info",
  expired: "neutral",
  exhausted: "warn",
  inactive: "neutral",
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("coupons:read")) return <NoAccess module="Promotions" />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const statusRaw = one(sp.status);
  const status = statusRaw === "active" || statusRaw === "inactive" ? statusRaw : "all";
  const search = (one(sp.search) ?? "").slice(0, 40);
  const page = Math.max(1, Number(one(sp.page) ?? "1") || 1);

  const list = await listCoupons({ search, status, page });
  const canManage = resolved.ctx.can("coupons:manage");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
            Promotions
          </h1>
          <p className="text-[13px] text-[#8a7a68]">{list.total} coupon{list.total === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/admin/coupons" className="flex gap-2">
            <input name="search" defaultValue={search} placeholder="Search code"
              className="w-44 rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c69a4c]" />
            <button type="submit" className="rounded-lg border border-[#eadbc6] bg-white px-4 py-2 text-[13px] font-semibold text-[#2a1d12] hover:bg-[#f3e7d5]">
              Search
            </button>
          </form>
          {canManage ? (
            <Link href={"/admin/coupons/new" as Route} className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[13px] font-semibold text-[#f3e7d5] hover:opacity-90">
              + New promotion
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[
          { label: "All", value: undefined },
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ].map((f) => (
          <Link key={f.label} href={couponsHref({ status: f.value, search: search || undefined })}
            className={
              "rounded-full px-3 py-1 text-[12.5px] transition-colors " +
              (status === (f.value ?? "all")
                ? "bg-[#2a1d12] font-semibold text-[#f3e7d5]"
                : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
            }>
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Discount</th>
              <th className="px-4 py-3 font-medium">Min order</th>
              <th className="px-4 py-3 font-medium">Used</th>
              <th className="px-4 py-3 font-medium">Ends</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[#8a7a68]">No coupons match this filter.</td></tr>
            ) : (
              list.rows.map((c) => (
                <tr key={c.id} className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]">
                  <td className="px-4 py-3">
                    {canManage ? (
                      <Link href={`/admin/coupons/${c.id}` as Route} className="font-mono font-semibold text-[#2a1d12] hover:text-[#8a5a34]">
                        {c.code}
                      </Link>
                    ) : (
                      <span className="font-mono font-semibold text-[#2a1d12]">{c.code}</span>
                    )}
                    {c.description ? <div className="text-[11.5px] text-[#8a7a68]">{c.description}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-[#2a1d12]">
                    {c.percentBp != null ? `${c.percentBp / 100}% off` : c.flatPaise != null ? `₹${c.flatPaise / 100} off` : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#5c4b3a]">{c.minSubtotalPaise > 0 ? `₹${c.minSubtotalPaise / 100}` : "—"}</td>
                  <td className="px-4 py-3 text-[#5c4b3a]">
                    {c.redemptionCount}{c.usageLimit != null ? ` / ${c.usageLimit}` : ""}
                  </td>
                  <td className="px-4 py-3 text-[#5c4b3a]">
                    {c.endsAt ? new Date(c.endsAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={STATUS_TONE[c.status]} label={titleCase(c.status)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {list.pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-between text-[13px] text-[#6b5844]">
          <span>Page {list.page} of {list.pageCount}</span>
          <div className="flex gap-2">
            <PageLink href={couponsHref({ status: status === "all" ? undefined : status, search: search || undefined, page: String(list.page - 1) })} disabled={list.page <= 1}>Previous</PageLink>
            <PageLink href={couponsHref({ status: status === "all" ? undefined : status, search: search || undefined, page: String(list.page + 1) })} disabled={list.page >= list.pageCount}>Next</PageLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: Route; disabled: boolean; children: ReactNode }): ReactNode {
  if (disabled) return <span className="cursor-not-allowed rounded-lg border border-[#eadbc6] px-3 py-1.5 text-[#c9bba6]">{children}</span>;
  return <Link href={href} className="rounded-lg border border-[#eadbc6] bg-white px-3 py-1.5 hover:bg-[#f3e7d5]">{children}</Link>;
}
