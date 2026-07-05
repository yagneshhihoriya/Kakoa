"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { renderTemplate } from "@/lib/admin/notification-catalog";

interface Template {
  key: string;
  channel: "email" | "sms";
  label: string;
  subject: string | null;
  body: string;
  isActive: boolean;
  isOverridden: boolean;
  placeholders: string[];
  updatedByEmail: string | null;
  updatedAt: string | null;
}

const SAMPLE: Record<string, string> = {
  orderNumber: "KK-TEST01",
  customerName: "Test Customer",
  trackingUrl: "https://kakoa.in/account/track?order=KK-TEST01",
  amount: "₹1,299.00",
  awb: "KKTEST12345",
  courierName: "Mock Express",
  eta: "Fri, 10 Jul",
};

const INPUT =
  "w-full rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#c69a4c]";

export function NotificationTemplateEditor({
  templates: initial,
  canManage,
}: {
  templates: Template[];
  canManage: boolean;
}): React.ReactNode {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>(initial);
  useEffect(() => setTemplates(initial), [initial]);

  const [sel, setSel] = useState(0);
  const current = templates[sel];

  const [subject, setSubject] = useState(current?.subject ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const [isActive, setIsActive] = useState(current?.isActive ?? true);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Load the selected template into the editable fields.
  useEffect(() => {
    if (!current) return;
    setSubject(current.subject ?? "");
    setBody(current.body);
    setIsActive(current.isActive);
    setMsg(null);
  }, [current]);

  const previewText = useMemo(
    () => (current ? renderTemplate(body, SAMPLE, { escapeHtml: false }) : ""),
    [body, current],
  );
  const smsLen = current?.channel === "sms" ? previewText.length : 0;

  if (!current) return <p className="text-[13px] text-[#8a7a68]">No templates.</p>;

  function appendPlaceholder(p: string): void {
    setBody((b) => `${b}{{${p}}}`);
  }

  async function save(): Promise<void> {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/notifications/templates/${current!.key}/${current!.channel}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: current!.channel === "email" ? subject : undefined, body, isActive }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Save failed." });
        return;
      }
      setMsg({ kind: "ok", text: "Saved. This override now applies to live sends." });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(null);
    }
  }

  async function sendTest(): Promise<void> {
    setBusy("test");
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/notifications/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: current!.key, channel: current!.channel, to: testTo.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: data.error?.message ?? "Test failed." });
        return;
      }
      setMsg({ kind: "ok", text: `Test ${data.data.status} to ${testTo.trim()}.` });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Template list */}
      <div className="rounded-2xl border border-[#eadbc6] bg-white p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8a7a68]">Templates</div>
        <ul className="space-y-1">
          {templates.map((t, i) => (
            <li key={`${t.key}:${t.channel}`}>
              <button
                type="button"
                onClick={() => setSel(i)}
                className={
                  "w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] " +
                  (i === sel ? "bg-[#2a1d12] text-[#f3e7d5]" : "text-[#5c4b3a] hover:bg-[#f3e7d5]")
                }
              >
                {t.label}
                <span className="ml-1.5 text-[11px] opacity-70">· {t.channel}</span>
                {t.isOverridden ? <span className="ml-1 text-[10px]">●</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Editor */}
      <div className="space-y-3 lg:col-span-2">
        <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
              {current.label} · {current.channel}
              {current.isOverridden ? <span className="ml-2 rounded-full bg-[#e6e2f6] px-2 py-0.5 text-[10px] text-[#5b4fa3]">overridden</span> : <span className="ml-2 rounded-full bg-[#ece6df] px-2 py-0.5 text-[10px] text-[#8a7a68]">default</span>}
            </div>
            <label className="flex items-center gap-1.5 text-[12px] text-[#5c4b3a]">
              <input type="checkbox" className="h-4 w-4 accent-[#2a1d12]" checked={isActive} disabled={!canManage} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          </div>

          {current.channel === "email" ? (
            <label className="mb-3 block text-[12px] text-[#5c4b3a]">
              <span className="mb-1 block font-medium">Subject</span>
              <input className={INPUT} value={subject} disabled={!canManage} onChange={(e) => setSubject(e.target.value)} />
            </label>
          ) : null}

          <label className="block text-[12px] text-[#5c4b3a]">
            <span className="mb-1 block font-medium">Body</span>
            <textarea className={INPUT + " min-h-[140px] font-mono text-[12.5px]"} value={body} disabled={!canManage} onChange={(e) => setBody(e.target.value)} />
          </label>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {current.placeholders.map((p) => (
              <button key={p} type="button" disabled={!canManage} onClick={() => appendPlaceholder(p)}
                className="rounded-full bg-[#f3e7d5] px-2 py-0.5 font-mono text-[11px] text-[#8a6d3b] hover:bg-[#ecd9be] disabled:opacity-50">
                {`{{${p}}}`}
              </button>
            ))}
          </div>

          {canManage ? (
            <div className="mt-3 flex items-center gap-2">
              <button type="button" disabled={busy !== null} onClick={save}
                className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[13px] font-semibold text-[#f3e7d5] hover:opacity-90 disabled:opacity-50">
                {busy === "save" ? "Saving…" : "Save override"}
              </button>
            </div>
          ) : null}
        </div>

        {/* Preview */}
        <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">Preview (sample data)</div>
          {current.channel === "email" ? (
            <div className="mb-1 text-[12.5px] font-semibold text-[#2a1d12]">{renderTemplate(subject, SAMPLE, { escapeHtml: false })}</div>
          ) : null}
          <pre className="whitespace-pre-wrap rounded-lg bg-[#faf6ef] p-3 text-[12.5px] text-[#3a2e22]">{previewText}</pre>
          {current.channel === "sms" ? (
            <p className={"mt-1 text-[11.5px] " + (smsLen > 160 ? "text-[#a9791f]" : "text-[#b8a88f]")}>
              {smsLen} chars{smsLen > 160 ? " · exceeds 160 (multi-part SMS billing)" : ""}
            </p>
          ) : null}
        </div>

        {/* Send test */}
        {canManage ? (
          <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">Send a test</div>
            <div className="flex flex-wrap items-center gap-2">
              <input className={INPUT + " max-w-xs"} value={testTo} placeholder={current.channel === "email" ? "you@example.com" : "+919820012345"} onChange={(e) => setTestTo(e.target.value)} />
              <button type="button" disabled={busy !== null || testTo.trim() === ""} onClick={sendTest}
                className="rounded-lg border border-[#eadbc6] bg-white px-4 py-2 text-[13px] font-semibold text-[#2a1d12] hover:bg-[#f3e7d5] disabled:opacity-50">
                {busy === "test" ? "Sending…" : "Send test"}
              </button>
            </div>
          </div>
        ) : null}

        {msg !== null ? (
          <p className={"text-[12.5px] " + (msg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>{msg.text}</p>
        ) : null}
      </div>
    </div>
  );
}
