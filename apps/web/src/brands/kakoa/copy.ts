import type { StorefrontCopy } from "../contract";

/**
 * KAKOA storefront copy — every sentence MOVED out of the pages verbatim
 * (home, about, help centre, journal, shop metadata, error boundaries, 404,
 * cart, footer, newsletter, notification defaults). The pages own layout and
 * behaviour; this file owns the words. KAKOA is the chocolate brand, so the
 * chocolate nouns are written out here rather than interpolated.
 */
export const copy = {
  titleTagline: "Small-Batch Chocolate",
  invoiceTagline: "Fine chocolate",

  home: {
    hero: {
      eyebrow: "Small-batch · Single origin",
      headline: (productName) =>
        productName !== null
          ? `${productName}: our house dark.`
          : "Chocolate worth slowing down for.",
      body: "Ethically sourced cacao, roasted in-house and finished by hand. Tasting notes you can actually taste — no shortcuts, no fillers.",
      cta: (productName) =>
        productName !== null ? `Discover ${productName}` : "Shop the collection",
    },
    marqueeWords: [
      "Single-origin cacao",
      "Bean-to-bar",
      "Roasted in-house",
      "Small-batch",
      "Ethically sourced",
      "Hand-finished",
      "Ships cold & safe",
    ],
    trust: {
      ariaLabel: "The KAKOA promise",
      signals: [
        {
          icon: "snowflake",
          title: "Kept cool, guaranteed",
          body: "Insulated, temperature-controlled packing — or we make it right.",
        },
        {
          icon: "flame",
          title: "Small-batch, bean-to-bar",
          body: "Roasted, conched and tempered by hand in our own kitchen.",
        },
        {
          icon: "shield",
          title: "Fair-trade cacao",
          body: "Direct-trade beans from four origins, growers paid above market.",
        },
      ],
    },
    collections: {
      eyebrow: "Shop by collection",
      title: "Find your flavour",
    },
    bestSellers: {
      eyebrow: "Loved by many",
      title: "Best sellers",
      viewAll: "View all",
      emptyTitle: "The first batch is still tempering",
      emptyBody: "New chocolates land here soon — check back shortly.",
      emptyCta: { label: "Browse the shop", href: "/shop" },
    },
    story: {
      eyebrow: "Our story",
      title: ["From bean to bar,", "in our own hands."],
      body: "We started KAKOA in a tiny kitchen with one conviction: great chocolate should taste of somewhere. Today we work directly with growers across four origins, and still roast every batch ourselves.",
      stats: [
        { value: "4", label: "Cacao origins" },
        { value: "100%", label: "Roasted in-house" },
        { value: "Small", label: "Batch sizes" },
      ],
      cta: { label: "Read our story", href: "/about" },
      photoAlt: "Inside the KAKOA small-batch kitchen",
      photoLabel: "Small-batch kitchen",
    },
    process: {
      eyebrow: "The craft",
      title: "Four movements, from bean to bar.",
      steps: [
        {
          step: "01",
          title: "Source",
          body: "Direct-trade cacao from growers across four origins, chosen bean by bean.",
        },
        {
          step: "02",
          title: "Roast",
          body: "Every batch roasted in-house, low and slow, to draw out its origin character.",
        },
        {
          step: "03",
          title: "Conch",
          body: "Slow-conched for days until the texture turns to silk on the tongue.",
        },
        {
          step: "04",
          title: "Temper",
          body: "Hand-tempered and molded for that clean, glossy snap in every piece.",
        },
      ],
    },
    gifting: {
      eyebrow: "Made for gifting",
      title: ["A box that says it", "better than words."],
      body: "Single-origin chocolate, wrapped and ready to give — finished by hand, with a personal note and cold-chain delivery anywhere in India.",
      cta: { label: "Shop gifts", href: "/shop?category=gifts" },
      features: [
        {
          icon: "wrap",
          title: "Hand-wrapped, ready to gift",
          body: "Every order arrives in signature packaging — gifting-ready, straight out of the box.",
        },
        {
          icon: "note",
          title: "Add a handwritten note",
          body: "Write a personal message at checkout and we tuck it in by hand.",
        },
        {
          icon: "truck",
          title: "Ships cold, across India",
          body: "Temperature-controlled packing keeps every piece perfect — door to door.",
        },
      ],
    },
  },

  about: {
    metaDescription:
      "How KAKOA makes single-origin, bean-to-bar chocolate by hand in India — direct-trade cacao from four origins, roasted and tempered in small batches, shipped cold and gifting-ready.",
    hero: {
      eyebrow: "Our story",
      headlineLead: ["Great chocolate should", "taste of"],
      headlineEmphasis: "somewhere.",
      body: "We started KAKOA in a tiny kitchen with one conviction: that a bar of chocolate could carry the character of the place it came from. Every piece is bean-to-bar, made by hand, in small batches — no shortcuts, no fillers, nothing to hide.",
      photo: {
        label: "Our kitchen",
        alt: "Inside the KAKOA small-batch chocolate kitchen",
        from: "from-cocoa",
        to: "to-ink",
      },
    },
    // Origin → craft → gifting: alternating image/text bands.
    bands: [
      {
        eyebrow: "Where it begins",
        title: "Single-origin cacao, chosen bean by bean.",
        body: [
          "We work directly with growers across four origins, tasting and selecting the beans that carry a real sense of place. It's direct, ethical trade — growers are paid above market, because chocolate this good should be fair the whole way down.",
          "Each origin brings its own signature: bright red-fruit acidity, deep roasted nuttiness, a whisper of spice. We don't blend those voices away. We build the bar around them.",
        ],
        photo: {
          label: "Origin cacao",
          alt: "Single-origin cacao beans from four growing regions",
          from: "from-cocoa",
          to: "to-espresso",
        },
        flip: false,
      },
      {
        eyebrow: "In our kitchen",
        title: "Roasted, conched and tempered by hand.",
        body: [
          "Everything happens in our own small-batch kitchen. We roast every batch low and slow to draw out its origin character, then slow-conch for days until the texture turns to silk on the tongue.",
          "Finally we hand-temper and mould each piece for that clean, glossy snap. No shortcuts, no fillers, no industrial rush — just the same care, batch after batch.",
        ],
        photo: {
          label: "Small-batch kitchen",
          alt: "Chocolate being tempered by hand in the KAKOA kitchen",
          from: "from-espresso",
          to: "to-ink",
        },
        flip: true,
      },
      {
        eyebrow: "To your door",
        title: "Ships cold, arrives gifting-ready.",
        body: [
          "Great chocolate deserves to arrive in perfect condition. We pack every order cold and insulated, temperature-controlled from our kitchen to your door, anywhere in India.",
          "It's wrapped in signature packaging and ready to give — and you can add a handwritten note at checkout, tucked in by hand, so a gift feels like one.",
        ],
        photo: {
          label: "Cold, ready to gift",
          alt: "KAKOA chocolate boxed in signature, gifting-ready packaging",
          from: "from-cocoa-deep",
          to: "to-plum",
        },
        flip: false,
      },
    ],
    stats: {
      ariaLabel: "KAKOA by the numbers",
      items: [
        { value: "4", label: "Cacao origins" },
        { value: "100%", label: "Roasted in-house" },
        { value: "Small", label: "Batch sizes" },
      ],
    },
    jsonLd: {
      pageDescription: "How KAKOA makes single-origin, bean-to-bar chocolate by hand in India.",
      organizationDescription:
        "Single-origin, small-batch, bean-to-bar chocolate made in India. Direct-trade cacao from four origins; roasted, conched and tempered in-house.",
    },
    quote: {
      text: "We’d rather make a little chocolate we’re proud of than a lot we’re not. Every batch leaves our kitchen the way we’d want it to arrive at our own table.",
      attribution: "The KAKOA Kitchen",
    },
    closing: {
      eyebrow: "Taste the difference",
      title: "Chocolate worth slowing down for.",
      body: "Start with a single-origin bar, or send a box that says it better than words.",
      primary: { label: "Shop the collection", href: "/shop" },
      secondary: { label: "Read the Journal", href: "/journal" },
    },
  },

  support: {
    metaDescription:
      "Answers on shipping and cold-chain delivery, storage and freshness, returns and refunds, gifting, and payments — for KAKOA single-origin, bean-to-bar chocolate.",
    lede: "Answers on shipping and cold-chain delivery, keeping your chocolate fresh, returns and refunds, gifting, and payments. Can't find what you need? We're a message away.",
    searchPlaceholder: "Search help — shipping, melting, refunds…",
    closing: {
      eyebrow: "Still have a question?",
      title: "We'd love to help you find the right chocolate.",
      body: "Reach our kitchen team directly, or check on an order in a couple of taps.",
      primary: { label: "Contact us", href: "/contact" },
      secondary: { label: "Track an order", href: "/account/track" },
    },
  },

  journal: {
    index: {
      title: "Notes from the KAKOA kitchen",
      metaDescription:
        "Notes from the KAKOA kitchen — original, brand-authored guides to single-origin cacao, the bean-to-bar craft, storing chocolate well, and tasting like a maker.",
      lede: "Original writing on single-origin cacao, the bean-to-bar craft, and getting the most from every square — written by the people who roast, conch and temper it.",
      closing: {
        eyebrow: "Taste the difference",
        title: "Reading about chocolate is lovely. Tasting it is better.",
        body: "Put the theory to work with a bar from our latest small batch — shipped cold and ready to compare, square by square.",
        primary: { label: "Shop the collection", href: "/shop" },
        secondary: { label: "Our story", href: "/about" },
      },
      empty: {
        eyebrow: "Coming soon",
        title: "The first stories are still being written.",
        body: "Our kitchen notes on cacao, craft and tasting land here soon. In the meantime, the chocolate speaks for itself.",
        cta: { label: "Browse the shop", href: "/shop" },
      },
    },
    article: {
      closing: {
        eyebrow: "Keep exploring",
        title: "From the page to the palate.",
        body: "Put what you've read to the test with a bar from our latest small batch — shipped cold, ready to taste square by square.",
        primary: { label: "Shop the collection", href: "/shop" },
        secondary: { label: "Back to the Journal", href: "/journal" },
      },
      authorName: "KAKOA Kitchen",
      byline: "Written by the KAKOA Kitchen",
    },
  },

  shop: {
    metaDescription:
      "Shop small-batch bean-to-bar chocolate — bars, pralines, signature collections, and gifts.",
    categoryMetaDescription: (categoryName) =>
      `Shop ${categoryName} — small-batch bean-to-bar chocolate, crafted in India.`,
  },

  errors: {
    storefront: {
      title: "Something melted on our side.",
      body: "This page hit a snag while loading. Try again — the chocolate is fine.",
    },
    shop: {
      title: "The shop shelf slipped.",
      body: "We couldn't load the chocolates just now. It's us, not you — try again in a moment.",
    },
  },

  notFound: {
    headline: "This page has melted away.",
    body: "The page you're looking for doesn't exist — but the chocolate most certainly does.",
    primary: { label: "Explore the collection", href: "/shop" },
    secondary: { label: "Back home", href: "/" },
  },

  cart: {
    metaDescription: "Review your KAKOA bag — small-batch chocolate, gift wrap, and coupons.",
    emptyTitle: "Your bag is empty",
    emptyBody: "Let’s fix that — the truffles are calling.",
  },

  footer: {
    tagline: "Chocolate that tastes of somewhere.",
    blurb:
      "Small-batch, single-origin chocolate, roasted and hand-finished in our own kitchen.",
    clubHeading: "The KAKOA Club",
    copyrightHolder: "KAKOA Chocolates",
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
      body: "Hi {{customerName}},\n\nThank you — your order {{orderNumber}} is confirmed and we're getting it ready with care.\n\nTrack it any time: {{trackingUrl}}",
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
      body: "Hi {{customerName}},\n\nOrder {{orderNumber}} has been delivered. We hope every piece is a delight!",
    },
    "order_delivered.sms": {
      body: "Order {{orderNumber}} delivered. Enjoy! {{trackingUrl}}",
    },
  },
} satisfies StorefrontCopy;
