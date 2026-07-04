import type { ReactNode } from "react";
import { resolveAdminContext } from "@/lib/admin/context";
import { adminRegistry } from "@/lib/admin/modules";
import { AdminIcon } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

/** Presentation for each dashboard widget slot (label + icon + badge tint). */
const WIDGET_META: Record<
  string,
  { label: string; icon: string; badge: string }
> = {
  revenue: { label: "Revenue", icon: "wallet", badge: "bg-[#f6e6c9] text-[#a9772f]" },
  "orders-today": { label: "Orders today", icon: "receipt", badge: "bg-[#dfeaf6] text-[#3f6fa3]" },
  "low-stock": { label: "Low stock", icon: "layers", badge: "bg-[#f6dede] text-[#b25b5b]" },
};

/**
 * Admin dashboard (Phase 0C shell). The real metrics land in Phase 1; for now
 * this confirms the whole chain works: session → BusinessContext → registry →
 * permission-filtered surface. Widget slots reflect the acting admin's grants.
 */
export default async function AdminDashboardPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null; // the shell layout already redirects
  const { admin, ctx } = resolved;
  const composed = adminRegistry.compose(ctx);

  return (
    <div className="mx-auto max-w-4xl">
      <h1
        className="mb-1 text-[26px] text-[#2a1d12]"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Welcome, {admin.name.split(" ")[0]}
      </h1>
      <p className="mb-6 text-[14px] text-[#6b5844]">
        You're signed in to the {ctx.profile.name} admin as{" "}
        <span className="font-semibold">{admin.roleKey}</span>.
      </p>

      {/* Widget slots (real metrics arrive in Phase 1) */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {composed.widgets.length === 0 ? (
          <p className="text-[13px] text-[#8a7a68]">
            No dashboard widgets available for your role.
          </p>
        ) : (
          composed.widgets.map((w) => {
            const meta = WIDGET_META[w.key] ?? {
              label: w.key.replace(/-/g, " "),
              icon: "chart",
              badge: "bg-[#f3e7d5] text-[#8a5a34]",
            };
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
                  —
                </div>
                <div className="text-[11.5px] text-[#b8a88f]">
                  metric arrives in Phase 1
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-xl border border-[#eadbc6] bg-white p-5">
        <div className="mb-2 text-[13px] font-semibold text-[#2a1d12]">
          Enabled modules ({composed.modules.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {composed.modules.map((m) => (
            <span
              key={m.key}
              className="rounded-full bg-[#f3e7d5] px-3 py-1 text-[12px] text-[#5c4b3a]"
            >
              {m.title}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] text-[#8a7a68]">
          This is the platform shell. Each module's screens are built in Phase 1
          onward — the nav, permissions and capability-gating you see here are
          fully driven by the module registry and your role.
        </p>
      </div>
    </div>
  );
}
