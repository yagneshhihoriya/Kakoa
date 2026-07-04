"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

interface PermMeta {
  key: string;
  resource: string;
  action: string;
  label: string;
  sensitive: boolean;
}

export interface RoleFormInitial {
  id?: string;
  key: string;
  name: string;
  description: string;
  permissions: string[]; // may contain '*'
  isSystem: boolean;
  isOwner: boolean;
}

const INPUT =
  "w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#c69a4c]";

export function RoleForm({
  mode,
  initial,
  groups,
  grantable,
}: {
  mode: "create" | "edit";
  initial: RoleFormInitial;
  groups: Record<string, PermMeta[]>;
  grantable: "all" | string[]; // permission keys the actor may toggle
}): React.ReactNode {
  const router = useRouter();
  const allKeys = useMemo(() => Object.values(groups).flat().map((p) => p.key), [groups]);

  // The 'owner' system role is read-only (§4.5). A '*' permission set is shown as all-checked.
  const readOnly = initial.key === "owner";
  const hasWildcard = initial.permissions.includes("*");

  const [name, setName] = useState(initial.name);
  const [key, setKey] = useState(initial.key);
  const [description, setDescription] = useState(initial.description);
  const [perms, setPerms] = useState<Set<string>>(
    new Set(hasWildcard ? allKeys : initial.permissions),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const canToggle = (permKey: string): boolean =>
    !readOnly && (grantable === "all" || grantable.includes(permKey));

  function toggle(permKey: string): void {
    if (!canToggle(permKey)) return;
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(permKey)) next.delete(permKey);
      else next.add(permKey);
      return next;
    });
  }

  async function submit(): Promise<void> {
    if (name.trim().length < 2) {
      setMsg({ kind: "err", text: "Enter a role name (2–60 characters)." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const payload = { name: name.trim(), description, permissions: [...perms] };
    try {
      const res = await fetch(
        mode === "create" ? "/api/admin/roles" : `/api/admin/roles/${initial.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(mode === "create" ? { ...payload, key: key.trim() } : payload),
        },
      );
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Save failed." });
        return;
      }
      router.push("/admin/roles" as Route);
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!window.confirm(`Delete the “${initial.name}” role? This can't be undone.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/roles/${initial.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Delete failed." });
        return;
      }
      router.push("/admin/roles" as Route);
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {readOnly ? (
        <div className="rounded-xl border border-[#eadbc6] bg-[#faf6ef] px-4 py-3 text-[12.5px] text-[#8a6d3b]">
          The Owner role has every permission (now and in future) and is protected — it can't be edited.
        </div>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-[#eadbc6] bg-white p-5 sm:grid-cols-2">
        <label className="text-[12.5px] text-[#5c4b3a]">
          <span className="mb-1 block font-medium">Name</span>
          <input className={INPUT} value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-[12.5px] text-[#5c4b3a]">
          <span className="mb-1 block font-medium">Key {mode === "edit" ? "(fixed)" : ""}</span>
          <input className={INPUT + " font-mono"} value={key} disabled={mode === "edit" || readOnly}
            placeholder="support_lead" onChange={(e) => setKey(e.target.value)} />
        </label>
        <label className="text-[12.5px] text-[#5c4b3a] sm:col-span-2">
          <span className="mb-1 block font-medium">Description</span>
          <input className={INPUT} value={description} disabled={readOnly} maxLength={200}
            onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>

      <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
        <div className="mb-3 text-[12.5px] font-semibold text-[#2a1d12]">Permissions</div>
        <div className="grid gap-5 sm:grid-cols-2">
          {Object.entries(groups).map(([resource, metas]) => (
            <div key={resource}>
              <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[#8a7a68]">{resource}</div>
              <ul className="space-y-1">
                {metas.map((p) => {
                  const disabled = !canToggle(p.key);
                  const checked = perms.has(p.key);
                  return (
                    <li key={p.key}>
                      <label className={"flex items-center gap-2 text-[13px] " + (disabled ? "text-[#b8a88f]" : "text-[#3a2e22] cursor-pointer")}>
                        <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(p.key)} />
                        <span>{p.label}</span>
                        {p.sensitive ? (
                          <span className="rounded bg-[#f6e0d2] px-1.5 text-[10px] font-medium text-[#a5623a]">sensitive</span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {grantable !== "all" && !readOnly ? (
          <p className="mt-3 text-[11.5px] text-[#b8a88f]">
            Greyed-out permissions are outside your own access — you can't grant what you don't have.
          </p>
        ) : null}
      </div>

      {msg !== null ? (
        <p className={"text-[12.5px] " + (msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>{msg.text}</p>
      ) : null}

      {!readOnly ? (
        <div className="flex items-center gap-2">
          <button type="button" disabled={busy} onClick={submit}
            className="rounded-lg bg-[#2a1d12] px-5 py-2 text-[13.5px] font-semibold text-[#f3e7d5] hover:opacity-90 disabled:opacity-50">
            {busy ? "Saving…" : mode === "create" ? "Create role" : "Save changes"}
          </button>
          {mode === "edit" && !initial.isSystem ? (
            <button type="button" disabled={busy} onClick={remove}
              className="rounded-lg border border-[#e2b8b8] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#b25b5b] hover:bg-[#f9efef] disabled:opacity-50">
              Delete role
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
