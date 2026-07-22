/**
 * The Journal — KAKOA's editorial surface. Original, brand-authored educational
 * writing (byline "KAKOA Kitchen"), never fabricated user content, reviews, or
 * named-founder bios. Pure data: no DB, no network, no `Date.now()` — dates are
 * fixed 2026 ISO strings so builds are deterministic and the copy stays honest.
 *
 * `coverTone` is a Tailwind gradient class built only from `@theme` tokens (no
 * raw hex); the index/article pages drop it into a `PhotoSlot` placeholder so
 * real photography can replace it later with zero markup churn.
 */

export type ArticleCategory = "Craft" | "Origins" | "Guides" | "Pairing";

/** A single rendered block of article prose. Rendered as nodes — never HTML. */
export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export interface Article {
  /** Kebab-case URL slug. */
  slug: string;
  title: string;
  /** ~20-word summary used on cards and as the meta description. */
  excerpt: string;
  category: ArticleCategory;
  /** Fixed ISO date (YYYY-MM-DD) in 2026 — never computed at runtime. */
  dateIso: string;
  readMinutes: number;
  /** Token-only Tailwind gradient class for the cover placeholder. */
  coverTone: string;
  body: ArticleBlock[];
}

/**
 * The published Journal. Ordered newest-first here for readability; callers
 * that need ordering guarantees should use `getJournalArticles()`.
 */
