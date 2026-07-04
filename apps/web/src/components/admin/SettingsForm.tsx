"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  settingsByGroup,
  type JsonValue,
  type SettingField,
} from "@/lib/admin/settings-schema";

type DraftValue = string | boolean;
type Draft = Record<string, DraftValue>;

interface Meta {
  updatedAt: string | null;
  updatedByEmail: string | null;
}

const LABEL = "mb-1 block text-[12.5px] font-medium text-[#5c4b3a]";
const INPUT =
  "w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#c69a4c] disabled:bg-[#f7f1e8] disabled:text-[#8a7a68]";
const HINT = "mt-1 text-[11.5px] text-[#b8a88f]";

/** Stored jsonb value → the string/boolean the widget edits. */
function toDraft(field: SettingField, value: JsonValue | undefined): DraftValue {
  if (field.type === "bool") return value === true;
  if (field.type === "int-paise") {
    const paise = typeof value === "number" ? value : Number(value ?? 0);
    return String((Number.isFinite(paise) ? paise : 0) / 100);
  }
  return value === undefined || value === null ? "" : String(value);
}

const GROUP_NOTE: Partial<Record<string, string>> = {
  "Fees & shipping":
    "Fee changes apply only to future orders — placed orders keep the fees they were charged.",
};

export function SettingsForm({
  values,
  meta,
  canWrite,
}: {
  values: Record<string, JsonValue>;
  meta: Record<string, Meta>;
  canWrite: boolean;
}): React.ReactNode {
  const router = useRouter();
  const groups = useMemo(() => settingsByGroup(), []);

  // Baseline (what's stored) drives change-detection; resynced after refresh.
  const baseline = useMemo<Draft>(() => {
    const d: Draft = {};
    for (const { fields } of groups) {
      for (const f of fields) d[f.key] = toDraft(f, values[f.key]);
    }
    return d;
  }, [groups, values]);

  const [draft, setDraft] = useState<Draft>(baseline);
  useEffect(() => setDraft(baseline), [baseline]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function set(key: string, value: DraftValue): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function buildPatch(): Record<string, JsonValue> {
    const patch: Record<string, JsonValue> = {};
    for (const { fields } of groups) {
      for (const f of fields) {
        const d = draft[f.key];
        const b = baseline[f.key];
        if (f.type === "bool") {
          if (d !== b) patch[f.key] = d === true;
        } else {
          const ds = String(d ?? "").trim();
          const bs = String(b ?? "").trim();
          if (ds !== bs) {
            patch[f.key] =
              f.type === "int-paise" || f.type === "int" ? Number(ds) : ds;
          }
        }
      }
    }
    return patch;
  }

  async function save(): Promise<void> {
    const patch = buildPatch();
    const keys = Object.keys(patch);
    if (keys.length === 0) {
      setMsg({ kind: "ok", text: "No changes to save." });
      return;
    }
    // High-impact live toggle — confirm before flipping COD availability.
    if ("cod_enabled" in patch) {
      const turningOff = patch.cod_enabled === false;
      const ok = window.confirm(
        turningOff
          ? "Turn OFF Cash on Delivery? It will immediately disappear as a checkout option storefront-wide."
          : "Turn ON Cash on Delivery? It will immediately become available at checkout.",
      );
      if (!ok) return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Save failed." });
        return;
      }
      const n = (data.data?.changed ?? keys).length;
      setMsg({ kind: "ok", text: `Saved ${n} change${n === 1 ? "" : "s"}.` });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {groups.map(({ group, fields }) => (
        <div key={group} className="rounded-2xl border border-[#eadbc6] bg-white p-5">
          <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
            {group}
          </div>
          {GROUP_NOTE[group] ? (
            <p className="mb-3 rounded-lg bg-[#f6ecd6] px-3 py-2 text-[12px] text-[#a9791f]">
              {GROUP_NOTE[group]}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <Field
                key={f.key}
                field={f}
                value={draft[f.key] ?? ""}
                meta={meta[f.key]}
                disabled={!canWrite}
                onChange={(v) => set(f.key, v)}
              />
            ))}
          </div>
        </div>
      ))}

      {canWrite ? (
        <div className="sticky bottom-4 flex items-center gap-3 rounded-2xl border border-[#eadbc6] bg-white/95 p-4 backdrop-blur">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-lg bg-[#2a1d12] px-5 py-2.5 text-[13.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {msg !== null ? (
            <span
              className={
                "text-[12.5px] " +
                (msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")
              }
            >
              {msg.text}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  field,
  value,
  meta,
  disabled,
  onChange,
}: {
  field: SettingField;
  value: DraftValue;
  meta: Meta | undefined;
  disabled: boolean;
  onChange: (v: DraftValue) => void;
}): React.ReactNode {
  const isFullWidth = field.type === "string" && (field.maxLen ?? 0) > 120;

  if (field.type === "bool") {
    return (
      <div className={isFullWidth ? "sm:col-span-2" : ""}>
        <label className="flex items-center gap-2 text-[13.5px] text-[#2a1d12]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#2a1d12]"
            checked={value === true}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
        {field.hint ? <p className={HINT}>{field.hint}</p> : null}
      </div>
    );
  }

  const isNumeric = field.type === "int-paise" || field.type === "int";

  return (
    <div className={isFullWidth ? "sm:col-span-2" : ""}>
      <label className={LABEL} htmlFor={`s-${field.key}`}>
        {field.type === "int-paise" ? `${field.label} (₹)` : field.label}
      </label>
      <input
        id={`s-${field.key}`}
        type={isNumeric ? "number" : "text"}
        inputMode={isNumeric ? "decimal" : undefined}
        min={isNumeric ? (field.min !== undefined ? field.min / (field.type === "int-paise" ? 100 : 1) : 0) : undefined}
        className={INPUT}
        value={typeof value === "boolean" ? "" : value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.hint ? <p className={HINT}>{field.hint}</p> : null}
      {meta?.updatedByEmail ? (
        <p className={HINT}>
          Last changed by {meta.updatedByEmail}
          {meta.updatedAt
            ? ` · ${new Date(meta.updatedAt).toLocaleDateString("en-IN")}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
