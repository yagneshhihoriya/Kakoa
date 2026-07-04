"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Variant {
  id: string;
  sku: string;
  name: string;
  pricePaise: number;
  weightGrams: number;
  stockQuantity: number;
  isDefault: boolean;
  isActive: boolean;
}

/** Editable row = variant + a rupees string for the price input. */
interface Row extends Variant {
  priceRupees: string;
  makeDefault: boolean;
}

const INPUT =
  "w-full rounded-lg border border-[#eadbc6] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#c69a4c]";
const LABEL = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#8a7a68]";

function toRow(v: Variant): Row {
  return { ...v, priceRupees: (v.pricePaise / 100).toString(), makeDefault: false };
}

export function VariantEditor({
  productId,
  initial,
  canWrite,
}: {
  productId: string;
  initial: Variant[];
  canWrite: boolean;
}): React.ReactNode {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.map(toRow));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Resync to server truth after each save/create (useState ignores prop changes after mount).
  useEffect(() => {
    setRows(initial.map(toRow));
  }, [initial]);

  // New-variant draft.
  const [draft, setDraft] = useState({ sku: "", name: "", priceRupees: "", weightGrams: "", stockQuantity: "0" });
  const [adding, setAdding] = useState(false);

  function patchRow(id: string, next: Partial<Row>): void {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }

  async function saveRow(row: Row): Promise<void> {
    setBusyId(row.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: row.sku,
          name: row.name,
          pricePaise: Math.round(Number(row.priceRupees) * 100),
          weightGrams: Number(row.weightGrams),
          stockQuantity: Number(row.stockQuantity),
          isActive: row.isActive,
          isDefault: row.makeDefault || row.isDefault,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Save failed." });
        return;
      }
      setMsg({ kind: "ok", text: `Saved ${row.sku}.` });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusyId(null);
    }
  }

  async function addVariant(): Promise<void> {
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: draft.sku.trim(),
          name: draft.name.trim(),
          pricePaise: Math.round(Number(draft.priceRupees) * 100),
          weightGrams: Number(draft.weightGrams),
          stockQuantity: Number(draft.stockQuantity || "0"),
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Could not add the variant." });
        return;
      }
      setDraft({ sku: "", name: "", priceRupees: "", weightGrams: "", stockQuantity: "0" });
      setMsg({ kind: "ok", text: "Variant added." });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-3">
      {msg !== null ? (
        <p className={"text-[12.5px] " + (msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>
          {msg.text}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-[12.5px] text-[#8a7a68]">
          No variants yet. Add one below — a product needs an active, priced variant before it can be published.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-2 items-end gap-2 rounded-xl border border-[#f0e6d6] bg-[#fdfbf7] p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-3">
                <label className={LABEL}>SKU</label>
                <input className={INPUT} value={r.sku} disabled={!canWrite}
                  onChange={(e) => patchRow(r.id, { sku: e.target.value })} />
              </div>
              <div className="sm:col-span-3">
                <label className={LABEL}>Name</label>
                <input className={INPUT} value={r.name} disabled={!canWrite}
                  onChange={(e) => patchRow(r.id, { name: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Price ₹</label>
                <input type="number" className={INPUT} value={r.priceRupees} disabled={!canWrite}
                  onChange={(e) => patchRow(r.id, { priceRupees: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Weight g</label>
                <input type="number" className={INPUT} value={r.weightGrams} disabled={!canWrite}
                  onChange={(e) => patchRow(r.id, { weightGrams: Number(e.target.value) || 0 })} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Stock</label>
                <input type="number" className={INPUT} value={r.stockQuantity} disabled={!canWrite}
                  onChange={(e) => patchRow(r.id, { stockQuantity: Number(e.target.value) || 0 })} />
              </div>

              <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-12">
                {r.isDefault ? (
                  <span className="rounded-full bg-[#f3e7d5] px-2.5 py-1 text-[11px] font-medium text-[#8a5a34]">
                    ★ Default
                  </span>
                ) : (
                  <button type="button" disabled={!canWrite}
                    onClick={() => patchRow(r.id, { makeDefault: true })}
                    className={
                      "rounded-full px-2.5 py-1 text-[11.5px] transition-colors " +
                      (r.makeDefault
                        ? "bg-[#2a1d12] text-[#f3e7d5]"
                        : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
                    }>
                    {r.makeDefault ? "Will become default" : "Make default"}
                  </button>
                )}
                <button type="button" disabled={!canWrite}
                  onClick={() => patchRow(r.id, { isActive: !r.isActive })}
                  className={
                    "rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors " +
                    (r.isActive
                      ? "bg-[#dff0e3] text-[#3f8a54] hover:bg-[#cfe8d5]"
                      : "bg-[#ece6df] text-[#8a7a68] hover:bg-[#e2dacd]")
                  }>
                  {r.isActive ? "Active" : "Inactive"}
                </button>
                {canWrite ? (
                  <button type="button" disabled={busyId === r.id}
                    onClick={() => saveRow(r)}
                    className="ml-auto rounded-lg border border-[#eadbc6] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#2a1d12] transition-colors hover:bg-[#f3e7d5] disabled:opacity-50">
                    {busyId === r.id ? "Saving…" : "Save"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add variant */}
      {canWrite ? (
        <div className="grid grid-cols-2 items-end gap-2 rounded-xl border border-dashed border-[#e2d3bd] p-3 sm:grid-cols-12">
          <div className="sm:col-span-3">
            <label className={LABEL}>SKU</label>
            <input className={INPUT} value={draft.sku} placeholder="KK-XXX-00"
              onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))} />
          </div>
          <div className="sm:col-span-3">
            <label className={LABEL}>Name</label>
            <input className={INPUT} value={draft.name} placeholder="e.g. 100g bar"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Price ₹</label>
            <input type="number" className={INPUT} value={draft.priceRupees}
              onChange={(e) => setDraft((d) => ({ ...d, priceRupees: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Weight g</label>
            <input type="number" className={INPUT} value={draft.weightGrams}
              onChange={(e) => setDraft((d) => ({ ...d, weightGrams: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Stock</label>
            <input type="number" className={INPUT} value={draft.stockQuantity}
              onChange={(e) => setDraft((d) => ({ ...d, stockQuantity: e.target.value }))} />
          </div>
          <div className="col-span-2 sm:col-span-12">
            <button type="button" disabled={adding}
              onClick={addVariant}
              className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[13px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50">
              {adding ? "Adding…" : "Add variant"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
