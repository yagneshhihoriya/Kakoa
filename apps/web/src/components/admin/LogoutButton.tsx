"use client";

import { useState } from "react";

/** Posts to the admin logout route, then hard-navigates to the login page. */
export function LogoutButton(): React.ReactNode {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void fetch("/api/admin/auth/logout", { method: "POST" })
          .catch(() => {})
          .finally(() => {
            window.location.href = "/admin/login";
          });
      }}
      className="rounded-md border border-[#eadbc6] px-3 py-1.5 text-[13px] text-[#6b5844] transition-colors hover:bg-[#f3e7d5] disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
