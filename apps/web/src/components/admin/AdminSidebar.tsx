"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AdminIcon } from "./icons";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: string | null;
}
export interface SidebarSection {
  label: string;
  items: SidebarNavItem[];
}

/**
 * Admin sidebar — registry-driven, with icons, section headers and an
 * active-route pill. Client component (needs `usePathname` for the active
 * state); the nav data is composed server-side from the module registry.
 */
export function AdminSidebar({
  business,
  sections,
}: {
  business: { name: string; vertical: string };
  sections: SidebarSection[];
}): React.ReactNode {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="flex w-[248px] flex-col border-r border-black/30 bg-[#1b120b] text-white">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-[18px]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#c69a4c] to-[#8a5a34] text-[15px] font-bold text-[#1b120b]">
          {business.name.charAt(0)}
        </span>
        <span>
          <span
            className="block text-[15px] leading-none text-white"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {business.name}
          </span>
          <span className="block text-[10px] uppercase tracking-[0.14em] text-white/35">
            Admin · {business.vertical}
          </span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {sections.map((section) => (
          <div key={section.label} className="mb-1.5">
            <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/30">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    aria-current={active ? "page" : undefined}
                    className={
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors " +
                      (active
                        ? "bg-[#f3e7d5] font-semibold text-[#2a1d12] shadow-sm"
                        : "text-white/65 hover:bg-white/[0.07] hover:text-white")
                    }
                  >
                    <AdminIcon
                      name={item.icon}
                      className={
                        "h-[17px] w-[17px] shrink-0 " +
                        (active ? "text-[#8a5a34]" : "text-white/45")
                      }
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void fetch("/api/admin/auth/logout", { method: "POST" })
              .catch(() => {})
              .finally(() => {
                window.location.href = "/admin/login";
              });
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
        >
          <AdminIcon name="logout" className="h-[17px] w-[17px] text-white/45" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
