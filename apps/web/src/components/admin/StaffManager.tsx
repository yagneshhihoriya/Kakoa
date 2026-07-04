"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  email: string;
  name: string;
  roleKey: string;
  roleName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface RoleOption {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissionCount: number | "all";
  assignable: boolean;
}

const INPUT =
  "rounded-lg border border-[#eadbc6] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#c69a4c]";

export function StaffManager({
  initial,
  roles,
  selfId,
}: {
  initial: Row[];
  roles: RoleOption[];
  selfId: string;
}): React.ReactNode {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  useEffect(() => setRows(initial), [initial]);

  // roleId per row currently selected (keyed by admin id); seeded from the row's role.
  const roleByKey = new Map(roles.map((r) => [r.key, r.id]));
  const [draftRole, setDraftRole] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; kind: "ok" | "err"; text: string } | null>(null);

  const assignable = roles.filter((r) => r.assignable);
  const [invite, setInvite] = useState({ email: "", name: "", roleId: assignable[0]?.id ?? "" });
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function currentRoleId(r: Row): string {
    return draftRole[r.id] ?? roleByKey.get(r.roleKey) ?? "";
  }

  async function submitInvite(): Promise<void> {
    if (!invite.email.trim() || !invite.name.trim() || !invite.roleId) {
      setInviteMsg({ kind: "err", text: "Email, name and role are required." });
      return;
    }
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(invite),
      });
      const data = await res.json();
      if (!data.ok) {
        setInviteMsg({ kind: "err", text: data.error?.message ?? "Could not invite the admin." });
        return;
      }
      setInviteMsg({ kind: "ok", text: `Invited ${invite.email}. They can sign in with an email OTP.` });
      setInvite({ email: "", name: "", roleId: assignable[0]?.id ?? "" });
      router.refresh();
    } catch {
      setInviteMsg({ kind: "err", text: "Network error." });
    } finally {
      setInviting(false);
    }
  }

  async function save(r: Row, patch: { roleId?: string; isActive?: boolean }): Promise<void> {
    setBusyId(r.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/staff/${r.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ id: r.id, kind: "err", text: data.error?.message ?? "Save failed." });
        return;
      }
      setMsg({ id: r.id, kind: "ok", text: "Saved. Role/deactivation changes sign the admin out." });
      router.refresh();
    } catch {
      setMsg({ id: r.id, kind: "err", text: "Network error." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Invite */}
      <div className="rounded-2xl border border-[#eadbc6] bg-white p-4">
        <div className="mb-2 text-[12.5px] font-semibold text-[#2a1d12]">Invite an admin</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[12px] text-[#5c4b3a]">
            <span className="mb-1 block font-medium">Email</span>
            <input className={INPUT + " w-56"} type="email" value={invite.email} placeholder="name@kakoa.in"
              onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          </label>
          <label className="text-[12px] text-[#5c4b3a]">
            <span className="mb-1 block font-medium">Name</span>
            <input className={INPUT + " w-44"} value={invite.name} placeholder="Full name"
              onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
          </label>
          <label className="text-[12px] text-[#5c4b3a]">
            <span className="mb-1 block font-medium">Role</span>
            <select className={INPUT} value={invite.roleId} onChange={(e) => setInvite({ ...invite, roleId: e.target.value })}>
              {assignable.length === 0 ? <option value="">No assignable roles</option> : null}
              {assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <button type="button" disabled={inviting || assignable.length === 0} onClick={submitInvite}
            className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[13px] font-semibold text-[#f3e7d5] hover:opacity-90 disabled:opacity-50">
            {inviting ? "Inviting…" : "+ Invite admin"}
          </button>
        </div>
        {inviteMsg !== null ? (
          <p className={"mt-2 text-[12.5px] " + (inviteMsg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>{inviteMsg.text}</p>
        ) : null}
      </div>

      {/* List */}
      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">Name / Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[#8a7a68]">No admins match this filter.</td></tr>
            ) : (
              rows.map((r) => {
                const isSelf = r.id === selfId;
                const sel = currentRoleId(r);
                const roleChanged = sel !== "" && sel !== roleByKey.get(r.roleKey);
                return (
                  <tr key={r.id} className="border-b border-[#f3ece1] last:border-0 align-top hover:bg-[#faf6ef]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#2a1d12]">
                        {r.name}
                        {isSelf ? <span className="ml-1.5 rounded bg-[#f3e7d5] px-1.5 text-[10px] text-[#8a6d3b]">you</span> : null}
                      </div>
                      <div className="text-[11.5px] text-[#8a7a68]">{r.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className={INPUT}
                        value={sel}
                        disabled={isSelf}
                        onChange={(e) => setDraftRole((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      >
                        {/* current role always present (may be non-assignable → shown, disabled) */}
                        {roles.map((ro) => (
                          <option key={ro.id} value={ro.id} disabled={!ro.assignable && ro.id !== roleByKey.get(r.roleKey)}>
                            {ro.name}{ro.assignable ? "" : " (locked)"}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-[#5c4b3a]">
                      {r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={isSelf || busyId === r.id}
                        onClick={() => save(r, { isActive: !r.isActive })}
                        title={isSelf ? "You can't change your own active status" : undefined}
                        className={
                          "inline-block rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-60 " +
                          (r.isActive
                            ? "bg-[#dff0e3] text-[#3f8a54] hover:bg-[#cfe8d5]"
                            : "bg-[#ece6df] text-[#8a7a68] hover:bg-[#e2dacd]")
                        }
                      >
                        {r.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busyId === r.id || isSelf || !roleChanged}
                        onClick={() => save(r, { roleId: sel })}
                        className="rounded-lg border border-[#eadbc6] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#2a1d12] hover:bg-[#f3e7d5] disabled:opacity-50"
                      >
                        {busyId === r.id ? "Saving…" : "Save role"}
                      </button>
                      {msg?.id === r.id ? (
                        <p className={"mt-1 text-[11.5px] " + (msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>{msg.text}</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-[#b8a88f]">
        You can only assign roles within your own access. Changing a role or deactivating an admin
        signs them out immediately. You can't deactivate or demote yourself, or remove the last owner.
      </p>
    </div>
  );
}
