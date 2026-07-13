import type { ReactNode } from "react";
import { resolveAdminContext } from "@/lib/admin/context";
import { listTemplates } from "@/lib/admin/notification-templates";
import { listNotificationLog } from "@/lib/admin/notification-log";
import { getProviderStatus } from "@/lib/admin/notification-providers";
import { NoAccess } from "@/components/admin/NoAccess";
import { NotificationTemplateEditor } from "@/components/admin/NotificationTemplateEditor";
import { StatusPill, type Tone } from "@/components/admin/StatusPill";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, Tone> = {
  sent: "success",
  failed: "danger",
  skipped: "neutral",
};

export default async function AdminNotificationsPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("notifications:read")) return <NoAccess module="Notifications" />;
  const canManage = resolved.ctx.can("notifications:manage");

  const [templates, log, providers] = await Promise.all([
    listTemplates(),
    listNotificationLog({ page: 1 }),
    Promise.resolve(getProviderStatus()),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
          Notifications
        </h1>
        <p className="text-[13px] text-[#8a7a68]">Transactional templates, delivery providers, and the send log</p>
      </div>

      {/* Providers */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <ProviderCard label="Email" name={providers.email.provider === "resend" ? "Resend" : "Fake (dev)"} live={providers.email.live} note={providers.email.live ? "Live delivery via Resend." : "Simulated — logs to the server console."} />
        <ProviderCard label="SMS" name={providers.sms.provider === "msg91" ? "MSG91" : "Fake (dev)"} live={providers.sms.live} note={providers.sms.live ? "Live delivery via MSG91." : providers.sms.note} />
      </div>

      {/* Templates + editor */}
      <NotificationTemplateEditor templates={templates} canManage={canManage} />

      {/* Send log */}
      <h2 className="mb-3 mt-8 text-[15px] font-semibold text-[#2a1d12]">Send log</h2>
      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Recipient</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Order</th>
            </tr>
          </thead>
          <tbody>
            {log.rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[#8a7a68]">No notifications sent yet.</td></tr>
            ) : (
              log.rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]">
                  <td className="px-4 py-3 text-[#5c4b3a]">{new Date(r.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 uppercase text-[#5c4b3a]">{r.channel}</td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-[#5c4b3a]">{r.templateKey}</td>
                  <td className="px-4 py-3 text-[#5c4b3a]">{r.recipient}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"} label={r.status} />
                    {r.error ? <div className="mt-0.5 text-[11px] text-[#b25b5b]">{r.error}</div> : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-[#5c4b3a]">{r.orderNumber ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProviderCard({ label, name, live, note }: { label: string; name: string; live: boolean; note: string }): ReactNode {
  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-wider text-[#8a7a68]">{label}</div>
        <StatusPill tone={live ? "success" : "neutral"} label={live ? "Live" : "Dev"} size="sm" />
      </div>
      <div className="mt-1 text-[15px] font-semibold text-[#2a1d12]">{name}</div>
      <p className="mt-0.5 text-[11.5px] text-[#b8a88f]">{note}</p>
    </div>
  );
}
