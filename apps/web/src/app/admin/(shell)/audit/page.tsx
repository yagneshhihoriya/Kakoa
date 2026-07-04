import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { resolveAdminContext } from "@/lib/admin/context";
import { auditFilterOptions, listAudit } from "@/lib/admin/audit";
import { NoAccess } from "@/components/admin/NoAccess";

export const dynamic = "force-dynamic";

function auditHref(params: Record<string, string | undefined>): Route {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return (qs ? `/admin/audit?${qs}` : "/admin/audit") as Route;
}

/** Render a compact "key: before → after" diff of the changed fields only. */
function DiffCell({ before, after }: { before: unknown; after: unknown }): ReactNode {
  const b = (typeof before === "object" && before !== null ? before : {}) as Record<string, unknown>;
  const a = (typeof after === "object" && after !== null ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const clamp = (v: unknown): string => {
    const s = v === undefined ? "∅" : typeof v === "string" ? v : JSON.stringify(v);
    return s.length > 48 ? s.slice(0, 47) + "…" : s;
  };
  const changed = keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
  if (changed.length === 0) {
    // create (no before) / delete (no after) / no structured diff
    if (before === null && after !== null) return <span className="text-[#3f8a54]">created</span>;
    if (after === null && before !== null) return <span className="text-[#b25b5b]">deleted</span>;
    return <span className="text-[#b8a88f]">—</span>;
  }
  return (
    <ul className="space-y-0.5">
      {changed.map((k) => (
        <li key={k} className="font-mono text-[11px] text-[#5c4b3a]">
          <span className="text-[#8a7a68]">{k}:</span> <span className="text-[#b25b5b]">{clamp(b[k])}</span>
          <span className="text-[#b8a88f]"> → </span>
          <span className="text-[#3f8a54]">{clamp(a[k])}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("audit:read")) return <NoAccess module="Audit Log" />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const entityType = one(sp.entityType) || undefined;
  const action = one(sp.action) || undefined;
  const page = Math.max(1, Number(one(sp.page) ?? "1") || 1);

  const [list, options] = await Promise.all([
    listAudit({ entityType, action, page }),
    auditFilterOptions(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
            Audit Log
          </h1>
          <p className="text-[13px] text-[#8a7a68]">{list.total} recorded admin action{list.total === 1 ? "" : "s"}</p>
        </div>
        <form action="/admin/audit" className="flex flex-wrap gap-2">
          <select name="entityType" defaultValue={entityType ?? ""} className="rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c69a4c]">
            <option value="">All entities</option>
            {options.entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select name="action" defaultValue={action ?? ""} className="rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c69a4c]">
            <option value="">All actions</option>
            {options.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="submit" className="rounded-lg border border-[#eadbc6] bg-white px-4 py-2 text-[13px] font-semibold text-[#2a1d12] hover:bg-[#f3e7d5]">
            Filter
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[#8a7a68]">No admin actions recorded for this filter.</td></tr>
            ) : (
              list.rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f3ece1] last:border-0 align-top hover:bg-[#faf6ef]">
                  <td className="px-4 py-3 whitespace-nowrap text-[#5c4b3a]">
                    {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3 text-[#5c4b3a]">
                    {r.actorEmail ? (
                      <span title={r.actorEmail}>{r.actorName ?? r.actorEmail}</span>
                    ) : (
                      <span className="text-[#b8a88f]">system</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-[#2a1d12]">{r.action}</td>
                  <td className="px-4 py-3 text-[#5c4b3a]">
                    <div>{r.entityType}</div>
                    {r.entityId ? <div className="font-mono text-[10.5px] text-[#b8a88f]">{r.entityId.slice(0, 8)}…</div> : null}
                  </td>
                  <td className="px-4 py-3"><DiffCell before={r.before} after={r.after} /></td>
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
            <PageLink href={auditHref({ entityType, action, page: String(list.page - 1) })} disabled={list.page <= 1}>Previous</PageLink>
            <PageLink href={auditHref({ entityType, action, page: String(list.page + 1) })} disabled={list.page >= list.pageCount}>Next</PageLink>
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
