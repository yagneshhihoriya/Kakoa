import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { resolveAdminContext } from "@/lib/admin/context";
import { listAdminUsers, listAssignableRoles } from "@/lib/admin/staff";
import { NoAccess } from "@/components/admin/NoAccess";
import { StaffManager } from "@/components/admin/StaffManager";

export const dynamic = "force-dynamic";

function staffHref(params: Record<string, string | undefined>): Route {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return (qs ? `/admin/staff?${qs}` : "/admin/staff") as Route;
}

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("staff:manage")) return <NoAccess module="Users & Roles" />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filterRaw = one(sp.filter);
  const filter = filterRaw === "active" || filterRaw === "inactive" ? filterRaw : "all";
  const search = (one(sp.search) ?? "").slice(0, 80);
  const page = Math.max(1, Number(one(sp.page) ?? "1") || 1);

  const [list, roles] = await Promise.all([
    listAdminUsers({ search, filter, page }),
    listAssignableRoles(resolved.admin.grants),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
            Users &amp; Roles
          </h1>
          <p className="text-[13px] text-[#8a7a68]">
            {list.total} admin{list.total === 1 ? "" : "s"} · invite via email, they sign in with an OTP
          </p>
        </div>
        <form action="/admin/staff" className="flex gap-2">
          {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
          <input
            name="search"
            defaultValue={search}
            placeholder="Search name or email"
            className="w-56 rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c69a4c]"
          />
          <button type="submit" className="rounded-lg border border-[#eadbc6] bg-white px-4 py-2 text-[13px] font-semibold text-[#2a1d12] hover:bg-[#f3e7d5]">
            Search
          </button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[
          { label: "All", value: undefined },
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ].map((f) => (
          <Link
            key={f.label}
            href={staffHref({ filter: f.value, search: search || undefined })}
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

      <StaffManager initial={list.rows} roles={roles} selfId={resolved.admin.id} />

      {list.pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-between text-[13px] text-[#6b5844]">
          <span>Page {list.page} of {list.pageCount}</span>
          <div className="flex gap-2">
            <PageLink href={staffHref({ filter: filter === "all" ? undefined : filter, search: search || undefined, page: String(list.page - 1) })} disabled={list.page <= 1}>Previous</PageLink>
            <PageLink href={staffHref({ filter: filter === "all" ? undefined : filter, search: search || undefined, page: String(list.page + 1) })} disabled={list.page >= list.pageCount}>Next</PageLink>
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
