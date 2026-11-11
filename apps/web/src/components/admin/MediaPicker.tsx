"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaAssetRow, MediaList } from "@/lib/admin/media";

/** Narrow the picker to one folder (a product's own gallery) with a tab label. */
export interface MediaPickerScope {
  folder: string;
  label: string;
}

type Tab = "scope" | "all";

interface PickerPage {
  rows: MediaAssetRow[];
  page: number;
  pageCount: number;
  total: number;
}

const EMPTY_PAGE: PickerPage = { rows: [], page: 1, pageCount: 1, total: 0 };

/**
 * Modal media picker — browse the library (search + paging) or upload on the
 * spot, then pick images. With `onPickMany` the grid is multi-select (click
 * toggles, "Add N images" confirms); with only `onPick` a click picks one, as
 * the category/settings editors expect. A `scope` adds a "This product" tab
 * that lists one folder and sends uploads there; `onUploaded` hands fresh
 * uploads straight to the caller (the product editor attaches them at once).
 * Reuses the same /api/admin/media endpoints as the standalone library.
 */
export function MediaPicker({
  onPick,
  onPickMany,
  onUploaded,
  onClose,
  scope,
  attachedUrls = [],
}: {
  onPick?: (asset: { url: string; alt: string }) => void;
  onPickMany?: (assets: { url: string; alt: string }[]) => void;
  onUploaded?: (assets: MediaAssetRow[]) => void | Promise<void>;
  onClose: () => void;
  scope?: MediaPickerScope;
  attachedUrls?: readonly string[];
}): React.ReactNode {
  const multiple = onPickMany !== undefined;
  const [tab, setTab] = useState<Tab>(scope ? "scope" : "all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<PickerPage>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, { url: string; alt: string }>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  const attached = new Set(attachedUrls);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (tab === "scope" && scope) params.set("folder", scope.folder);
    if (tab === "all" && query) params.set("search", query);
    (async () => {
      try {
        const res = await fetch(`/api/admin/media?${params.toString()}`);
        const body = await res.json();
        if (!alive) return;
        if (body.ok) {
          const list = body.data as MediaList;
          setData({ rows: list.rows, page: list.page, pageCount: list.pageCount, total: list.total });
        } else {
          setData(EMPTY_PAGE);
          setMsg(body.error?.message ?? "Could not load the library.");
        }
      } catch {
        if (alive) setMsg("Could not load the library.");
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // `refresh` is bumped after an upload so the same page re-fetches.
  }, [page, tab, query, scope, refresh]);

  // Esc cancels — the whole dialog, not just the selection.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function switchTab(next: Tab): void {
    if (next === tab) return;
    setTab(next);
    setPage(1);
  }

  function submitSearch(): void {
    setQuery(search.trim());
    setPage(1);
  }

  async function upload(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    const uploaded: MediaAssetRow[] = [];
    let failed = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      if (scope) fd.append("folder", scope.folder);
      try {
        const res = await fetch("/api/admin/media", { method: "POST", body: fd });
        const body = await res.json();
        if (body.ok) uploaded.push(body.data.asset as MediaAssetRow);
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    if (failed > 0) {
      setMsg(`${failed} upload${failed === 1 ? "" : "s"} failed (JPG/PNG/WebP/GIF/AVIF, up to 8 MB each).`);
    }
    if (uploaded.length > 0 && onUploaded) {
      await onUploaded(uploaded);
      setBusy(false);
      return;
    }
    setBusy(false);
    if (uploaded.length > 0) {
      // Show the new files where they landed, newest first.
      if (scope) setTab("scope");
      setPage(1);
      setRefresh((k) => k + 1);
    }
  }

  function choose(a: MediaAssetRow): void {
    const pick = { url: a.url, alt: a.alt || a.filename };
    if (!multiple) {
      onPick?.(pick);
      return;
    }
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(a.url)) next.delete(a.url);
      else next.set(a.url, pick);
      return next;
    });
  }

  function confirm(): void {
    if (selected.size === 0) return;
    onPickMany?.(Array.from(selected.values()));
  }

  const count = selected.size;
  const tabClass = (active: boolean): string =>
    "rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors " +
    (active ? "bg-[#2a1d12] text-[#f3e7d5]" : "text-[#8a7a68] hover:bg-[#f3e7d5] hover:text-[#2a1d12]");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2a1d12]/50 p-4 backdrop-blur-[2px]">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={multiple ? "Choose images" : "Choose an image"}
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-5 shadow-[0_30px_70px_rgba(42,29,18,.3)]"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
            {multiple ? "Choose images" : "Choose an image"}
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

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {scope ? (
            <div role="tablist" aria-label="Library scope" className="flex items-center gap-1 rounded-full bg-[#f7f1e8] p-1">
              <button type="button" role="tab" aria-selected={tab === "scope"} onClick={() => switchTab("scope")} className={tabClass(tab === "scope")}>
                {scope.label}
              </button>
              <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => switchTab("all")} className={tabClass(tab === "all")}>
                All images
              </button>
            </div>
          ) : null}
          {tab === "all" ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
            >
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by filename…"
                aria-label="Search images"
                className="min-w-0 flex-1 rounded-lg border border-[#e0cfb6] bg-white px-3 py-1.5 text-[13px] text-[#2a1d12] outline-none focus:border-[#c69a4c]"
              />
              <button type="submit" className="rounded-lg border border-[#e0cfb6] px-3 py-1.5 text-[12.5px] font-semibold text-[#2a1d12] hover:bg-[#f3e7d5]">
                Search
              </button>
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setQuery("");
                    setPage(1);
                  }}
                  className="text-[12.5px] text-[#8a7a68] hover:text-[#2a1d12]"
                >
                  Clear
                </button>
              ) : null}
            </form>
          ) : (
            <span className="text-[12px] text-[#8a7a68]">Uploads from here are kept with this product.</span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-[13px] text-[#8a7a68]">Loading…</p>
          ) : data.rows.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#8a7a68]">
              {query ? "No images match that search." : tab === "scope" ? "No images for this product yet — upload one above or browse all images." : "No images yet — upload one above."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {data.rows.map((a) => {
                const isAttached = attached.has(a.url);
                const isSelected = selected.has(a.url);
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={isAttached}
                    aria-pressed={multiple ? isSelected : undefined}
                    onClick={() => choose(a)}
                    className={
                      "group relative overflow-hidden rounded-xl border bg-[#f7f1e8] text-left transition-shadow focus:outline-none focus:ring-2 focus:ring-[#c69a4c] " +
                      (isSelected ? "border-[#c69a4c] shadow-md ring-2 ring-[#c69a4c]" : "border-[#eadbc6] hover:shadow-md") +
                      (isAttached ? " cursor-default opacity-60" : "")
                    }
                    title={a.filename}
                  >
                    <span className="flex aspect-square items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={a.alt || a.filename} className="h-full w-full object-cover" loading="lazy" />
                    </span>
                    {multiple && !isAttached ? (
                      <span
                        aria-hidden="true"
                        className={
                          "absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md border text-[12px] font-bold shadow " +
                          (isSelected ? "border-[#c69a4c] bg-[#c69a4c] text-white" : "border-[#d8c7b0] bg-white/90 text-transparent")
                        }
                      >
                        ✓
                      </span>
                    ) : null}
                    {isAttached ? (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-[#2a1d12]/85 px-2 py-0.5 text-[10px] font-semibold text-[#f3e7d5]">
                        Added
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#eadbc6] pt-3">
          <div className="flex items-center gap-2 text-[12.5px] text-[#8a7a68]">
            <button
              type="button"
              disabled={loading || data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[#e0cfb6] px-3 py-1 font-semibold text-[#2a1d12] hover:bg-[#f3e7d5] disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              Page {data.page} of {data.pageCount} · {data.total} image{data.total === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              disabled={loading || data.page >= data.pageCount}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#e0cfb6] px-3 py-1 font-semibold text-[#2a1d12] hover:bg-[#f3e7d5] disabled:opacity-40"
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-3">
            {msg !== null ? <span className="text-[12.5px] text-[#a23c28]">{msg}</span> : null}
            {multiple ? (
              <button
                type="button"
                disabled={count === 0 || busy}
                onClick={confirm}
                className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[12.5px] font-semibold text-[#f3e7d5] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {count === 0 ? "Add images" : `Add ${count} image${count === 1 ? "" : "s"}`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
