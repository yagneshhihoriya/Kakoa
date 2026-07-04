"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Row {
  variantId: string;
  sku: string;
  productId: string;
  productName: string;
  variantName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  productActive: boolean;
  low: boolean;
  out: boolean;
}

interface LedgerRow {
  id: string;
  delta: number;
  reasonLabel: string;
  note: string | null;
  stockAfter: number;
  orderId: string | null;
  adminEmail: string | null;
  createdAt: string;
}

const REASONS: { value: string; label: string }[] = [
  { value: "manual_adjustment", label: "Manual adjustment" },
  { value: "stock_correction", label: "Stock correction" },
  { value: "damage_writeoff", label: "Damage / write-off" },
];

const INPUT =
  "rounded-lg border border-[#eadbc6] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#c69a4c]";

export function InventoryTable({ rows: initial, canAdjust }: { rows: Row[]; canAdjust: boolean }): React.ReactNode {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  useEffect(() => setRows(initial), [initial]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<"adjust" | "history" | null>(null);
  const [draft, setDraft] = useState<{ qty: string; reason: string; note: string }>({ qty: "", reason: "manual_adjustment", note: "" });
  const [ledger, setLedger] = useState<Record<string, LedgerRow[]>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function openAdjust(r: Row): void {
    setOpenId(r.variantId);
    setMode("adjust");
    setDraft({ qty: String(r.stockQuantity), reason: "manual_adjustment", note: "" });
    setMsg(null);
  }

  async function openHistory(r: Row): Promise<void> {
    setOpenId(r.variantId);
    setMode("history");
    setMsg(null);
    if (!ledger[r.variantId]) {
      try {
        const res = await fetch(`/api/admin/inventory/${r.variantId}/ledger`);
        const data = await res.json();
        const rowsL = (data.data?.ledger ?? data.ledger ?? []) as LedgerRow[];
        setLedger((prev) => ({ ...prev, [r.variantId]: rowsL }));
      } catch {
        setLedger((prev) => ({ ...prev, [r.variantId]: [] }));
      }
    }
  }

  function close(): void {
    setOpenId(null);
    setMode(null);
  }

  async function apply(r: Row): Promise<void> {
    const qty = Number(draft.qty);
    if (!Number.isInteger(qty) || qty < 0) {
      setMsg({ kind: "err", text: "Enter a whole number (0 or more)." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/inventory/${r.variantId}/adjust`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newQuantity: qty, reason: draft.reason, note: draft.note || undefined }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Adjustment failed." });
        return;
      }
      setMsg({ kind: "ok", text: `${r.sku} set to ${qty}.` });
      // Invalidate cached ledger for this variant so History reflects the new row.
      setLedger((prev) => {
        const next = { ...prev };
        delete next[r.variantId];
        return next;
      });
      close();
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#eadbc6] bg-white">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
            <th className="px-4 py-3 font-medium">Product / Variant</th>
            <th className="px-4 py-3 font-medium">SKU</th>
            <th className="px-4 py-3 text-right font-medium">On hand</th>
            <th className="px-4 py-3 font-medium">State</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-[#8a7a68]">No variants match this filter.</td>
            </tr>
          ) : (
            rows.map((r) => (
              <RowGroup
                key={r.variantId}
                r={r}
                canAdjust={canAdjust}
                open={openId === r.variantId ? mode : null}
                draft={draft}
                setDraft={setDraft}
                ledger={ledger[r.variantId]}
                busy={busy}
                msg={openId === r.variantId ? msg : null}
                onAdjust={() => openAdjust(r)}
                onHistory={() => openHistory(r)}
                onApply={() => apply(r)}
                onClose={close}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StockBadge({ r }: { r: Row }): React.ReactNode {
  const cls = r.out
    ? "bg-[#f6e0e0] text-[#b25b5b]"
    : r.low
      ? "bg-[#f6ecd6] text-[#a9791f]"
      : "bg-[#dff0e3] text-[#3f8a54]";
  const label = r.out ? "Out" : r.low ? "Low" : "In stock";
  return <span className={"inline-block rounded-full px-2.5 py-1 text-[11.5px] font-medium " + cls}>{label}</span>;
}

function RowGroup({
  r, canAdjust, open, draft, setDraft, ledger, busy, msg, onAdjust, onHistory, onApply, onClose,
}: {
  r: Row;
  canAdjust: boolean;
  open: "adjust" | "history" | null;
  draft: { qty: string; reason: string; note: string };
  setDraft: (d: { qty: string; reason: string; note: string }) => void;
  ledger: LedgerRow[] | undefined;
  busy: boolean;
  msg: { kind: "ok" | "err"; text: string } | null;
  onAdjust: () => void;
  onHistory: () => void;
  onApply: () => void;
  onClose: () => void;
}): React.ReactNode {
  return (
    <>
      <tr className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]">
        <td className="px-4 py-3">
          <div className="font-semibold text-[#2a1d12]">{r.productName}</div>
          <div className="text-[11.5px] text-[#8a7a68]">
            {r.variantName}
            {!r.isActive ? <span className="ml-1.5 rounded bg-[#ece6df] px-1.5 text-[10px] text-[#8a7a68]">inactive</span> : null}
          </div>
        </td>
        <td className="px-4 py-3 font-mono text-[11.5px] text-[#5c4b3a]">{r.sku}</td>
        <td className="px-4 py-3 text-right font-semibold text-[#2a1d12]">{r.stockQuantity}</td>
        <td className="px-4 py-3"><StockBadge r={r} /></td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={onHistory} className="rounded-lg border border-[#eadbc6] bg-white px-2.5 py-1.5 text-[12px] text-[#5c4b3a] hover:bg-[#f3e7d5]">
              History
            </button>
            {canAdjust ? (
              <button type="button" onClick={onAdjust} className="rounded-lg bg-[#2a1d12] px-2.5 py-1.5 text-[12px] font-semibold text-[#f3e7d5] hover:opacity-90">
                Adjust
              </button>
            ) : null}
          </div>
        </td>
      </tr>

      {open === "adjust" ? (
        <tr className="border-b border-[#f3ece1] bg-[#fdfbf7]">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[12px] text-[#5c4b3a]">
                <span className="mb-1 block font-medium">New on-hand</span>
                <input type="number" className={INPUT + " w-28"} value={draft.qty}
                  onChange={(e) => setDraft({ ...draft, qty: e.target.value })} />
              </label>
              <label className="text-[12px] text-[#5c4b3a]">
                <span className="mb-1 block font-medium">Reason</span>
                <select className={INPUT} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })}>
                  {REASONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="flex-1 text-[12px] text-[#5c4b3a]">
                <span className="mb-1 block font-medium">Note (optional)</span>
                <input className={INPUT + " w-full"} value={draft.note} placeholder="e.g. cycle count, breakage batch #12"
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              </label>
              <div className="flex gap-1.5">
                <button type="button" disabled={busy} onClick={onApply} className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[13px] font-semibold text-[#f3e7d5] hover:opacity-90 disabled:opacity-50">
                  {busy ? "Applying…" : "Apply"}
                </button>
                <button type="button" onClick={onClose} className="rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] text-[#5c4b3a] hover:bg-[#f3e7d5]">
                  Cancel
                </button>
              </div>
            </div>
            {msg !== null ? (
              <p className={"mt-2 text-[12.5px] " + (msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>{msg.text}</p>
            ) : null}
          </td>
        </tr>
      ) : null}

      {open === "history" ? (
        <tr className="border-b border-[#f3ece1] bg-[#fdfbf7]">
          <td colSpan={5} className="px-4 py-3">
            {ledger === undefined ? (
              <p className="text-[12.5px] text-[#8a7a68]">Loading…</p>
            ) : ledger.length === 0 ? (
              <p className="text-[12.5px] text-[#8a7a68]">No stock movements recorded yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {ledger.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 text-[12.5px]">
                    <span className={"font-semibold tabular-nums " + (l.delta > 0 ? "text-[#3f8a54]" : "text-[#b25b5b]")}>
                      {l.delta > 0 ? `+${l.delta}` : l.delta}
                    </span>
                    <span className="text-[#5c4b3a]">→ {l.stockAfter}</span>
                    <span className="text-[#8a7a68]">{l.reasonLabel}</span>
                    {l.note ? <span className="text-[#b8a88f]">· {l.note}</span> : null}
                    <span className="ml-auto text-[11px] text-[#b8a88f]">
                      {new Date(l.createdAt).toLocaleString("en-IN")}
                      {l.adminEmail ? ` · ${l.adminEmail}` : l.orderId ? " · order" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={onClose} className="mt-2 text-[12px] text-[#8a7a68] hover:text-[#2a1d12]">Close</button>
          </td>
        </tr>
      ) : null}
    </>
  );
}
