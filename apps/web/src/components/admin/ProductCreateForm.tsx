"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

const LABEL = "mb-1 block text-[12.5px] font-medium text-[#5c4b3a]";
const INPUT =
  "w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#c69a4c]";

export function ProductCreateForm({
  categories,
}: {
  categories: { id: string; name: string }[];
}): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(): Promise<void> {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, categoryId, description }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error?.message ?? "Could not create the product.");
        setSaving(false);
        return;
      }
      const id = data.data?.id ?? data.id;
      // Straight into the editor to add variants + attributes, then publish.
      router.push(`/admin/products/${id}` as Route);
    } catch {
      setErr("Network error.");
      setSaving(false);
    }
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-[#eadbc6] bg-white p-5 text-[13.5px] text-[#8a7a68]">
        Create an active category first — products need one.
      </div>
    );
  }

  return (
    <div className="max-w-xl rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="space-y-3">
        <div>
          <label className={LABEL} htmlFor="np-name">Name</label>
          <input id="np-name" className={INPUT} value={name} placeholder="e.g. Single-Origin Dark 70%"
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="np-cat">Category</label>
          <select id="np-cat" className={INPUT} value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="np-desc">Description</label>
          <textarea id="np-desc" rows={4} className={INPUT} value={description}
            onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button type="button" disabled={saving} onClick={create}
            className="rounded-lg bg-[#2a1d12] px-4 py-2.5 text-[13.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50">
            {saving ? "Creating…" : "Create draft"}
          </button>
          <span className="text-[12px] text-[#8a7a68]">
            Starts as a draft — add variants next, then publish.
          </span>
        </div>
        {err !== null ? <p className="text-[12.5px] text-[#b25b5b]">{err}</p> : null}
      </div>
    </div>
  );
}
