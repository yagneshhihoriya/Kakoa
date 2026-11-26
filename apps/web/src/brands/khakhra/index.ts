import { KHAKHRA } from "@kakoa/brands/khakhra";
import type { BrandPack } from "../contract";
import { copy } from "./copy";
import { email } from "./email";
import { buildFaq } from "./faq";
import { journal } from "./journal";
import { legal } from "./legal";
import { icon, og } from "./og";

/**
 * The Khakhra House pack. Fonts (`./fonts`), the logo mark (`./Mark`),
 * illustrations (`./illustrations`) and imagery (`./assets`) are imported by
 * their consumers directly so this entry stays free of next/font, component
 * and static-image side effects (client components and unit tests import it).
 */
export const brand = {
  profile: KHAKHRA,
  copy,
  faq: buildFaq,
  legal,
  journal,
  og,
  icon,
  email,
  // Every face is a Google Font under the OFL — no attribution line is owed.
  fontAttribution: null,
} satisfies BrandPack;
