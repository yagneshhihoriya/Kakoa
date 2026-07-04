"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Block / unblock control for the customer detail page. Rendered only when the
 * acting admin holds `customers:block` (the route enforces it too). Display is
 * driven by the `isBlocked` prop — after a successful POST we `router.refresh()`,
 * so the server re-renders with the new flag (no local state to resync).
 */
export function CustomerBlockButton({
  customerId,
  isBlocked,
  name,
}: {
  customerId: string;
  isBlocked: boolean;
  name: string;
}): React.ReactNode {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(): Promise<void> {
    const next = !isBlocked;
    if (next) {
      const ok = window.confirm(
        `Block ${name}? They won't be able to place new orders until unblocked.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/block`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blocked: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Action failed." });
        return;
      }
      setMsg({ kind: "ok", text: next ? "Customer blocked." : "Customer unblocked." });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className={
          "rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 " +
          (isBlocked
            ? "bg-[#dff0e3] text-[#3f8a54] ring-1 ring-[#bfe0c8]"
            : "bg-[#b25b5b] text-white")
        }
      >
        {busy ? "Working…" : isBlocked ? "Unblock customer" : "Block customer"}
      </button>
      {msg !== null ? (
        <p className={"text-[12.5px] " + (msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>{msg.text}</p>
      ) : null}
    </div>
  );
}
