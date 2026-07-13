"use client";

import { useEffect, useState } from "react";
import { MediaPicker } from "./MediaPicker";

interface ProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;
}

/**
 * Product gallery editor: lists attached images (first = primary on the
 * storefront), attach from the Media Library, and detach. Wired to
 * /api/admin/products/[id]/images — mutations purge the catalog cache server-side.
 */
export function ProductImagesCard({
  productId,
  canWrite,
}: {
  productId: string;
  canWrite: boolean;
}): React.ReactNode {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load(): Promise<void> {
    const res = await fetch(`/api/admin/products/${productId}/images`);
    const data = await res.json();
    if (data.ok) setImages(data.data.images as ProductImage[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function attach(asset: { url: string; alt: string }): Promise<void> {
    setPicking(false);
    setMsg(null);
    const res = await fetch(`/api/admin/products/${productId}/images`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(asset),
    });
    const data = await res.json();
    if (data.ok) await load();
    else setMsg(data.error?.message ?? "Could not attach the image.");
  }

  async function detach(imageId: string): Promise<void> {
    const res = await fetch(`/api/admin/products/${productId}/images/${imageId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) setImages((prev) => prev.filter((i) => i.id !== imageId));
    else setMsg(data.error?.message ?? "Could not remove the image.");
  }

  async function makePrimary(imageId: string): Promise<void> {
    setMsg(null);
    const res = await fetch(`/api/admin/products/${productId}/images/${imageId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ primary: true }),
    });
    const data = await res.json();
    if (data.ok) await load();
    else setMsg(data.error?.message ?? "Could not set the primary image.");
  }

  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">Images</div>
        {canWrite ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="rounded-lg border border-[#e0cfb6] px-3 py-1.5 text-[12.5px] font-semibold text-[#2a1d12] transition-colors hover:bg-[#f3e7d5]"
          >
            + Add image
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-[13px] text-[#8a7a68]">Loading…</p>
      ) : images.length === 0 ? (
        <p className="text-[13px] text-[#8a7a68]">
          No images yet. The first image you add becomes the product's primary photo on the storefront.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={img.id} className="group relative overflow-hidden rounded-xl border border-[#eadbc6] bg-[#f7f1e8]">
              <span className="flex aspect-square items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt} className="h-full w-full object-cover" loading="lazy" />
              </span>
              {i === 0 ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-[#2a1d12]/85 px-2 py-0.5 text-[10px] font-semibold text-[#f3e7d5]">
                  Primary
                </span>
              ) : null}
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => void detach(img.id)}
                  aria-label="Remove image"
                  className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[13px] font-bold text-[#a23c28] opacity-0 shadow transition-opacity group-hover:opacity-100"
                >
                  ×
                </button>
              ) : null}
              {canWrite && i !== 0 ? (
                <button
                  type="button"
                  onClick={() => void makePrimary(img.id)}
                  className="absolute inset-x-1.5 bottom-1.5 rounded-md bg-[#2a1d12]/85 px-2 py-1 text-[10px] font-semibold text-[#f3e7d5] opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Make primary
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {msg !== null ? <p className="mt-2 text-[12.5px] text-[#a23c28]">{msg}</p> : null}

      {picking ? <MediaPicker onPick={(a) => void attach(a)} onClose={() => setPicking(false)} /> : null}
    </div>
  );
}
