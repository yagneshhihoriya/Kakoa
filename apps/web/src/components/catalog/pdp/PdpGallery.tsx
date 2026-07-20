"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import type { ProductTone } from "@kakoa/core";
import { PRODUCT_TONES } from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { ChocoPlaceholder } from "../ChocoPlaceholder";

export interface PdpGalleryImage {
  url: string;
  alt: string;
}

export interface PdpGalleryProps {
  /** Product's own tone — used for the placeholder studies when no images exist. */
  tone: ProductTone;
  /** Product name, used for accessible labels on the thumbnails. */
  name: string;
  /** Real product images (ordered; first = primary). Empty → tone studies. */
  images?: PdpGalleryImage[];
}

const THUMB =
  "relative aspect-square w-16 shrink-0 overflow-hidden rounded-[16px] border-2 p-0 shadow-soft transition-[colors,transform] duration-[var(--duration-fast)] ease-brand hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none md:w-auto md:rounded-[18px]";
const MAIN =
  "relative aspect-square overflow-hidden rounded-[22px] shadow-float";

/** Container: main-on-top + horizontal thumb strip on mobile; 78px side rail on desktop. */
const GALLERY_WRAP =
  "flex flex-col gap-3 md:grid md:grid-cols-[78px_1fr] md:items-start md:gap-4";
/** Thumb rail: horizontal scroll under the image on mobile, vertical column on desktop. */
const THUMB_RAIL =
  "order-2 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:order-none md:flex-col md:overflow-visible md:pb-0";

/**
 * Derive 4 gallery tones deterministically for the no-photo fallback: the
 * product's own tone first, then the next tones in enum order.
 */
function galleryTones(
  base: ProductTone,
): [ProductTone, ProductTone, ProductTone, ProductTone] {
  const start = PRODUCT_TONES.indexOf(base);
  const rotated = Array.from(
    { length: 4 },
    (_, i) => PRODUCT_TONES[(start + i) % PRODUCT_TONES.length] as ProductTone,
  );
  return rotated as [ProductTone, ProductTone, ProductTone, ProductTone];
}

/**
 * PDP gallery — 78px thumbnail rail beside the rounded main image. Renders the
 * product's real images when it has any (first = primary); otherwise falls back
 * to deterministic tone studies (products may ship without photography). Small
 * client island: the only state is which thumbnail is active.
 */
export function PdpGallery({ tone, name, images = [] }: PdpGalleryProps): ReactNode {
  const [selected, setSelected] = useState(0);

  if (images.length > 0) {
    const active = images[Math.min(selected, images.length - 1)] ?? images[0]!;
    const single = images.length <= 1;
    return (
      <div className={single ? MAIN : GALLERY_WRAP}>
        {!single ? (
          <div role="group" aria-label={`${name} gallery`} className={THUMB_RAIL}>
            {images.map((img, index) => (
              <button
                key={`${img.url}-${index}`}
                type="button"
                aria-label={`View ${name} photo ${index + 1}`}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
                className={cx(
                  THUMB,
                  selected === index ? "border-ink" : "border-transparent opacity-90 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt={img.alt || name} fill sizes="78px" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}
        <div className={cx(MAIN, single ? "" : "order-1 md:order-none")}>
          <Image
            src={active.url}
            alt={active.alt || name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 45vw"
            className="object-cover"
          />
        </div>
      </div>
    );
  }

  // No photos — deterministic tone studies (prototype fallback).
  const tones = galleryTones(tone);
  const active = tones[selected] ?? tone;
  return (
    <div className={GALLERY_WRAP}>
      <div role="group" aria-label={`${name} gallery`} className={THUMB_RAIL}>
        {tones.map((thumbTone, index) => (
          <button
            key={`${thumbTone}-${index}`}
            type="button"
            aria-label={`View ${name} photo ${index + 1}`}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
            className={cx(
              THUMB,
              selected === index ? "border-ink" : "border-transparent opacity-90 hover:opacity-100",
            )}
          >
            <ChocoPlaceholder tone={thumbTone} />
          </button>
        ))}
      </div>
      <div className={cx(MAIN, "order-1 md:order-none")}>
        <ChocoPlaceholder tone={active} />
      </div>
    </div>
  );
}
