import type { ReactNode } from "react";

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="border-b px-6 py-3 text-sm">
        <span
          className="mr-3 text-base"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          KAKAO Admin
        </span>
        <span className="opacity-60">Admin — auth pending</span>
      </header>
      {children}
    </div>
  );
}
