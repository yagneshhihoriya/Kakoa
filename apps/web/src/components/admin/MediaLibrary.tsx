"use client";

import { useRef, useState } from "react";
import type { MediaAssetRow, MediaList } from "@/lib/admin/media";

/** Human file size. */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Media Library grid: drag/click upload (multi), copy URL, delete. Uploads POST
 * to /api/admin/media (server validates + stores); the grid updates optimistically.
 */
export function MediaLibrary({
  initial,
  canWrite,
}: {
  initial: MediaList;
  canWrite: boolean;
}): React.ReactNode {
  const [assets, setAssets] = useState<MediaAssetRow[]>(initial.rows);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    let ok = 0;
    let failed = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/admin/media", { method: "POST", body: fd });
        const data = await res.json();
        if (data.ok) {
          setAssets((prev) => [data.data.asset as MediaAssetRow, ...prev]);
          ok += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    setMsg(
      failed === 0
        ? { kind: "ok", text: `Uploaded ${ok} file${ok === 1 ? "" : "s"}.` }
        : { kind: "err", text: `${ok} uploaded, ${failed} failed (check type/size — JPG/PNG/WebP/GIF/AVIF, ≤8 MB).` },
    );
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(id: string): Promise<void> {
    if (!window.confirm("Delete this image? It will be removed from storage.")) return;
    const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } else {
      setMsg({ kind: "err", text: data.error?.message ?? "Delete failed." });
    }
  }

  async function copyUrl(url: string): Promise<void> {
    const abs = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(abs);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div>
      {canWrite ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-[#2a1d12] px-5 py-2.5 text-[13.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload images"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void uploadFiles(e.target.files)}
          />
          <span className="text-[12px] text-[#8a7a68]">JPG, PNG, WebP, GIF, AVIF · up to 8 MB each</span>
          {msg !== null ? (
            <span className={"text-[12.5px] " + (msg.kind === "ok" ? "text-[#2f7346]" : "text-[#a23c28]")}>
              {msg.text}
            </span>
          ) : null}
        </div>
      ) : null}

      {assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8c7b0] bg-white p-12 text-center">
          <p className="text-[14px] font-semibold text-[#5c4b3a]">No media yet</p>
          <p className="mt-1 text-[13px] text-[#8a7a68]">
            {canWrite ? "Upload your first image to get started." : "Nothing has been uploaded yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-2xl border border-[#eadbc6] bg-white">
              <div className="flex aspect-square items-center justify-center bg-[#f7f1e8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.alt || a.filename} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="p-3">
                <div className="truncate text-[12.5px] font-medium text-[#2a1d12]" title={a.filename}>
                  {a.filename}
                </div>
                <div className="mt-0.5 text-[11px] text-[#8a7a68]">
                  {fmtBytes(a.sizeBytes)} · {a.mimeType.replace("image/", "").toUpperCase()}
                </div>
                <div className="mt-2 flex items-center gap-3 text-[12px]">
                  <button type="button" onClick={() => void copyUrl(a.url)} className="font-semibold text-[#345f8c] hover:underline">
                    {copied === a.url ? "Copied!" : "Copy URL"}
                  </button>
                  {canWrite ? (
                    <button type="button" onClick={() => void remove(a.id)} className="ml-auto font-semibold text-[#a23c28] hover:underline">
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
