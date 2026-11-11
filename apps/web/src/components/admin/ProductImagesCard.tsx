"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MediaAssetRow } from "@/lib/admin/media";
import { productMediaFolder } from "@/lib/admin/media-folder";
import { MediaPicker } from "./MediaPicker";

interface ProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;
}

/**
 * Product gallery editor: lists attached images (first = primary on the
 * storefront), attaches from the Media Library (multi-select, or upload
 * straight into the product's own folder), reorders by drag-and-drop (pointer
 * or keyboard: focus a handle, Space, arrows, Space), sets primary and detaches.
 * Wired to /api/admin/products/[id]/images — mutations purge the catalog cache
 * server-side. Reorders are optimistic and roll back when the server refuses.
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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  async function attachMany(assets: { url: string; alt: string }[]): Promise<void> {
    setMsg(null);
    if (assets.length === 0) return;
    const res = await fetch(`/api/admin/products/${productId}/images`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ images: assets }),
    });
    const data = await res.json();
    if (data.ok) {
      await load();
      const skipped = Number(data.data.skipped ?? 0);
      if (skipped > 0) setMsg(`${skipped} image${skipped === 1 ? " was" : "s were"} already in the gallery.`);
    } else {
      setMsg(data.error?.message ?? "Could not attach the images.");
    }
  }

  async function onPicked(assets: { url: string; alt: string }[]): Promise<void> {
    setPicking(false);
    await attachMany(assets);
  }

  async function onUploaded(assets: MediaAssetRow[]): Promise<void> {
    setPicking(false);
    await attachMany(assets.map((a) => ({ url: a.url, alt: a.alt || a.filename })));
  }

  async function detach(imageId: string): Promise<void> {
    setMsg(null);
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

  async function persistOrder(next: ProductImage[], previous: ProductImage[]): Promise<void> {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/images/order`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: next.map((i) => i.id) }),
      });
      const data = await res.json();
      if (!data.ok) {
        setImages(previous);
        setMsg(data.error?.message ?? "Could not save the new order.");
      }
    } catch {
      setImages(previous);
      setMsg("Could not save the new order — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function onDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = images.findIndex((i) => i.id === active.id);
    const to = images.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    const previous = images;
    const next = arrayMove(images, from, to).map((img, position) => ({ ...img, position }));
    setImages(next);
    void persistOrder(next, previous);
  }

  return (
    <div className="rounded-2xl border border-[#eadbc6] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">
          Images
          {saving ? <span className="ml-2 font-normal normal-case tracking-normal text-[#b8a88f]">Saving order…</span> : null}
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="rounded-lg border border-[#e0cfb6] px-3 py-1.5 text-[12.5px] font-semibold text-[#2a1d12] transition-colors hover:bg-[#f3e7d5]"
          >
            + Add images
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
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Gallery order">
                {images.map((img, i) => (
                  <SortableTile
                    key={img.id}
                    image={img}
                    index={i}
                    canWrite={canWrite}
                    onDetach={() => void detach(img.id)}
                    onMakePrimary={() => void makePrimary(img.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {canWrite && images.length > 1 ? (
            <p className="mt-2 text-[11.5px] text-[#b8a88f]">
              Drag a tile by its handle to reorder — the first image is the storefront primary. With the
              keyboard: focus a handle, press Space, move with the arrow keys, press Space again.
            </p>
          ) : null}
        </>
      )}

      {msg !== null ? <p className="mt-2 text-[12.5px] text-[#a23c28]">{msg}</p> : null}

      {picking ? (
        <MediaPicker
          scope={{ folder: productMediaFolder(productId), label: "This product" }}
          attachedUrls={images.map((i) => i.url)}
          onPickMany={(assets) => void onPicked(assets)}
          onUploaded={onUploaded}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}

function SortableTile({
  image,
  index,
  canWrite,
  onDetach,
  onMakePrimary,
}: {
  image: ProductImage;
  index: number;
  canWrite: boolean;
  onDetach: () => void;
  onMakePrimary: () => void;
}): React.ReactNode {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.id, disabled: !canWrite });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        "group relative list-none overflow-hidden rounded-xl border bg-[#f7f1e8] " +
        (isDragging ? "z-10 border-[#c69a4c] shadow-lg" : "border-[#eadbc6]")
      }
    >
      <span className="flex aspect-square items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.alt} className="h-full w-full object-cover" loading="lazy" draggable={false} />
      </span>
      {index === 0 ? (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-[#2a1d12]/85 px-2 py-0.5 text-[10px] font-semibold text-[#f3e7d5]">
          Primary
        </span>
      ) : null}
      {canWrite ? (
        <>
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder image ${index + 1}`}
            title="Drag to reorder"
            className="absolute bottom-1.5 left-1.5 grid h-6 w-6 cursor-grab touch-none place-items-center rounded-full bg-white/90 text-[14px] leading-none text-[#5c4b3a] shadow focus:outline-none focus:ring-2 focus:ring-[#c69a4c] active:cursor-grabbing"
          >
            ⋮⋮
          </button>
          <button
            type="button"
            onClick={onDetach}
            aria-label="Remove image"
            className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[13px] font-bold text-[#a23c28] opacity-0 shadow transition-opacity focus:opacity-100 group-hover:opacity-100"
          >
            ×
          </button>
          {index !== 0 ? (
            <button
              type="button"
              onClick={onMakePrimary}
              className="absolute bottom-1.5 left-9 right-1.5 rounded-md bg-[#2a1d12]/85 px-2 py-1 text-[10px] font-semibold text-[#f3e7d5] opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
            >
              Make primary
            </button>
          ) : null}
        </>
      ) : null}
    </li>
  );
}
