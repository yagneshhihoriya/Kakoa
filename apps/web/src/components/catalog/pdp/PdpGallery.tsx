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
  "relative aspect-square overflow-hidden rounded-[18px] border-2 p-0 shadow-[0_4px_12px_rgba(42,29,18,.10)] transition-colors focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none";
const MAIN =
  "relative aspect-square overflow-hidden rounded-[18px] shadow-[0_24px_60px_rgba(42,29,18,.18)]";

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
    return (
      <div className="grid grid-cols-[78px_1fr] items-start gap-4">
        {images.length > 1 ? (
          <div role="group" aria-label={`${name} gallery`} className="flex flex-col gap-3">
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
        ) : (
          <div aria-hidden="true" />
        )}
        <div className={MAIN}>
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
    <div className="grid grid-cols-[78px_1fr] items-start gap-4">
      <div role="group" aria-label={`${name} gallery`} className="flex flex-col gap-3">
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
      <div className={MAIN}>
        <ChocoPlaceholder tone={active} />
      </div>
    </div>
  );
}
