import type { LegalVariants } from "../contract";

/**
 * KAKOA legal clause variants — the cold-chain wording the policies carried
 * for a temperature-sensitive product (Terms §6, Refund §2's damage trigger,
 * Shipping §5). The shared clauses live in legal/[doc]/page.tsx.
 */
export const legal = {
  foodProducts: {
    heading: "6. Perishable / food products",
    body: "Our products are food items and may be temperature-sensitive and perishable. Please refer to the storage instructions and use-by information on each product and store them appropriately on receipt. We are an FSSAI-licensed food business",
  },
  returns: {
    heading: "2. Returns — perishable food items",
    damagedTrigger: "the product arrived damaged, melted, spoilt or leaking;",
  },
  handling: {
    heading: "5. Perishable / cold-chain handling",
    body: "Our chocolates are temperature-sensitive. We use protective and, where needed, insulated packaging, and plan dispatch to reduce time in transit. During warmer months or to certain regions we may adjust dispatch scheduling to protect product quality.",
  },
} satisfies LegalVariants;
