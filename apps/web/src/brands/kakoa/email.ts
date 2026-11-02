import type { BrandEmail } from "../contract";

/**
 * KAKOA transactional-email chrome + ledes — the ink/cream palette the
 * templates shipped with (ink #1a1a1a on cream #faf7f2) and the opening lines
 * of each mail, moved out of lib/email/templates.ts so a pack can re-skin and
 * re-word the mails without touching the render functions.
 */
export const email = {
  theme: {
    ink: "#1a1a1a",
    cream: "#faf7f2",
    muted: "#6b6b6b",
    line: "#e6ddd1",
    card: "#ffffff",
    accent: "#8a5a34",
  },
  footerTagline: "Handcrafted in small batches",
  copy: {
    confirmation: {
      paidLede:
        "Thank you — your payment is in and your order is confirmed. We're getting it ready with care.",
      codLede:
        "Thank you — your order is placed. We'll confirm the details by phone shortly, then get it ready with care.",
    },
    fulfilment: {
      shippedLede: (brand) => `Good news — your ${brand} box has shipped and is heading to you.`,
      outForDeliveryLede: () =>
        "Your box is out for delivery today — keep your phone handy for the courier.",
      deliveredLede: (brand, unit) =>
        `Your ${brand} order has been delivered. We hope every ${unit} is a delight.`,
    },
  },
} satisfies BrandEmail;
