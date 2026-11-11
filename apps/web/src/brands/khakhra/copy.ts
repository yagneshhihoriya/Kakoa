import type { StorefrontCopy } from "../contract";

/**
 * Khakhra House storefront copy — every sentence the pages render (home,
 * about, help centre, journal shell, shop metadata, error boundaries, 404,
 * cart, footer, newsletter, notification defaults). The pages own layout and
 * behaviour; this file owns the words. Khakhra House is the snacks brand, so
 * the khakhra nouns are written out here rather than interpolated.
 *
 * Claims are kept generic and true for every pack the brand sells: hand-roasted
 * in small batches, shelf-stable and shipped at room temperature, made in an
 * FSSAI-licensed kitchen. Nothing here promises a cold chain, a specific flour
 * or a specific farm.
 */
export const copy = {
  titleTagline: "Hand-Roasted Khakhra",
  invoiceTagline: "Hand-roasted khakhra",

  home: {
    hero: {
      eyebrow: "Hand-roasted · Small batches",
      headline: (productName) =>
        productName !== null ? `${productName}: roasted this week.` : "Thin, crisp and roasted by hand.",
      body: "Khakhra the way it is made at home — kneaded, rolled thin and roasted slowly on the tava until it crackles. Sealed the same day and shipped crisp, anywhere in India.",
      cta: (productName) => (productName !== null ? `Try ${productName}` : "Shop the range"),
    },
    marqueeWords: [
      "Hand-roasted",
      "Small batches",
      "Rolled thin",
      "Slow tava roast",
      "Sealed the same day",
      "Ships crisp",
      "Made in India",
    ],
    trust: {
      ariaLabel: "The Khakhra House promise",
      signals: [
        {
          icon: "flame",
          title: "Hand-roasted in small batches",
          body: "Rolled and roasted by hand on the tava, a few dozen at a time — never a factory line.",
        },
        {
          icon: "box",
          title: "Shelf-stable, ships anywhere in India",
          body: "Sealed packs in a rigid carton, at room temperature — nothing to chill, nothing to rush.",
        },
        {
          icon: "shield",
          title: "FSSAI-licensed kitchen",
          body: "Made in a licensed kitchen, with ingredients and allergens declared on every pack.",
        },
      ],
    },
    collections: {
      eyebrow: "Shop by range",
      title: "Find your flavour",
    },
    bestSellers: {
      eyebrow: "Loved by many",
      title: "Best sellers",
      viewAll: "View all",
      emptyTitle: "The first batch is still on the tava",
      emptyBody: "New khakhra lands here soon — check back shortly.",
      emptyCta: { label: "Browse the shop", href: "/shop" },
    },
    story: {
      eyebrow: "Our story",
      title: ["Rolled thin,", "roasted slow."],
      body: "We started Khakhra House with one rule: make it the way it is made at home. Dough kneaded by hand, rolled thin, roasted slowly on the tava and pressed until it crackles — then sealed while it is still crisp.",
      stats: [
        { value: "6", label: "Flavours" },
        { value: "90", label: "Days of crispness" },
        { value: "Small", label: "Batch sizes" },
      ],
      cta: { label: "Read our story", href: "/about" },
      photoAlt: "Inside the Khakhra House small-batch kitchen",
      photoLabel: "Small-batch kitchen",
    },
    process: {
      eyebrow: "The craft",
      title: "Four steps, from dough to crackle.",
      steps: [
        {
          step: "01",
          title: "Knead",
          body: "Flour, oil, salt and the spices of the day, kneaded by hand into a firm, even dough.",
        },
        {
          step: "02",
          title: "Roll",
          body: "Each round is rolled paper-thin — thin enough to see the board through it.",
        },
        {
          step: "03",
          title: "Roast",
          body: "Roasted slowly on the tava and pressed with a cloth pad until the blisters rise and it turns crisp.",
        },
        {
          step: "04",
          title: "Pack",
          body: "Cooled, stacked and sealed the same day so the crackle survives the journey.",
        },
      ],
    },
    gifting: {
      eyebrow: "Made for gifting",
      title: ["A box that travels", "as well as it tastes."],
      body: "Assorted khakhra, packed and ready to give — with a handwritten note and room-temperature delivery anywhere in India.",
      cta: { label: "Shop gift packs", href: "/shop?category=gift-packs" },
      features: [
        {
          icon: "wrap",
          title: "Wrapped, ready to gift",
          body: "Every gift pack arrives in signature packaging — gifting-ready, straight out of the carton.",
        },
        {
          icon: "note",
          title: "Add a handwritten note",
          body: "Write a personal message at checkout and we tuck it in by hand.",
        },
        {
          icon: "truck",
          title: "Ships crisp, across India",
          body: "Sealed packs in a rigid carton keep every khakhra whole — door to door, no refrigeration needed.",
        },
      ],
    },
  },

  about: {
    metaDescription:
      "How Khakhra House makes khakhra by hand in India — kneaded, rolled thin and roasted slowly in small batches, sealed the same day and shipped crisp anywhere in the country.",
    hero: {
      eyebrow: "Our story",
      headlineLead: ["Khakhra should taste", "like it was"],
      headlineEmphasis: "roasted at home.",
      body: "We started Khakhra House in a small kitchen with one conviction: that a khakhra should crackle the way it does when someone roasts it for you at home. Every round is kneaded, rolled and roasted by hand, in small batches — nothing rushed, nothing hidden.",
      photo: {
        label: "Our kitchen",
        alt: "Inside the Khakhra House small-batch kitchen",
        from: "from-cocoa",
        to: "to-ink",
      },
    },
    // Ingredients → craft → delivery: alternating image/text bands.
    bands: [
      {
        eyebrow: "Where it begins",
        title: "A short list of ingredients, and time.",
        body: [
          "Khakhra needs very little: flour, a little oil, salt, and whatever the flavour calls for — methi leaves, jeera, pudina, a house masala. We keep the list short and print all of it on the pack, allergens included.",
          "What it needs most is time. A dough that rests properly rolls thinner, and a round that is roasted slowly crisps all the way through instead of browning on the outside.",
        ],
        photo: {
          label: "Ingredients",
          alt: "Flour, spices and fresh methi for khakhra dough",
          from: "from-cocoa",
          to: "to-espresso",
        },
        flip: false,
      },
      {
        eyebrow: "In our kitchen",
        title: "Rolled thin and roasted by hand.",
        body: [
          "Everything happens in our own small-batch kitchen. Each round is rolled paper-thin by hand, then roasted on the tava and pressed with a cloth pad until the blisters rise and the whole disc turns crisp.",
          "A few dozen at a time, batch after batch. It is slower than a machine line, and it tastes like it.",
        ],
        photo: {
          label: "Small-batch kitchen",
          alt: "Khakhra being pressed on a tava in the Khakhra House kitchen",
          from: "from-espresso",
          to: "to-ink",
        },
        flip: true,
      },
      {
        eyebrow: "To your door",
        title: "Sealed the same day, shipped crisp.",
        body: [
          "A good khakhra deserves to arrive whole. Every batch is cooled, stacked and sealed the same day it is roasted, then packed in a rigid carton with cushioning — at room temperature, anywhere in India.",
          "Gift packs arrive ready to give, and you can add a handwritten note at checkout, tucked in by hand, so a gift feels like one.",
        ],
        photo: {
          label: "Packed to travel",
          alt: "Sealed Khakhra House packs in a gifting-ready carton",
          from: "from-cocoa-deep",
          to: "to-plum",
        },
        flip: false,
      },
    ],
    stats: {
      ariaLabel: "Khakhra House by the numbers",
      items: [
        { value: "6", label: "Flavours" },
        { value: "90", label: "Days of crispness" },
        { value: "Small", label: "Batch sizes" },
      ],
    },
    jsonLd: {
      pageDescription: "How Khakhra House makes khakhra by hand, in small batches, in India.",
      organizationDescription:
        "Hand-roasted khakhra made in small batches in India. Plain, methi, masala, jeera, pudina and multigrain, sealed the same day and shipped at room temperature across the country.",
    },
    quote: {
      text: "We’d rather roast a few dozen rounds properly than a few thousand quickly. Every pack leaves our kitchen as crisp as we’d want it on our own table.",
      attribution: "The Khakhra House Kitchen",
    },
    closing: {
      eyebrow: "Taste the difference",
      title: "Thin, crisp and roasted by hand.",
      body: "Start with a classic plain or methi, or send a gift pack that travels as well as it tastes.",
      primary: { label: "Shop the range", href: "/shop" },
      secondary: { label: "Visit the help centre", href: "/support" },
    },
  },

  support: {
    metaDescription:
      "Answers on shipping and delivery, breakage in transit, storage and shelf life, returns of packaged food, allergens and payments — for Khakhra House hand-roasted khakhra.",
    lede: "Answers on shipping and delivery, keeping your khakhra crisp, returns and refunds, gifting, allergens and payments. Can't find what you need? We're a message away.",
    searchPlaceholder: "Search help — shipping, breakage, refunds…",
    closing: {
      eyebrow: "Still have a question?",
      title: "We'd love to help you find the right khakhra.",
      body: "Reach our kitchen team directly, or check on an order in a couple of taps.",
      primary: { label: "Contact us", href: "/contact" },
      secondary: { label: "Track an order", href: "/account/track" },
    },
  },

  // The brand publishes no Journal (features.journal is false and the list is
  // empty), so these pages never render; the copy exists so the contract holds.
  journal: {
    index: {
      title: "Notes from the Khakhra House kitchen",
      metaDescription:
        "Notes from the Khakhra House kitchen — brand-authored guides to roasting, storing and serving khakhra well.",
      lede: "Writing on the craft of khakhra, storing it well and what to serve it with — from the people who roast it.",
      closing: {
        eyebrow: "Taste the difference",
        title: "Reading about khakhra is lovely. Eating it is better.",
        body: "Put the theory to work with a pack from our latest batch.",
        primary: { label: "Shop the range", href: "/shop" },
        secondary: { label: "Our story", href: "/about" },
      },
      empty: {
        eyebrow: "Coming soon",
        title: "The first stories are still being written.",
        body: "Our kitchen notes land here soon. In the meantime, the khakhra speaks for itself.",
        cta: { label: "Browse the shop", href: "/shop" },
      },
    },
    article: {
      closing: {
        eyebrow: "Keep exploring",
        title: "From the page to the plate.",
        body: "Put what you've read to the test with a pack from our latest batch.",
        primary: { label: "Shop the range", href: "/shop" },
        secondary: { label: "Back to the Journal", href: "/journal" },
      },
      authorName: "Khakhra House Kitchen",
      byline: "Written by the Khakhra House Kitchen",
    },
  },

  shop: {
    metaDescription:
      "Shop hand-roasted khakhra — plain, methi, masala, jeera, pudina, multigrain, and gift packs.",
    categoryMetaDescription: (categoryName) =>
      `Shop ${categoryName} — hand-roasted khakhra, made in small batches in India.`,
  },

  errors: {
    storefront: {
      title: "Something crumbled on our side.",
      body: "This page hit a snag while loading. Try again — the khakhra is fine.",
    },
    shop: {
      title: "The shop shelf slipped.",
      body: "We couldn't load the khakhra just now. It's us, not you — try again in a moment.",
    },
  },

  notFound: {
    headline: "This page got eaten.",
    body: "The page you're looking for doesn't exist — but the khakhra most certainly does.",
    primary: { label: "Explore the range", href: "/shop" },
    secondary: { label: "Back home", href: "/" },
  },

  cart: {
    metaDescription: "Review your Khakhra House bag — hand-roasted khakhra, gift wrap, and coupons.",
    emptyTitle: "Your bag is empty",
    emptyBody: "Let’s fix that — the methi khakhra is calling.",
  },

  footer: {
    tagline: "Thin, crisp and roasted by hand.",
    blurb: "Small-batch khakhra, rolled thin and roasted slowly in our own kitchen, shipped crisp anywhere in India.",
    clubHeading: "The Khakhra House Club",
    copyrightHolder: "Khakhra House",
  },

  newsletter: {
    label: (offer) => `Get ${offer}`,
    success: (offer) => `You’re in — check your inbox for ${offer}.`,
    toastSuccess: "Welcome to the Club! Check your inbox.",
    finePrint: "No spam, ever. Unsubscribe in one click.",
  },

  notifications: {
    "order_confirmed.email": {
      subject: "Payment received — order {{orderNumber}}",
      body: "Hi {{customerName}},\n\nThank you — your order {{orderNumber}} is confirmed and we're packing it with care.\n\nTrack it any time: {{trackingUrl}}",
    },
    "order_cancelled.email": {
      subject: "Order {{orderNumber}} cancelled",
      body: "Hi {{customerName}},\n\nWe've cancelled order {{orderNumber}} as requested. Any amount paid is refunded to the original method.",
    },
    "order_shipped.email": {
      subject: "Shipped — order {{orderNumber}} is on its way",
      body: "Hi {{customerName}},\n\nGood news — order {{orderNumber}} has shipped via {{courierName}} (AWB {{awb}}).\n\nTrack it: {{trackingUrl}}",
    },
    "order_shipped.sms": {
      body: "Order {{orderNumber}} shipped via {{courierName}} (AWB {{awb}}). Track: {{trackingUrl}}",
    },
    "order_out_for_delivery.email": {
      subject: "Out for delivery — order {{orderNumber}}",
      body: "Hi {{customerName}},\n\nYour order {{orderNumber}} is out for delivery today. Track: {{trackingUrl}}",
    },
    "order_out_for_delivery.sms": {
      body: "Order {{orderNumber}} is out for delivery today. Track: {{trackingUrl}}",
    },
    "order_delivered.email": {
      subject: "Delivered — order {{orderNumber}}",
      body: "Hi {{customerName}},\n\nOrder {{orderNumber}} has been delivered. We hope every pack is as crisp as the day it was roasted!",
    },
    "order_delivered.sms": {
      body: "Order {{orderNumber}} delivered. Enjoy! {{trackingUrl}}",
    },
  },
} satisfies StorefrontCopy;
