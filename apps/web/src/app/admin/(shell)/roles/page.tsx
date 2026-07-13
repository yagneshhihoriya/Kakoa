import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { resolveAdminContext } from "@/lib/admin/context";
import { listRoles } from "@/lib/admin/roles";
import { NoAccess } from "@/components/admin/NoAccess";
import { StatusPill } from "@/components/admin/StatusPill";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("roles:manage")) return <NoAccess module="Permissions" />;

  const rows = await listRoles();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
            Permissions
          </h1>
          <p className="text-[13px] text-[#8a7a68]">{rows.length} role{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Link href={"/admin/roles/new" as Route} className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[13px] font-semibold text-[#f3e7d5] hover:opacity-90">
          + New role
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[680px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 text-right font-medium">Admins</th>
              <th className="px-4 py-3 text-right font-medium">Permissions</th>
              <th className="px-4 py-3 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]">
                <td className="px-4 py-3">
                  <Link href={`/admin/roles/${r.id}` as Route} className="font-semibold text-[#2a1d12] hover:text-[#8a5a34]">
                    {r.name}
                  </Link>
                  {r.description ? <div className="text-[11.5px] text-[#8a7a68]">{r.description}</div> : null}
                </td>
                <td className="px-4 py-3 font-mono text-[11.5px] text-[#5c4b3a]">{r.key}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#5c4b3a]">{r.userCount}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#5c4b3a]">
                  {r.permissionCount === "all" ? "All" : r.permissionCount}
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={r.isSystem ? "purple" : "neutral"} label={r.isSystem ? "System" : "Custom"} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
