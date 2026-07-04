"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { REVIEW_STATUS_LABEL } from "@/lib/admin/review-format";

type ReviewStatus = "pending" | "approved" | "rejected";

interface Row {
  id: string;
  productId: string;
  productName: string;
  reviewerName: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  moderationNote: string | null;
  createdAt: string;
  moderatedAt: string | null;
}

const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: "bg-[#f6ecd6] text-[#a9791f]",
  approved: "bg-[#dff0e3] text-[#3f8a54]",
  rejected: "bg-[#f6e0e0] text-[#b25b5b]",
};

function Stars({ value }: { value: number }): React.ReactNode {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="text-[13px] tracking-tight text-[#c69a4c]" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(n)}
      <span className="text-[#e0d4c0]">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function ReviewQueue({ rows: initial }: { rows: Row[] }): React.ReactNode {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  useEffect(() => setRows(initial), [initial]);

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; kind: "ok" | "err"; text: string } | null>(null);

  async function moderate(row: Row, decision: "approved" | "rejected"): Promise<void> {
    setBusyId(row.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/reviews/${row.id}/moderate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: notes[row.id]?.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ id: row.id, kind: "err", text: data.error?.message ?? "Moderation failed." });
        return;
      }
      setMsg({ id: row.id, kind: "ok", text: decision === "approved" ? "Approved." : "Rejected." });
      router.refresh();
    } catch {
      setMsg({ id: row.id, kind: "err", text: "Network error." });
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d8c7b0] bg-white p-10 text-center text-[14px] text-[#8a7a68]">
        No reviews in this view.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const busy = busyId === r.id;
        const rowMsg = msg?.id === r.id ? msg : null;
        return (
          <div key={r.id} className="rounded-2xl border border-[#eadbc6] bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} />
                <span className="text-[13px] font-semibold text-[#2a1d12]">{r.productName}</span>
              </div>
              <span className={"inline-block rounded-full px-2.5 py-1 text-[11px] font-medium " + STATUS_STYLE[r.status]}>
                {REVIEW_STATUS_LABEL[r.status]}
              </span>
            </div>

            {r.title ? <div className="text-[13.5px] font-semibold text-[#2a1d12]">{r.title}</div> : null}
            <p className="mt-0.5 max-h-40 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-[#5c4b3a]">
              {r.body}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#8a7a68]">
              <span>{r.reviewerName}</span>
              <span>·</span>
              <span>{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              {r.moderatedAt ? (
                <>
                  <span>·</span>
                  <span>moderated {new Date(r.moderatedAt).toLocaleDateString("en-IN")}</span>
                </>
              ) : null}
            </div>
            {r.moderationNote ? (
              <p className="mt-1 text-[11.5px] italic text-[#b8a88f]">Note: {r.moderationNote}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[#f3ece1] pt-3">
              <label className="flex-1 text-[11.5px] text-[#5c4b3a]">
                <span className="mb-1 block font-medium">Moderation note (optional)</span>
                <input
                  className="w-full rounded-lg border border-[#eadbc6] bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#c69a4c]"
                  value={notes[r.id] ?? ""}
                  maxLength={500}
                  placeholder={r.status === "rejected" ? "e.g. off-topic / spam" : "reason (kept for the audit trail)"}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                />
              </label>
              <div className="flex gap-1.5">
                {r.status !== "approved" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => moderate(r, "approved")}
                    className="rounded-lg bg-[#3f8a54] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "…" : "Approve"}
                  </button>
                ) : null}
                {r.status !== "rejected" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => moderate(r, "rejected")}
                    className="rounded-lg bg-[#b25b5b] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "…" : "Reject"}
                  </button>
                ) : null}
              </div>
            </div>
            {rowMsg !== null ? (
              <p className={"mt-2 text-[12.5px] " + (rowMsg.kind === "ok" ? "text-[#3f8a54]" : "text-[#b25b5b]")}>{rowMsg.text}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
