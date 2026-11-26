"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
 *
 * Below `lg` the rail becomes an off-canvas drawer: a fixed menu button in
 * the top-left opens it over the content with a backdrop; a nav tap, the
 * backdrop or Escape closes it. From `lg` up it is the static 248px column.
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {/* Phone/tablet: drawer toggle, pinned over the top bar's free left side. */}
      <button
        type="button"
        aria-label={drawerOpen ? "Close menu" : "Open menu"}
        aria-expanded={drawerOpen}
        aria-controls="admin-sidebar"
        onClick={() => {
          setDrawerOpen((current) => !current);
        }}
        className="fixed top-2.5 left-3 z-[60] grid h-9 w-9 place-items-center rounded-full bg-[#1b120b] text-white shadow-md transition-colors hover:bg-[#2a1d12] lg:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {drawerOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => {
            setDrawerOpen(false);
          }}
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
        />
      ) : null}
    <aside
      id="admin-sidebar"
      className={
        "fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col border-r border-black/30 bg-[#1b120b] text-white transition-transform duration-200 ease-out motion-reduce:transition-none lg:static lg:translate-x-0 " +
        (drawerOpen ? "translate-x-0" : "-translate-x-full")
      }
    >
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
                    onClick={() => {
                      setDrawerOpen(false);
                    }}
                    className={
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 " +
                      (active
                        ? "bg-[#f3e7d5] font-semibold text-[#2a1d12] shadow-sm"
                        : "text-white/65 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white motion-reduce:hover:translate-x-0")
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
    </>
  );
}
