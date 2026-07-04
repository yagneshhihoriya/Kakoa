"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AttributeDef } from "@platform/kernel";
import { VariantEditor } from "@/components/admin/VariantEditor";

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

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  active: boolean;
  attributes: Record<string, unknown>;
  updatedAt: string;
  variants: Variant[];
}

const LABEL = "mb-1 block text-[12.5px] font-medium text-[#5c4b3a]";
const INPUT =
  "w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#c69a4c]";

export function ProductEditForm({
  product,
  categories,
  attributeSchema,
  canWrite,
  canPublish,
}: {
  product: Product;
  categories: { id: string; name: string }[];
  attributeSchema: readonly AttributeDef[];
  canWrite: boolean;
  canPublish: boolean;
}): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [attrs, setAttrs] = useState<Record<string, unknown>>(product.attributes);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function setAttr(key: string, value: unknown): void {
    setAttrs((prev) => ({ ...prev, [key]: value }));
  }

  async function save(): Promise<void> {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          categoryId,
          attributes: attrs,
          expectedUpdatedAt: product.updatedAt,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Save failed." });
        setSaving(false);
        return;
      }
      setMsg({ kind: "ok", text: "Saved." });
      router.refresh();
      setTimeout(() => setSaving(false), 600);
    } catch {
      setMsg({ kind: "err", text: "Network error." });
      setSaving(false);
    }
  }

  async function togglePublish(): Promise<void> {
    setPublishing(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !product.active }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Failed." });
        setPublishing(false);
        return;
      }
      router.refresh();
      setTimeout(() => setPublishing(false), 600);
    } catch {
      setMsg({ kind: "err", text: "Network error." });
      setPublishing(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* Core fields */}
        <Card title="Details">
          <div className="space-y-3">
            <div>
              <label className={LABEL} htmlFor="p-name">Name</label>
              <input id="p-name" className={INPUT} value={name} disabled={!canWrite}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="p-cat">Category</label>
              <select id="p-cat" className={INPUT} value={categoryId} disabled={!canWrite}
                onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="p-desc">Description</label>
              <textarea id="p-desc" rows={4} className={INPUT} value={description} disabled={!canWrite}
                onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        </Card>

        {/* Dynamic attributes — driven ENTIRELY by the vertical preset */}
        {attributeSchema.length > 0 ? (
          <Card title="Attributes">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {attributeSchema.map((def) => (
                <AttributeField
                  key={def.key}
                  def={def}
                  value={attrs[def.key]}
                  disabled={!canWrite}
                  onChange={(v) => setAttr(def.key, v)}
                />
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-[#b8a88f]">
              These fields come from the business's product attribute schema —
              change the vertical and they change, with no code edits.
            </p>
          </Card>
        ) : null}

        {/* Variants — editable (add / edit / set default / activate) */}
        <Card title="Variants">
          <VariantEditor
            productId={product.id}
            initial={product.variants}
            canWrite={canWrite}
          />
        </Card>
      </div>

      {/* Sidebar: status + save */}
      <div className="space-y-4">
        <Card title="Status">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={
                "inline-block rounded-full px-2.5 py-1 text-[11.5px] font-medium " +
                (product.active ? "bg-[#dff0e3] text-[#3f8a54]" : "bg-[#ece6df] text-[#8a7a68]")
              }
            >
              {product.active ? "Active" : "Inactive"}
            </span>
          </div>
          {canPublish ? (
            <button
              type="button"
              disabled={publishing}
              onClick={togglePublish}
              className={
                "w-full rounded-lg px-4 py-2.5 text-[13.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 " +
                (product.active
                  ? "border border-[#e2c4c4] text-[#b25b5b]"
                  : "bg-[#2a1d12] text-[#f3e7d5]")
              }
            >
              {publishing ? "…" : product.active ? "Unpublish" : "Publish"}
            </button>
          ) : (
            <p className="text-[12px] text-[#8a7a68]">
              You don't have permission to publish.
            </p>
          )}
        </Card>

        {canWrite ? (
          <Card title="Save changes">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="w-full rounded-lg bg-[#2a1d12] px-4 py-2.5 text-[13.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {msg !== null ? (
              <p className={"mt-2 text-[12.5px] " + (msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>
                {msg.text}
              </p>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/** Renders a single attribute input from its definition. */
function AttributeField({
  def,
  value,
  disabled,
  onChange,
}: {
  def: AttributeDef;
  value: unknown;
  disabled: boolean;
  onChange: (v: unknown) => void;
}): React.ReactNode {
  const wrap = def.type === "multi-enum" || def.type === "rich" ? "sm:col-span-2" : "";
  return (
    <div className={wrap}>
      <label className={LABEL}>
        {def.label}
        {def.group ? <span className="ml-1 text-[#b8a88f]">· {def.group}</span> : null}
      </label>
      {def.type === "text" ? (
        <input className={INPUT} disabled={disabled} value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)} />
      ) : def.type === "rich" ? (
        <textarea className={INPUT} rows={3} disabled={disabled} value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)} />
      ) : def.type === "number" ? (
        <input type="number" className={INPUT} disabled={disabled}
          value={typeof value === "number" ? value : typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
      ) : def.type === "boolean" ? (
        <label className="flex items-center gap-2 text-[13px] text-[#5c4b3a]">
          <input type="checkbox" className="h-4 w-4 accent-[#2a1d12]" disabled={disabled}
            checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          Yes
        </label>
      ) : def.type === "enum" ? (
        <select className={INPUT} disabled={disabled} value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(def.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : def.type === "multi-enum" ? (
        <div className="flex flex-wrap gap-1.5">
          {(def.options ?? []).map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const on = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(on ? arr.filter((x) => x !== o) : [...arr, o])
                }
                className={
                  "rounded-full px-2.5 py-1 text-[12px] transition-colors " +
                  (on
                    ? "bg-[#2a1d12] text-[#f3e7d5]"
                    : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]") +
                  (disabled ? " opacity-50" : "")
                }
              >
                {o}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): React.ReactNode {
  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
        {title}
      </div>
      {children}
    </div>
  );
}
