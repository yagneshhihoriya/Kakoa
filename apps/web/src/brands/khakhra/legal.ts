import type { LegalVariants } from "../contract";

/**
 * Khakhra House legal clause variants — the shelf-stable wording for a
 * packaged, room-temperature product (Terms §6, Refund §2's damage trigger,
 * Shipping §5). No cold-chain clause exists for this brand. The shared clauses
 * live in legal/[doc]/page.tsx.
 */
export const legal = {
  foodProducts: {
    heading: "6. Packaged food products",
    body: "Our products are packaged, shelf-stable food items. They are sealed at the time of packing and, for hygiene and safety, are non-returnable once opened. Please refer to the best-before date, ingredient and allergen declaration and storage guidance printed on each pack, and store the contents in an airtight container away from moisture once opened. We are an FSSAI-licensed food business",
  },
  returns: {
    heading: "2. Returns — packaged food items",
    damagedTrigger: "the product arrived damaged, crushed, stale or past its best-before date, or you received the wrong item;",
  },
  handling: {
    heading: "5. Packing and handling",
    body: "Our khakhra travels at room temperature and needs no refrigeration in transit. Every order is packed in sealed packs inside a rigid carton with cushioning to protect against crushing, and dispatched promptly so it reaches you well within its shelf life. We do not use temperature-controlled shipping, and none is required for these products.",
  },
} satisfies LegalVariants;
