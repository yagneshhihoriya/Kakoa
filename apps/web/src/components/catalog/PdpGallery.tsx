"use client";

import { useState, type ReactNode } from "react";
import type { ProductTone } from "@kakoa/core";
import { PRODUCT_TONES } from "@kakoa/core";
import { cx } from "@kakoa/ui";
import { ChocoPlaceholder } from "./ChocoPlaceholder";

export interface PdpGalleryProps {
  /** Product's own tone — always the first (and default) gallery slot. */
  tone: ProductTone;
  /** Product name, used for accessible labels on the thumbnails. */
  name: string;
}

/**
 * Derive the 4 gallery tones deterministically: the product's own tone
 * first, then the next tones in enum order (prototype behavior — products
 * ship without photography in Phase 1, so the gallery is tone studies).
 */
function galleryTones(base: ProductTone): [ProductTone, ProductTone, ProductTone, ProductTone] {
  const start = PRODUCT_TONES.indexOf(base);
  const rotated = Array.from(
    { length: 4 },
    (_, i) => PRODUCT_TONES[(start + i) % PRODUCT_TONES.length] as ProductTone,
  );
  return rotated as [ProductTone, ProductTone, ProductTone, ProductTone];
}

/**
 * PDP gallery — main ChocoPlaceholder plus 4 selectable thumbnails.
 * Small client island: the only state is which thumbnail is active.
 * Dimension-locked (square main, square thumbs) so selection causes no CLS.
 */
export function PdpGallery({ tone, name }: PdpGalleryProps): ReactNode {
  const tones = galleryTones(tone);
  const [selected, setSelected] = useState(0);
  const active = tones[selected] ?? tone;

  return (
    <div className="flex flex-col gap-3">
      <ChocoPlaceholder tone={active} className="rounded-lg" />
      <div role="group" aria-label={`${name} gallery`} className="grid grid-cols-4 gap-3">
        {tones.map((thumbTone, index) => (
          <button
            key={`${thumbTone}-${index}`}
            type="button"
            aria-label={`View ${name} photo ${index + 1}`}
            aria-pressed={selected === index}
            onClick={() => {
              setSelected(index);
            }}
            className={cx(
              "overflow-hidden rounded-md transition-shadow",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              selected === index
                ? "ring-2 ring-ink ring-offset-2 ring-offset-bg"
                : "opacity-80 hover:opacity-100",
            )}
          >
            <ChocoPlaceholder tone={thumbTone} className="rounded-md" />
          </button>
        ))}
      </div>
    </div>
  );
}
