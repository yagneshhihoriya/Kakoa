"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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

/** Magnification factor for the desktop hover-zoom on the main image. */
const ZOOM_SCALE = 1.8;

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
 * Lightbox overlay for the real-images branch. Portalled to <body> with the
 * codebase's shared modal contract (see ReviewComposer): role="dialog"
 * aria-modal, Escape/Tab focus-trap via a single keydown listener, body
 * scroll-lock, and focus restored to the opener on unmount. Prev/Next controls
 * + ArrowLeft/ArrowRight when there is more than one image.
 */
function Lightbox({
  images,
  index,
  name,
  onClose,
  onPrev,
  onNext,
}: {
  images: PdpGalleryImage[];
  index: number;
  name: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}): ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const multi = images.length > 1;
  const active = images[Math.min(index, images.length - 1)] ?? images[0]!;

  // Latest handlers held in a ref so the single keydown listener (whose closure
  // freezes on mount) always calls the current callbacks — the stale-closure
  // Escape bug this codebase already solved elsewhere.
  const handlers = useRef({ onClose, onPrev, onNext, multi });
  useEffect(() => {
    handlers.current = { onClose, onPrev, onNext, multi };
  }, [onClose, onPrev, onNext, multi]);

  // Escape-to-close, Arrow navigation, Tab focus-trap, body scroll lock, and
  // focus restoration. Bound once on mount.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent): void => {
      const h = handlers.current;
      if (e.key === "Escape") {
        e.preventDefault();
        h.onClose();
        return;
      }
      if (e.key === "ArrowLeft" && h.multi) {
        e.preventDefault();
        h.onPrev();
        return;
      }
      if (e.key === "ArrowRight" && h.multi) {
        e.preventDefault();
        h.onNext();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (panel === null) return;
      const nodes = panel.querySelectorAll<HTMLElement>(
        "a[href], button, textarea, input, select, [tabindex]",
      );
      const focusables = Array.from(nodes).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex >= 0 && el.offsetParent !== null,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey) {
        if (activeEl === first || !panel.contains(activeEl)) {
          e.preventDefault();
          last?.focus();
        }
      } else if (activeEl === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label={`Close ${name} image viewer`}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/80 backdrop-blur-[3px] motion-safe:animate-[kk-overlay_.2s_var(--ease-entrance)]"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 flex max-h-full w-full max-w-[min(1100px,92vw)] flex-col outline-none motion-safe:animate-[kk-rise_.28s_var(--ease-entrance)] motion-reduce:animate-none"
      >
        <h2 id={titleId} className="sr-only">
          {name} — image {Math.min(index, images.length - 1) + 1} of {images.length}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-2 right-0 z-20 flex h-11 w-11 items-center justify-center rounded-pill bg-cream/95 text-ink shadow-float transition-colors hover:bg-cream focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none sm:-top-3 sm:-right-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <div className="relative flex max-h-[82vh] w-full items-center justify-center">
            <Image
              key={active.url}
              src={active.url}
              alt={active.alt || name}
              width={1400}
              height={1400}
              sizes="(max-width: 640px) 92vw, min(1100px, 92vw)"
              className="max-h-[82vh] w-auto max-w-full rounded-[18px] object-contain shadow-float motion-safe:animate-[kk-overlay_.2s_var(--ease-entrance)] motion-reduce:animate-none"
            />
          </div>

          {multi ? (
            <>
              <button
                type="button"
                onClick={onPrev}
                aria-label={`Previous ${name} image`}
                className="absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-pill bg-cream/95 text-ink shadow-float transition-[colors,transform] duration-[var(--duration-fast)] ease-brand hover:scale-105 hover:bg-cream focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none motion-reduce:hover:scale-100 sm:left-3"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label={`Next ${name} image`}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-pill bg-cream/95 text-ink shadow-float transition-[colors,transform] duration-[var(--duration-fast)] ease-brand hover:scale-105 hover:bg-cream focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none motion-reduce:hover:scale-100 sm:right-3"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          ) : null}
        </div>

        {multi ? (
          <p className="mt-3 text-center font-mono text-[11px] font-medium tracking-[0.12em] text-cream/80 uppercase">
            {Math.min(index, images.length - 1) + 1} / {images.length}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * PDP gallery — 78px thumbnail rail beside the rounded main image. Renders the
 * product's real images when it has any (first = primary); otherwise falls back
 * to deterministic tone studies (products may ship without photography).
 *
 * For the real-images branch: the main image is a focusable control that
 * magnifies under the cursor on desktop hover (fine-pointer + reduced-motion
 * guarded) and opens an accessible lightbox on click/Enter. Selecting a
 * thumbnail crossfades the main image. The no-photo branch is unchanged.
 */
export function PdpGallery({ tone, name, images = [] }: PdpGalleryProps): ReactNode {
  const [selected, setSelected] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => setMounted(true), []);

  const hasImages = images.length > 0;
  const clampedIndex = hasImages ? Math.min(selected, images.length - 1) : 0;

  const goPrev = useCallback(() => {
    if (!hasImages) return;
    setSelected((i) => {
      const cur = Math.min(i, images.length - 1);
      return (cur - 1 + images.length) % images.length;
    });
  }, [hasImages, images.length]);

  const goNext = useCallback(() => {
    if (!hasImages) return;
    setSelected((i) => {
      const cur = Math.min(i, images.length - 1);
      return (cur + 1) % images.length;
    });
  }, [hasImages, images.length]);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  // Only magnify for a genuine mouse (fine pointer) and when motion is allowed.
  function canZoom(): boolean {
    if (typeof window === "undefined") return false;
    if (!window.matchMedia("(pointer: fine)").matches) return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return true;
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLButtonElement>): void {
    if (e.pointerType !== "mouse" || !canZoom()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    });
  }

  function handlePointerLeave(): void {
    setZoom(null);
  }

  if (hasImages) {
    const active = images[clampedIndex] ?? images[0]!;
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
                aria-pressed={clampedIndex === index}
                onClick={() => setSelected(index)}
                className={cx(
                  THUMB,
                  clampedIndex === index
                    ? "border-ink"
                    : "border-transparent opacity-90 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt={img.alt || name} fill sizes="78px" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          aria-label={`Open ${name} image, larger`}
          aria-haspopup="dialog"
          onClick={() => {
            setZoom(null);
            setLightboxOpen(true);
          }}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          className={cx(
            MAIN,
            "group block w-full p-0 [cursor:zoom-in] focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none",
            single ? "" : "order-1 md:order-none",
          )}
        >
          <Image
            key={active.url}
            src={active.url}
            alt={active.alt || name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 45vw"
            className="object-cover transition-[transform,opacity] duration-[var(--duration-base)] ease-brand will-change-transform motion-safe:animate-[kk-overlay_.28s_var(--ease-entrance)] motion-reduce:animate-none motion-reduce:transition-none"
            style={
              zoom !== null
                ? {
                    transform: `scale(${ZOOM_SCALE})`,
                    transformOrigin: `${zoom.x}% ${zoom.y}%`,
                  }
                : undefined
            }
          />
        </button>

        {/* On close the Lightbox restores focus to the element that was active
            when it mounted — this trigger button. */}
        {mounted && lightboxOpen ? (
          <Lightbox
            images={images}
            index={clampedIndex}
            name={name}
            onClose={closeLightbox}
            onPrev={goPrev}
            onNext={goNext}
          />
        ) : null}
      </div>
    );
  }

  // No photos — deterministic tone studies (prototype fallback). Unchanged.
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
