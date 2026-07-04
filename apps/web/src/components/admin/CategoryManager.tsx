"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  active: boolean;
  productCount: number;
}

const INPUT =
  "w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#c69a4c]";

export function CategoryManager({ initial }: { initial: Category[] }): React.ReactNode {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Local editable copy so inline edits feel instant; the server list is the truth on refresh.
  const [rows, setRows] = useState<Category[]>(initial);
  // Resync to server truth whenever a create/save triggers router.refresh() and
  // sends a fresh `initial` — useState alone ignores prop changes after mount.
  useEffect(() => {
    setRows(initial);
  }, [initial]);

  function patchRow(id: string, next: Partial<Category>): void {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }

  async function create(): Promise<void> {
    const name = newName.trim();
    if (name.length < 2) {
      setMsg({ kind: "err", text: "Enter a category name (2–60 characters)." });
      return;
    }
    setCreating(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Could not create the category." });
        return;
      }
      setNewName("");
      setMsg({ kind: "ok", text: "Category created." });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setCreating(false);
    }
  }

  async function save(row: Category): Promise<void> {
    setBusyId(row.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/categories/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: row.name,
          description: row.description ?? undefined,
          position: row.position,
          active: row.active,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Save failed." });
        return;
      }
      setMsg({ kind: "ok", text: `Saved “${row.name}”.` });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Create */}
      <div className="rounded-2xl border border-[#eadbc6] bg-white p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[12.5px] font-medium text-[#5c4b3a]" htmlFor="new-cat">
              New category
            </label>
            <input
              id="new-cat"
              className={INPUT}
              value={newName}
              placeholder="e.g. Signature Collection"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
            />
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={create}
            className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[13.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {msg !== null ? (
        <p className={"text-[12.5px] " + (msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>
          {msg.text}
        </p>
      ) : null}

      {/* List */}
      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[680px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Products</th>
              <th className="w-20 px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#8a7a68]">
                  No categories yet. Add your first above.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-[#f3ece1] last:border-0">
                  <td className="px-4 py-2.5">
                    <input
                      className={INPUT}
                      value={c.name}
                      onChange={(e) => patchRow(c.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11.5px] text-[#8a7a68]">{c.slug}</td>
                  <td className="px-4 py-2.5 text-[#5c4b3a]">{c.productCount}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      className={INPUT}
                      value={c.position}
                      onChange={(e) => patchRow(c.id, { position: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => patchRow(c.id, { active: !c.active })}
                      className={
                        "inline-block rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors " +
                        (c.active
                          ? "bg-[#dff0e3] text-[#3f8a54] hover:bg-[#cfe8d5]"
                          : "bg-[#ece6df] text-[#8a7a68] hover:bg-[#e2dacd]")
                      }
                    >
                      {c.active ? "Active" : "Archived"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => save(c)}
                      className="rounded-lg border border-[#eadbc6] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#2a1d12] transition-colors hover:bg-[#f3e7d5] disabled:opacity-50"
                    >
                      {busyId === c.id ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-[#b8a88f]">
        Archiving a category hides it from the storefront but keeps its products.
        Re-order with the Order column (lower shows first).
      </p>
    </div>
  );
}
