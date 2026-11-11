import type { BrandEmail } from "../contract";

/**
 * Khakhra House transactional-email chrome + ledes. Email clients cannot read
 * CSS custom properties, so the palette is literal: roasted-wheat ink on warm
 * cream, hairlines in pale wheat, and the terracotta accent that colours the
 * invoice wordmark, accent bar and grand total.
 */
export const email = {
  theme: {
    ink: "#2c1a0b",
    cream: "#fff7e6",
    muted: "#8a7254",
    line: "#eddcb8",
    card: "#ffffff",
    accent: "#b4532a",
  },
  footerTagline: "Hand-roasted in small batches",
  copy: {
    confirmation: {
      paidLede:
        "Thank you — your payment is in and your order is confirmed. We're roasting, packing and sealing it with care.",
      codLede:
        "Thank you — your order is placed. We'll confirm the details by phone shortly, then pack and seal it with care.",
    },
    fulfilment: {
      shippedLede: (brand) => `Good news — your ${brand} parcel has shipped and is heading to you.`,
      outForDeliveryLede: () =>
        "Your parcel is out for delivery today — keep your phone handy for the courier.",
      deliveredLede: (brand, unit) =>
        `Your ${brand} order has been delivered. We hope every ${unit} is as crisp as the day it was roasted.`,
    },
  },
} satisfies BrandEmail;
