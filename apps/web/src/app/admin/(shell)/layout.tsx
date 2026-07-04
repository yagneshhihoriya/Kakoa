import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { resolveAdminContext } from "@/lib/admin/context";
import { adminRegistry } from "@/lib/admin/modules";
import {
  AdminSidebar,
  type SidebarNavItem,
  type SidebarSection,
} from "@/components/admin/AdminSidebar";
import { AdminIcon } from "@/components/admin/icons";

// Reads the admin cookie/session — never statically cached.
export const dynamic = "force-dynamic";

/** Display sections, in order. Maps a module's group to a sidebar section. */
const SECTION_ORDER = ["Overview", "Commerce", "Content", "Insight", "System"] as const;

function sectionFor(key: string, group: string): string {
  if (key === "dashboard") return "Overview";
  if (group === "commerce") return "Commerce";
  if (group === "content") return "Content";
  if (group === "insight") return "Insight";
  return "System";
}

/**
 * Gated admin shell (docs/admin-platform §5). Resolves the acting admin +
 * BusinessContext, redirects the unauthenticated to sign-in, and renders the
 * registry-composed sidebar (grouped, icon'd, permission- and capability-
 * filtered) plus a top bar.
 */
export default async function AdminShellLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) redirect("/admin/login");
  const { admin, ctx } = resolved;
  const composed = adminRegistry.compose(ctx);

  // Group the permitted modules into display sections.
  const bySection = new Map<string, SidebarNavItem[]>();
  for (const m of composed.modules) {
    const items = m.nav
      .filter((n) => ctx.can(n.permission))
      .map<SidebarNavItem>((n) => ({
        label: n.label,
        href: n.href,
        icon: n.icon ?? null,
      }));
    if (items.length === 0) continue;
    const section = sectionFor(m.key, m.group);
    const bucket = bySection.get(section) ?? [];
    bucket.push(...items);
    bySection.set(section, bucket);
  }
  const sections: SidebarSection[] = SECTION_ORDER.filter((s) =>
    bySection.has(s),
  ).map((label) => ({ label, items: bySection.get(label)! }));

  const initials = admin.name
    .split(" ")
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f7f2ea] text-[#2a1d12]">
      <AdminSidebar
        business={{ name: ctx.profile.name, vertical: ctx.profile.vertical }}
        sections={sections}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-[#eadbc6] bg-white/80 px-6 py-3 backdrop-blur">
          <button
            type="button"
            aria-label="Notifications"
            className="grid h-9 w-9 place-items-center rounded-full text-[#6b5844] transition-colors hover:bg-[#f3e7d5]"
          >
            <AdminIcon name="bell" className="h-[18px] w-[18px]" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-[#2a1d12]">
                {admin.name}
              </div>
              <div className="text-[11px] capitalize text-[#8a7a68]">
                {admin.roleKey}
              </div>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#2a1d12] text-[13px] font-semibold text-[#f3e7d5]">
              {initials}
            </span>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
