"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Group {
  hsnCode: string;
  gstRateBp: number;
  ratePct: number;
  variantCount: number;
  inconsistent: boolean;
}

interface VariantRow {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  gstRateBp: number;
  ratePct: number;
  hsnCode: string;
  isActive: boolean;
}

const INPUT =
  "rounded-lg border border-[#eadbc6] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#c69a4c]";
const RATE_PRESETS = [0, 5, 12, 18, 28];

export function TaxGroupsTable({ groups: initial }: { groups: Group[] }): React.ReactNode {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>(initial);
  useEffect(() => setGroups(initial), [initial]);

  const [openHsn, setOpenHsn] = useState<string | null>(null);
  const [variants, setVariants] = useState<Record<string, VariantRow[]>>({});
  const [bulkRate, setBulkRate] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; kind: "ok" | "err"; text: string } | null>(null);

  async function openDrill(hsn: string): Promise<void> {
    if (openHsn === hsn) {
      setOpenHsn(null);
      return;
    }
    setOpenHsn(hsn);
    if (!variants[hsn]) {
      try {
        const res = await fetch(`/api/admin/taxes/hsn/${hsn}`);
        const data = await res.json();
        setVariants((prev) => ({ ...prev, [hsn]: (data.data?.variants ?? []) as VariantRow[] }));
      } catch {
        setVariants((prev) => ({ ...prev, [hsn]: [] }));
      }
    }
  }

  async function applyBulk(hsn: string, key: string): Promise<void> {
    const pct = Number(bulkRate[key]);
    if (!Number.isFinite(pct) || pct < 0 || pct > 28) {
      setMsg({ key, kind: "err", text: "Rate must be 0–28%." });
      return;
    }
    const gstRateBp = Math.round(pct * 100);
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/taxes/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hsnCode: hsn, gstRateBp }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ key, kind: "err", text: data.error?.message ?? "Update failed." });
        return;
      }
      setMsg({ key, kind: "ok", text: `Set HSN ${hsn} to ${pct}% (${data.data.affected} variant${data.data.affected === 1 ? "" : "s"}).` });
      setVariants((prev) => {
        const next = { ...prev };
        delete next[hsn];
        return next;
      });
      router.refresh();
    } catch {
      setMsg({ key, kind: "err", text: "Network error." });
    } finally {
      setBusy(null);
    }
  }

  async function saveVariant(v: VariantRow, ratePctStr: string, hsnStr: string): Promise<void> {
    const pct = Number(ratePctStr);
    if (!Number.isFinite(pct) || pct < 0 || pct > 28) {
      setMsg({ key: v.variantId, kind: "err", text: "Rate must be 0–28%." });
      return;
    }
    setBusy(v.variantId);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/taxes/variant/${v.variantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gstRateBp: Math.round(pct * 100), hsnCode: hsnStr.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ key: v.variantId, kind: "err", text: data.error?.message ?? "Update failed." });
        return;
      }
      setMsg({ key: v.variantId, kind: "ok", text: `${v.sku} set to ${pct}%.` });
      // Invalidate cached drill-downs (HSN may have changed).
      setVariants({});
      router.refresh();
    } catch {
      setMsg({ key: v.variantId, kind: "err", text: "Network error." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#eadbc6] bg-white">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
            <th className="px-4 py-3 font-medium">HSN</th>
            <th className="px-4 py-3 font-medium">Rate</th>
            <th className="px-4 py-3 text-right font-medium">Variants</th>
            <th className="px-4 py-3 font-medium">Set all in HSN</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-[#8a7a68]">No variants in the catalog.</td>
            </tr>
          ) : (
            groups.map((g) => {
              const key = `${g.hsnCode}:${g.gstRateBp}`;
              const rowMsg = msg?.key === key ? msg : null;
              return (
                <Fragment key={key}>
                  <tr className="border-b border-[#f3ece1] hover:bg-[#faf6ef]">
                    <td className="px-4 py-3 font-mono text-[#2a1d12]">
                      {g.hsnCode}
                      {g.inconsistent ? (
                        <span title="This HSN has more than one rate — set all to one rate." className="ml-2 rounded bg-[#f5e3c4] px-1.5 py-0.5 text-[10px] font-medium text-[#9a6b1e]">
                          ⚠ inconsistent
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#5c4b3a]">{g.ratePct}%</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#2a1d12]">{g.variantCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="28"
                          placeholder={String(g.ratePct)}
                          className={INPUT + " w-20"}
                          value={bulkRate[key] ?? ""}
                          onChange={(e) => setBulkRate((p) => ({ ...p, [key]: e.target.value }))}
                          list="tax-rate-presets"
                        />
                        <span className="text-[12px] text-[#8a7a68]">%</span>
                        <button
                          type="button"
                          disabled={busy === key}
                          onClick={() => applyBulk(g.hsnCode, key)}
                          className="rounded-lg bg-[#2a1d12] px-2.5 py-1.5 text-[12px] font-semibold text-[#f3e7d5] hover:opacity-90 disabled:opacity-50"
                        >
                          {busy === key ? "Applying…" : "Apply"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => openDrill(g.hsnCode)} className="rounded-lg border border-[#eadbc6] bg-white px-2.5 py-1.5 text-[12px] text-[#5c4b3a] hover:bg-[#f3e7d5]">
                        {openHsn === g.hsnCode ? "Hide" : "Variants"}
                      </button>
                    </td>
                  </tr>
                  {rowMsg !== null ? (
                    <tr key={`${key}-msg`}>
                      <td colSpan={5} className={"px-4 pb-2 text-[12.5px] " + (rowMsg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>{rowMsg.text}</td>
                    </tr>
                  ) : null}
                  {openHsn === g.hsnCode ? (
                    <tr key={`${key}-drill`} className="bg-[#fdfbf7]">
                      <td colSpan={5} className="px-4 py-3">
                        <VariantEditor
                          rows={variants[g.hsnCode]}
                          busy={busy}
                          msgKey={msg?.key ?? null}
                          msg={msg}
                          onSave={saveVariant}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
      <datalist id="tax-rate-presets">
        {RATE_PRESETS.map((r) => <option key={r} value={r} />)}
      </datalist>
    </div>
  );
}

function VariantEditor({
  rows,
  busy,
  msgKey,
  msg,
  onSave,
}: {
  rows: VariantRow[] | undefined;
  busy: string | null;
  msgKey: string | null;
  msg: { key: string; kind: "ok" | "err"; text: string } | null;
  onSave: (v: VariantRow, ratePct: string, hsn: string) => void;
}): React.ReactNode {
  if (rows === undefined) return <p className="text-[12.5px] text-[#8a7a68]">Loading…</p>;
  if (rows.length === 0) return <p className="text-[12.5px] text-[#8a7a68]">No variants under this HSN.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((v) => (
        <VariantEditRow key={v.variantId} v={v} busy={busy === v.variantId} msg={msgKey === v.variantId ? msg : null} onSave={onSave} />
      ))}
    </ul>
  );
}

function VariantEditRow({
  v,
  busy,
  msg,
  onSave,
}: {
  v: VariantRow;
  busy: boolean;
  msg: { kind: "ok" | "err"; text: string } | null;
  onSave: (v: VariantRow, ratePct: string, hsn: string) => void;
}): React.ReactNode {
  const [rate, setRate] = useState(String(v.ratePct));
  const [hsn, setHsn] = useState(v.hsnCode);
  useEffect(() => {
    setRate(String(v.ratePct));
    setHsn(v.hsnCode);
  }, [v.ratePct, v.hsnCode]);

  return (
    <li className="flex flex-wrap items-center gap-2 text-[12.5px]">
      <span className="min-w-[180px] text-[#2a1d12]">
        {v.productName} <span className="text-[#8a7a68]">{v.variantName}</span>
        {!v.isActive ? <span className="ml-1 rounded bg-[#ece6df] px-1 text-[10px] text-[#8a7a68]">inactive</span> : null}
      </span>
      <span className="font-mono text-[11.5px] text-[#8a7a68]">{v.sku}</span>
      <label className="ml-auto flex items-center gap-1">
        <input type="number" step="0.5" min="0" max="28" className={INPUT + " w-20"} value={rate} onChange={(e) => setRate(e.target.value)} />
        <span className="text-[#8a7a68]">%</span>
      </label>
      <label className="flex items-center gap-1">
        <span className="text-[#8a7a68]">HSN</span>
        <input className={INPUT + " w-24 font-mono"} value={hsn} onChange={(e) => setHsn(e.target.value)} />
      </label>
      <button type="button" disabled={busy} onClick={() => onSave(v, rate, hsn)} className="rounded-lg bg-[#2a1d12] px-2.5 py-1.5 text-[12px] font-semibold text-[#f3e7d5] hover:opacity-90 disabled:opacity-50">
        {busy ? "Saving…" : "Save"}
      </button>
      {msg !== null ? <span className={msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]"}>{msg.text}</span> : null}
    </li>
  );
}
