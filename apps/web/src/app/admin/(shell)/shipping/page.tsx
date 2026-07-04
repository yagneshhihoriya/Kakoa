import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { resolveAdminContext } from "@/lib/admin/context";
import { isShipmentFilter, listShipments, type ShipmentFilter } from "@/lib/admin/shipping";
import { NoAccess } from "@/components/admin/NoAccess";
import { ShipmentStatusBadge } from "@/components/admin/ShipmentStatusBadge";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; value: ShipmentFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "In transit", value: "in_transit" },
  { label: "Delivered", value: "delivered" },
  { label: "RTO", value: "rto" },
  { label: "Exception", value: "exception" },
];

function shipHref(params: Record<string, string | undefined>): Route {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return (qs ? `/admin/shipping?${qs}` : "/admin/shipping") as Route;
}

export default async function AdminShippingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("shipping:read")) return <NoAccess module="Shipping" />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filterRaw = one(sp.filter) ?? "all";
  const filter: ShipmentFilter = isShipmentFilter(filterRaw) ? filterRaw : "all";
  const search = (one(sp.search) ?? "").slice(0, 80);
  const page = Math.max(1, Number(one(sp.page) ?? "1") || 1);

  const list = await listShipments({ search, filter, page });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
            Shipping
          </h1>
          <p className="text-[13px] text-[#8a7a68]">
            {list.total} shipment{list.total === 1 ? "" : "s"} · fulfilment console
          </p>
        </div>
        <form action="/admin/shipping" className="flex gap-2">
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <input
            name="search"
            defaultValue={search}
            placeholder="Search order # or AWB"
            className="w-60 rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c69a4c]"
          />
          <button type="submit" className="rounded-lg border border-[#eadbc6] bg-white px-4 py-2 text-[13px] font-semibold text-[#2a1d12] hover:bg-[#f3e7d5]">
            Search
          </button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={shipHref({ filter: f.value === "all" ? undefined : f.value, search: search || undefined })}
            className={
              "rounded-full px-3 py-1 text-[12.5px] transition-colors " +
              (filter === f.value
                ? "bg-[#2a1d12] font-semibold text-[#f3e7d5]"
                : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">AWB</th>
              <th className="px-4 py-3 font-medium">Courier</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">COD</th>
              <th className="px-4 py-3 font-medium">ETA</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[#8a7a68]">
                  No shipments match this filter.
                </td>
              </tr>
            ) : (
              list.rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/shipping/${r.id}` as Route} className="font-mono font-semibold text-[#2a1d12] hover:text-[#8a5a34]">
                      {r.orderNumber}
                    </Link>
                    <div className="text-[11.5px] text-[#8a7a68]">
                      {r.city}
                      {r.state ? `, ${r.state}` : ""}
                      {r.superseded ? <span className="ml-1.5 rounded bg-[#ece6df] px-1.5 text-[10px] text-[#8a7a68]">superseded</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-[#5c4b3a]">{r.awbCode ?? "—"}</td>
                  <td className="px-4 py-3 text-[#5c4b3a]">{r.courierName ?? "—"}</td>
                  <td className="px-4 py-3"><ShipmentStatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">{r.cod ? "COD" : "Prepaid"}</td>
                  <td className="px-4 py-3 text-[#5c4b3a]">
                    {r.expectedDeliveryAt ? new Date(r.expectedDeliveryAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#5c4b3a]">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
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
            <PageLink href={shipHref({ filter: filter === "all" ? undefined : filter, search: search || undefined, page: String(list.page - 1) })} disabled={list.page <= 1}>
              Previous
            </PageLink>
            <PageLink href={shipHref({ filter: filter === "all" ? undefined : filter, search: search || undefined, page: String(list.page + 1) })} disabled={list.page >= list.pageCount}>
              Next
            </PageLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: Route; disabled: boolean; children: ReactNode }): ReactNode {
  if (disabled) {
    return <span className="cursor-not-allowed rounded-lg border border-[#eadbc6] px-3 py-1.5 text-[#c9bba6]">{children}</span>;
  }
  return <Link href={href} className="rounded-lg border border-[#eadbc6] bg-white px-3 py-1.5 hover:bg-[#f3e7d5]">{children}</Link>;
}
