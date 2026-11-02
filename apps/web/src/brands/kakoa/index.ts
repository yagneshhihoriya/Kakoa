import { KAKOA } from "@kakoa/brands/kakoa";
import type { BrandPack } from "../contract";
import { copy } from "./copy";
import { icon, og } from "./og";

/**
 * The KAKOA pack. Fonts (`./fonts`), the logo mark (`./Mark`) and imagery
 * (`./assets`) are imported by their consumers directly so this entry stays
 * free of next/font and static-image side effects (client components and unit
 * tests import it).
 */
export const brand = {
  profile: KAKOA,
  copy,
  og,
  icon,
  // Infini is CC BY-ND 3.0 — attribution is a licence condition, rendered in
  // the footer legal bar (see fonts.ts).
  fontAttribution: {
    text: "Typeset in Infini by Sandrine Nugue (CNAP), CC BY-ND 3.0",
    href: "https://creativecommons.org/licenses/by-nd/3.0/",
  },
} satisfies BrandPack;
