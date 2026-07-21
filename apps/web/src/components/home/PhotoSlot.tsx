import type { ReactNode } from "react";
import Image from "next/image";

/**
 * Photo-ready presentational slot. When `src` is provided it renders a real
 * `next/image` (cover-fit, fills the positioned parent); otherwise it falls
 * back to `children` — typically a `ChocoScene`/`ChocoPlaceholder` gradient.
 *
 * The caller owns the frame (aspect-ratio, radius, clip, positioning); this
 * component only decides "real photo or art-directed placeholder", so real
 * photography can drop in later with zero markup churn.
 */
export interface PhotoSlotProps {
  /** Real photo URL. When null/undefined, the placeholder `children` render. */
  src?: string | null;
  /** Accessible alt text for the photo (ignored for the placeholder). */
  alt?: string;
  /** Responsive `sizes` hint for the fill image. */
  sizes?: string;
  /** Load eagerly with priority (use for above-the-fold hero photos). */
  priority?: boolean;
  /** Placeholder rendered when no `src` is supplied. */
  children: ReactNode;
}

export function PhotoSlot({
  src,
  alt = "",
  sizes = "(max-width: 1024px) 100vw, 50vw",
  priority = false,
  children,
}: PhotoSlotProps): ReactNode {
  if (typeof src === "string" && src !== "") {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    );
  }
  return <>{children}</>;
}
