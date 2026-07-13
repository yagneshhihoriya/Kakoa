"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { AttributeDef } from "@platform/kernel";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { ProductImagesCard } from "@/components/admin/ProductImagesCard";
import { PRODUCT_BADGES } from "@/lib/admin/product-validation";

const TONE_OPTIONS = ["dark", "milk", "caramel", "ruby", "white", "matcha"] as const;

/** Attribute keys that now have dedicated content editors — hide from the generic list. */
const CONTENT_ATTR_KEYS = new Set(["tasting_notes", "tone"]);

function recordToLines(r: Record<string, string> | null): string {
  if (r === null) return "";
  return Object.entries(r)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function linesToRecord(s: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const line of s.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k !== "" && v !== "") out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

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
  blurb: string;
  tastingNotes: string[];
  ingredients: string;
  allergens: string;
  nutritionFacts: Record<string, string> | null;
  shelfLifeDays: number | null;
  storageInstructions: string | null;
  isVeg: boolean;
  badge: string | null;
  tone: string;
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
  const [blurb, setBlurb] = useState(product.blurb);
  const [tastingNotes, setTastingNotes] = useState(product.tastingNotes.join(", "));
  const [ingredients, setIngredients] = useState(product.ingredients);
  const [allergens, setAllergens] = useState(product.allergens);
  const [nutrition, setNutrition] = useState(recordToLines(product.nutritionFacts));
  const [shelfLifeDays, setShelfLifeDays] = useState(
    product.shelfLifeDays !== null ? String(product.shelfLifeDays) : "",
  );
  const [storage, setStorage] = useState(product.storageInstructions ?? "");
  const [isVeg, setIsVeg] = useState(product.isVeg);
  const [badge, setBadge] = useState(product.badge ?? "");
  const [tone, setTone] = useState(product.tone);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
          blurb,
          tastingNotes: tastingNotes.split(",").map((s) => s.trim()).filter((s) => s !== ""),
          ingredients,
          allergens,
          nutritionFacts: linesToRecord(nutrition),
          shelfLifeDays: shelfLifeDays.trim() === "" ? null : Number(shelfLifeDays),
          storageInstructions: storage.trim() === "" ? null : storage,
          isVeg,
          badge: badge === "" ? null : badge,
          tone,
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

  async function deleteProduct(): Promise<void> {
    const ok = window.confirm(
      `Delete "${product.name}"? This permanently removes the product, its variants and images. Products with past orders can't be deleted — unpublish those instead.`,
    );
    if (!ok) return;
    setDeleting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Delete failed." });
        setDeleting(false);
        return;
      }
      router.push("/admin/products" as Route);
    } catch {
      setMsg({ kind: "err", text: "Network error." });
      setDeleting(false);
    }
  }

  const visibleAttributes = attributeSchema.filter((d) => !CONTENT_ATTR_KEYS.has(d.key));

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

        {/* Storefront content — the exact fields the product page renders. */}
        <Card title="Storefront content">
          <div className="space-y-3">
            <div>
              <label className={LABEL} htmlFor="p-blurb">Short blurb</label>
              <input id="p-blurb" className={INPUT} value={blurb} disabled={!canWrite} maxLength={300}
                onChange={(e) => setBlurb(e.target.value)} />
              <p className="mt-1 text-[11px] text-[#8a7a68]">One line shown under the product name.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="p-badge">Badge</label>
                <select id="p-badge" className={INPUT} value={badge} disabled={!canWrite}
                  onChange={(e) => setBadge(e.target.value)}>
                  <option value="">None</option>
                  {PRODUCT_BADGES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="p-tone">Tone (art direction)</label>
                <select id="p-tone" className={INPUT} value={tone} disabled={!canWrite}
                  onChange={(e) => setTone(e.target.value)}>
                  {TONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="p-notes">Tasting notes</label>
              <input id="p-notes" className={INPUT} value={tastingNotes} disabled={!canWrite}
                placeholder="Assorted truffles, Two bars, Keepsake box"
                onChange={(e) => setTastingNotes(e.target.value)} />
              <p className="mt-1 text-[11px] text-[#8a7a68]">Comma-separated chips shown on the product page.</p>
            </div>
            <div>
              <label className={LABEL} htmlFor="p-ingredients">Ingredients</label>
              <textarea id="p-ingredients" rows={3} className={INPUT} value={ingredients} disabled={!canWrite}
                onChange={(e) => setIngredients(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="p-allergens">Allergens</label>
              <input id="p-allergens" className={INPUT} value={allergens} disabled={!canWrite}
                placeholder="Contains milk, soy. May contain nuts."
                onChange={(e) => setAllergens(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="p-nutrition">Nutrition facts</label>
              <textarea id="p-nutrition" rows={4} className={INPUT} value={nutrition} disabled={!canWrite}
                placeholder={"Energy: 540 kcal\nProtein: 7 g\nSugar: 48 g"}
                onChange={(e) => setNutrition(e.target.value)} />
              <p className="mt-1 text-[11px] text-[#8a7a68]">One per line as “Label: Value”.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="p-shelf">Shelf life (days)</label>
                <input id="p-shelf" type="number" min={1} className={INPUT} value={shelfLifeDays} disabled={!canWrite}
                  onChange={(e) => setShelfLifeDays(e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="p-storage">Storage</label>
                <input id="p-storage" className={INPUT} value={storage} disabled={!canWrite}
                  placeholder="Store below 18°C, away from sunlight"
                  onChange={(e) => setStorage(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-[#5c4b3a]">
              <input type="checkbox" className="h-4 w-4 accent-[#2a1d12]" checked={isVeg} disabled={!canWrite}
                onChange={(e) => setIsVeg(e.target.checked)} />
              Vegetarian (green FSSAI mark)
            </label>
          </div>
        </Card>

        {/* Dynamic attributes — driven ENTIRELY by the vertical preset */}
        {visibleAttributes.length > 0 ? (
          <Card title="Attributes">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visibleAttributes.map((def) => (
                <AttributeField
                  key={def.key}
                  def={def}
                  value={attrs[def.key]}
                  disabled={!canWrite}
                  onChange={(v) => setAttr(def.key, v)}
                />
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-[#8a7a68]">
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

        {/* Images — attach from the Media Library (first = storefront primary) */}
        <ProductImagesCard productId={product.id} canWrite={canWrite} />
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

        {canWrite ? (
          <Card title="Danger zone">
            <button
              type="button"
              disabled={deleting}
              onClick={deleteProduct}
              className="w-full rounded-lg border border-[#e2c4c4] px-4 py-2.5 text-[13.5px] font-semibold text-[#b25b5b] transition-colors hover:bg-[#f6dede] disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete product"}
            </button>
            <p className="mt-2 text-[11.5px] text-[#8a7a68]">
              Permanently removes the product, its variants and images. Products with
              past orders can't be deleted — unpublish them instead.
            </p>
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
