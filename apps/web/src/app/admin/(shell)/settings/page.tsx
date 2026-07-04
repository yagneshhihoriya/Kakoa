import type { ReactNode } from "react";
import { resolveAdminContext } from "@/lib/admin/context";
import { getAllSettings } from "@/lib/admin/settings";
import { NoAccess } from "@/components/admin/NoAccess";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("settings:read")) return <NoAccess module="Settings" />;

  const settings = await getAllSettings();
  const canWrite = resolved.ctx.can("settings:write");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1
          className="text-[24px] text-[#2a1d12]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Settings
        </h1>
        <p className="text-[13px] text-[#8a7a68]">
          Store configuration — fees, COD, and the legal identity printed on invoices.
          {canWrite ? "" : " You have read-only access."}
        </p>
      </div>

      <SettingsForm
        values={settings.values}
        meta={settings.meta}
        canWrite={canWrite}
      />
    </div>
  );
}
