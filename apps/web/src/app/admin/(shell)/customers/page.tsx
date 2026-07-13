import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { formatPaise } from "@kakoa/core";
import { resolveAdminContext } from "@/lib/admin/context";
import { listCustomers } from "@/lib/admin/customers";
import { NoAccess } from "@/components/admin/NoAccess";
import { StatusPill } from "@/components/admin/StatusPill";

export const dynamic = "force-dynamic";

function customersHref(params: Record<string, string | undefined>): Route {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return (qs ? `/admin/customers?${qs}` : "/admin/customers") as Route;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("customers:read")) return <NoAccess module="Customers" />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filterRaw = one(sp.filter);
  const filter = filterRaw === "blocked" ? "blocked" : "all";
  const search = (one(sp.search) ?? "").slice(0, 80);
  const page = Math.max(1, Number(one(sp.page) ?? "1") || 1);

  const canViewPii = resolved.ctx.can("customers:pii-view");
  const list = await listCustomers({ search, filter, page }, canViewPii);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
            Customers
          </h1>
          <p className="text-[13px] text-[#8a7a68]">
            {list.total} customer{list.total === 1 ? "" : "s"}
            {canViewPii ? "" : " · contact details masked"}
          </p>
        </div>
        <form action="/admin/customers" className="flex gap-2">
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <input
            name="search"
            defaultValue={search}
            placeholder="Search name, phone or email"
            className="w-64 rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c69a4c]"
          />
          <button type="submit" className="rounded-lg border border-[#eadbc6] bg-white px-4 py-2 text-[13px] font-semibold text-[#2a1d12] hover:bg-[#f3e7d5]">
            Search
          </button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[
          { label: "All", value: undefined },
          { label: "Blocked", value: "blocked" },
        ].map((f) => (
          <Link
            key={f.label}
            href={customersHref({ filter: f.value, search: search || undefined })}
            className={
              "rounded-full px-3 py-1 text-[12.5px] transition-colors " +
              (filter === (f.value ?? "all")
                ? "bg-[#2a1d12] font-semibold text-[#f3e7d5]"
                : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 text-right font-medium">Orders</th>
              <th className="px-4 py-3 text-right font-medium">Lifetime spend</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#8a7a68]">No customers match this filter.</td>
              </tr>
            ) : (
              list.rows.map((c) => (
                <tr key={c.id} className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}` as Route} className="font-semibold text-[#2a1d12] hover:text-[#8a5a34]">
                      {c.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#5c4b3a]">
                    {c.phone ? <div className="font-mono text-[12px]">{c.phone}</div> : null}
                    {c.email ? <div className="text-[11.5px] text-[#8a7a68]">{c.email}</div> : null}
                    {!c.phone && !c.email ? "—" : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#2a1d12]">{c.orderCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#2a1d12]">{formatPaise(c.lifetimeSpendPaise)}</td>
                  <td className="px-4 py-3 text-[#5c4b3a]">{new Date(c.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={c.isBlocked ? "danger" : "success"} label={c.isBlocked ? "Blocked" : "Active"} />
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
            <PageLink href={customersHref({ filter: filter === "all" ? undefined : filter, search: search || undefined, page: String(list.page - 1) })} disabled={list.page <= 1}>Previous</PageLink>
            <PageLink href={customersHref({ filter: filter === "all" ? undefined : filter, search: search || undefined, page: String(list.page + 1) })} disabled={list.page >= list.pageCount}>Next</PageLink>
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
