import type { ReactNode } from "react";
import type { BrandIllustrations } from "../../contract";
import { KhakhraScene } from "./KhakhraScene";
import { NotFoundIllustration } from "./NotFoundIllustration";

/** The home story band's visual — the roasted stack on a lit surface. */
function Story({ label }: { label?: string }): ReactNode {
  return <KhakhraScene label={label} />;
}

/**
 * Khakhra House's decorative illustrations. Imported by their consumers
 * directly (`@brand/illustrations`), like `Mark` and `fonts`, so the pack
 * entry stays free of component modules.
 */
export const illustrations = {
  Story,
  NotFound: NotFoundIllustration,
} satisfies BrandIllustrations;