export const JOURNAL: readonly Article[] = [
  {
    slug: "a-beginners-guide-to-tasting-dark-chocolate",
    title: "A beginner's guide to tasting dark chocolate",
    excerpt:
      "Slow down and taste properly: how to read the snap, aroma, melt and finish of a fine dark chocolate, one square at a time.",
    category: "Pairing",
    dateIso: "2026-07-15",
    readMinutes: 6,
    coverTone: "from-plum to-ink",
    body: [
      {
        type: "p",
        text: "Fine dark chocolate rewards attention. The same bar can taste of red fruit to one person and roasted nuts to another — and both can be right. Tasting is simply the practice of slowing down enough to notice. You do not need a trained palate or special vocabulary to start. You need one good square, a quiet minute, and a little curiosity.",
      },
      {
        type: "p",
        text: "Here is the approach we use in our own kitchen when we cut a new batch. It works just as well at your kitchen table.",
      },
      { type: "h2", text: "Set the scene" },
      {
        type: "p",
        text: "Taste when you are neither hungry nor full, and away from strong smells — coffee, perfume, a scented candle — because most of what we call flavour is actually aroma. Let the chocolate come up to room temperature; a square straight from the fridge is muted and waxy, and you will miss half of what is there.",
      },
      { type: "h2", text: "Work through the senses, in order" },
      {
        type: "ul",
        items: [
          "Look: good dark chocolate has a clean, even sheen, not a dull or greyish film.",
          "Snap: break a square. A crisp, clean snap tells you it was well tempered.",
          "Smell: cup it in your hand for a moment to warm it, then breathe in before you taste.",
          "Melt: place it on your tongue and let it melt — do not chew. Notice how the texture changes.",
          "Finish: pay attention to the flavours that linger after it has gone. The finish is where single-origin chocolate shows its character.",
        ],
      },
      { type: "h2", text: "Name what you notice" },
      {
        type: "p",
        text: "Reach for everyday reference points rather than technical terms. Is it bright and fruity, or deep and roasty? Does it remind you of raisins, citrus, toasted bread, warm spice, or coffee? There are no wrong answers — the point is to build your own map of what you like, so your next choice is a little more deliberate than the last.",
      },
      {
        type: "p",
        text: "Try two origins side by side and the differences leap out. That contrast is the whole reason we work bean-to-bar: to let each origin taste of somewhere, rather than sanding every bar down to the same flat sweetness.",
      },
    ],
  },
  {
    slug: "how-to-store-fine-chocolate",
    title: "How to store fine chocolate",
    excerpt:
      "Heat, humidity and strong smells are chocolate's three enemies. A short, practical guide to keeping every bar at its best.",
    category: "Guides",
    dateIso: "2026-06-24",
    readMinutes: 4,
    coverTone: "from-espresso to-cocoa-deep",
    body: [
      {
        type: "p",
        text: "Fine chocolate is a living, delicate thing — real cocoa butter, no stabilisers to prop it up. Store it well and it stays glossy, snappy and expressive for months. Store it badly and it turns dull, grainy or flat long before its time. The good news: keeping it well is simple once you know what to avoid.",
      },
      { type: "h2", text: "The three enemies" },
      {
        type: "ul",
        items: [
          "Heat: above roughly 20°C the cocoa butter softens and, over time, can bloom into a pale, streaky film.",
          "Humidity: moisture draws sugar to the surface, leaving a rough, sandy texture known as sugar bloom.",
          "Strong smells: chocolate is porous and readily takes on the aromas around it — spices, coffee, a pungent cheese.",
        ],
      },
      { type: "h2", text: "Where to keep it" },
      {
        type: "p",
        text: "A cool, dark, dry cupboard — steady around 16–18°C — is ideal. Keep bars sealed in their wrapper, and tuck them away from the oven, a sunny windowsill, or anything strongly scented in the pantry. Consistency matters more than cold: chocolate dislikes swinging back and forth between warm and cool far more than it dislikes a steady, gentle room temperature.",
      },
      { type: "h2", text: "About the fridge" },
      {
        type: "p",
        text: "We do not recommend the fridge. It is humid, full of competing smells, and the shock of cold-to-warm invites bloom. If a heatwave leaves you no choice, seal the bar in an airtight container first, and let it return to room temperature — still sealed — before you unwrap it, so condensation forms on the container and not on the chocolate.",
      },
      {
        type: "p",
        text: "One reassurance about summer deliveries: we ship cold and insulated across India precisely so your chocolate arrives in the same condition it left our kitchen. Once it is with you, a cool cupboard does the rest.",
      },
    ],
  },
  {
    slug: "the-bean-to-bar-process-step-by-step",
    title: "The bean-to-bar process, step by step",
    excerpt:
      "From raw cacao to a finished bar, every stage happens under one roof. A walk through the craft, movement by movement.",
    category: "Craft",
    dateIso: "2026-06-03",
    readMinutes: 7,
    coverTone: "from-cocoa to-ink",
    body: [
      {
        type: "p",
        text: "\"Bean-to-bar\" means exactly what it says: we take in raw cacao and carry it all the way to a finished bar ourselves, rather than melting down chocolate someone else has already made. It is slower and far more demanding — and it is the only way we know to keep the character of each origin intact from the farm to your hands.",
      },
      {
        type: "p",
        text: "Here is the journey a batch takes through our kitchen.",
      },
      { type: "h2", text: "Sourcing" },
      {
        type: "p",
        text: "It begins long before the roaster. We buy cacao directly from growers across four origins on ethical, above-market terms, and we choose beans that have been well fermented and dried at the farm — because no amount of care later can rescue a poorly fermented bean.",
      },
      { type: "h2", text: "Roasting" },
      {
        type: "p",
        text: "Each origin is roasted on its own gentle profile — low and slow — to coax out its natural character without scorching the delicate top notes. Roasting is where a bean's future flavour is set, so we treat every batch differently rather than forcing them all through one recipe.",
      },
      { type: "h2", text: "Cracking and winnowing" },
      {
        type: "p",
        text: "The roasted beans are cracked and the papery shell is winnowed away, leaving the pure kernel — the nib — which is where all the flavour and cocoa butter live.",
      },
      { type: "h2", text: "Grinding and conching" },
      {
        type: "p",
        text: "The nibs are ground into a thick liquor and then conched — slowly worked and warmed for hours, sometimes days. Conching is where a gritty paste turns silky, harsh edges mellow, and the flavour rounds into balance. It cannot be rushed.",
      },
      { type: "h2", text: "Tempering and moulding" },
      {
        type: "p",
        text: "Finally the chocolate is tempered — carefully guided through a sequence of temperatures so the cocoa butter sets in a single, stable crystal form. Good tempering is what gives a bar its glossy face and clean, confident snap. We temper by hand, in small batches, then mould, cool, and unwrap.",
      },
      {
        type: "ul",
        items: [
          "Source — direct, ethical trade across four origins",
          "Roast — a gentle profile tuned to each origin",
          "Crack & winnow — separate the nib from the shell",
          "Grind & conch — refine liquor into silk over hours",
          "Temper & mould — set for gloss and a clean snap",
        ],
      },
      {
        type: "p",
        text: "Five movements, one kitchen, no shortcuts. That is what small-batch bean-to-bar really asks of you — and it is exactly why the results taste the way they do.",
      },
    ],
  },
  {
    slug: "what-single-origin-really-means",
    title: "What single-origin really means",
    excerpt:
      "Single-origin is more than a label. Here is what it tells you about where your chocolate comes from — and why it tastes distinct.",
    category: "Origins",
    dateIso: "2026-05-14",
    readMinutes: 5,
    coverTone: "from-caramel to-cocoa-deep",
    body: [
      {
        type: "p",
        text: "You will see \"single-origin\" on more and more chocolate, and for good reason — but it is worth understanding what the phrase actually promises. At its simplest, single-origin means the cacao in a bar comes from one defined place, rather than being blended from many anonymous sources to hit a consistent, generic flavour.",
      },
      { type: "h2", text: "Why place matters" },
      {
        type: "p",
        text: "Cacao is agricultural, like wine grapes or coffee. The variety of the tree, the soil, the climate, and — crucially — how the beans are fermented and dried after harvest all leave their mark. That is why cacao from one origin can taste of dried fruit and warm spice, while another leans toward nuts, earth, or bright citrus. Single-origin chocolate is made to let those differences come through rather than smoothing them away.",
      },
      { type: "h2", text: "What the label does and does not tell you" },
      {
        type: "ul",
        items: [
          "It tells you the cacao is traceable to one region, estate, or cooperative.",
          "It signals an intent to express that place's character, not to mask it.",
          "It does not, on its own, guarantee quality — a single origin can still be poorly fermented or carelessly roasted.",
          "It does not automatically mean ethical sourcing; that is a separate promise a maker has to keep on purpose.",
        ],
      },
      { type: "h2", text: "How we think about it" },
      {
        type: "p",
        text: "We work with cacao from four origins and buy directly, on ethical terms, so we know both the place and the people behind each bean. Then we roast, conch and temper every batch in-house, tuning each step to the origin in front of us. Single-origin is where the story starts; the craft that follows is what lets each bar taste, honestly, of somewhere.",
      },
      {
        type: "p",
        text: "The best way to understand any of this is to taste two origins side by side and let your own palate do the talking. That contrast — one place against another — is the whole point.",
      },
    ],
  },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * Format a fixed ISO date (YYYY-MM-DD) as "14 May 2026" — matching the legal
 * pages' date style. Pure and deterministic; returns the raw string if the
 * input is malformed rather than throwing.
 */
export function formatArticleDate(iso: string): string {
  const parts = iso.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const monthName = MONTH_NAMES[month - 1];
  if (
    parts.length !== 3 ||
    !Number.isInteger(year) ||
    !Number.isInteger(day) ||
    monthName === undefined
  ) {
    return iso;
  }
  return `${day} ${monthName} ${year}`;
}

/** All published articles, ordered newest-first by their fixed date. */
export function getJournalArticles(): Article[] {
  return [...JOURNAL].sort((a, b) => (a.dateIso < b.dateIso ? 1 : -1));
}

/** Look up a single article by slug, or `undefined` if none matches. */
export function getArticleBySlug(slug: string): Article | undefined {
  return JOURNAL.find((article) => article.slug === slug);
}

/** Every article slug — for `generateStaticParams`. */
export function journalSlugs(): string[] {
  return JOURNAL.map((article) => article.slug);
}
