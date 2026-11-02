import type { BrandEmail } from "../contract";

/**
 * KAKOA transactional-email chrome — the ink/cream palette the templates
 * shipped with (ink #1a1a1a on cream #faf7f2), moved out of
 * lib/email/templates.ts so a pack can re-skin the mails without touching the
 * render functions.
 */
export const email = {
  theme: {
    ink: "#1a1a1a",
    cream: "#faf7f2",
    muted: "#6b6b6b",
    line: "#e6ddd1",
    card: "#ffffff",
  },
  footerTagline: "Handcrafted in small batches",
} satisfies BrandEmail;
