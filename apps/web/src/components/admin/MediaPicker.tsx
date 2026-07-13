"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaAssetRow } from "@/lib/admin/media";

/**
 * Modal media picker — browse the library or upload on the spot, then pick one
 * image. Used by the product editor to attach gallery images. Reuses the same
 * /api/admin/media endpoints as the standalone library.
 */
export function MediaPicker({
  onPick,
  onClose,
}: {
  onPick: (asset: { url: string; alt: string }) => void;
  onClose: () => void;
}): React.ReactNode {
  const [assets, setAssets] = useState<MediaAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/admin/media?page=1");
      const data = await res.json();
      if (alive && data.ok) setAssets(data.data.rows as MediaAssetRow[]);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function upload(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) setAssets((prev) => [data.data.asset as MediaAssetRow, ...prev]);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2a1d12]/50 p-4 backdrop-blur-[2px]">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div role="dialog" aria-modal="true" className="relative flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-5 shadow-[0_30px_70px_rgba(42,29,18,.3)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
            Choose an image
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[12.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Upload new"}
            </button>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
            <button type="button" onClick={onClose} className="text-[13px] text-[#8a7a68] hover:text-[#2a1d12]">
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-[13px] text-[#8a7a68]">Loading…</p>
          ) : assets.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#8a7a68]">No images yet — upload one above.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onPick({ url: a.url, alt: a.alt || a.filename })}
                  className="group overflow-hidden rounded-xl border border-[#eadbc6] bg-[#f7f1e8] transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#c69a4c]"
                  title={a.filename}
                >
                  <span className="flex aspect-square items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.alt || a.filename} className="h-full w-full object-cover" loading="lazy" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
