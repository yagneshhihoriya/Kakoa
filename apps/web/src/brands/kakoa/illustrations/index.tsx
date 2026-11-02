import type { ReactNode } from "react";
import type { BrandIllustrations } from "../../contract";
import { ChocoScene } from "./ChocoScene";
import { NotFoundIllustration } from "./NotFoundIllustration";

/** The home story band's visual — the prototype's "story" chocolate scene. */
function Story({ label }: { label?: string }): ReactNode {
  return <ChocoScene kind="story" label={label} />;
}

/**
 * KAKOA's decorative illustrations. Imported by their consumers directly
 * (`@brand/illustrations`), like `Mark` and `fonts`, so the pack entry stays
 * free of component modules.
 */
export const illustrations = {
  Story,
  NotFound: NotFoundIllustration,
} satisfies BrandIllustrations;
