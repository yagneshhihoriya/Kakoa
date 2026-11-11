import { formatPaise } from "@kakoa/core";
import type { CompanyInfo } from "@/lib/catalog/queries";
import type { FaqBuilder } from "../contract";

/**
 * Khakhra House Help-centre FAQ. Every answer is grounded in the same policy
 * facts as the legal pages, and the live values (contact details,
 * free-shipping threshold, COD, FSSAI, the SLA windows) are interpolated from
 * `getCompanyInfo` so Settings edits reach both surfaces. Shelf-stable
 * product: the shipping answers talk about breakage, never melting.
 */

/** Free-shipping phrase shared across shipping answers. */
function freeShipPhrase(c: CompanyInfo): string {
  if (c.freeShippingThresholdPaise === null) {
    return "We offer free shipping on eligible orders";
  }
  if (c.freeShippingThresholdPaise === 0) {
    return "Shipping is free on every order";
  }
  return `Orders at or above ${formatPaise(c.freeShippingThresholdPaise)} ship free`;
}

/** Build the policy-grounded FAQ dataset from live company settings. */
export const buildFaq: FaqBuilder = (c) => {
  const email = c.supportEmail;
  const phone = c.supportPhone;
  const vegLine = c.fssai !== "" ? ` (FSSAI Lic. No. ${c.fssai})` : "";
  const { damageReportWindowHours: hours, refundSlaDays, dispatchSlaDays, deliveryEtaDays } =
    c.policy;

  return [
    {
      category: "Orders & shipping",
      items: [
        {
          q: "Where do you ship, and how fast?",
          a: `We ship across India to every serviceable PIN code — serviceability is checked at checkout before you pay. Orders are dispatched within ${dispatchSlaDays} business days of a successful payment, and once on the way they typically arrive within ${deliveryEtaDays} business days depending on your location. Metro cities are usually quicker; remote PIN codes can take a little longer. Khakhra travels at room temperature, so there is no seasonal pause on dispatch.`,
        },
        {
          q: "How much does shipping cost?",
          a: `${freeShipPhrase(c)}. Any charge below that is shown clearly at checkout before you pay, so there are never surprises.`,
        },
        {
          q: "Will my khakhra break in transit?",
          a: `Khakhra is thin and crisp by design, so we pack for it: every pack is sealed, stacked flat and placed in a rigid carton with cushioning so it cannot shift or be crushed. A few small edge pieces are normal for a hand-rolled product; if a pack arrives badly broken or crushed, tell us within ${hours} hours of delivery with photos and we'll make it right.`,
        },
        {
          q: "How do I track my order?",
          a: `A tracking link is sent by email and SMS the moment your order ships. You can also track any time from your account under Orders → Track. Ordered as a guest? Use your order number and the contact details you used at checkout on our order-tracking page.`,
        },
        {
          q: "My order arrived damaged, crushed, or it's the wrong item — what now?",
          a: `You're fully covered. If your order arrived damaged, crushed, stale, past its best-before date, or you received the wrong item, report it within ${hours} hours of delivery — email ${email} or call ${phone} with your order number and clear photos of the product and packaging. We'll confirm a replacement (where stock allows) or a refund, and approved refunds reach your original payment method within ${refundSlaDays} business days.`,
        },
      ],
    },
    {
      category: "Storage & shelf life",
      items: [
        {
          q: "How should I store my khakhra once it arrives?",
          a: `Keep it in an airtight container, away from moisture, heat and direct sunlight — a cool, dry cupboard is ideal. Humidity is what softens khakhra, so reseal the pack or move the contents to a jar as soon as it is opened. It does not need refrigeration, and the fridge will only make it damp.`,
        },
        {
          q: "How long does it stay crisp?",
          a: `Each pack carries its own best-before date and storage guidance — that's your source of truth. Sealed and stored as above, our khakhra keeps for around three months from the day it is roasted; once opened, enjoy it within a couple of weeks for the best crackle.`,
        },
        {
          q: "My khakhra has gone a little soft — can I rescue it?",
          a: `Yes. Khakhra that has picked up moisture is still perfectly safe; warm it on a dry tava or in a toaster for a minute or two and let it cool, and the crispness comes right back. If a pack arrived stale or soft on delivery, report it within ${hours} hours with photos and we'll sort out a replacement or refund.`,
        },
      ],
    },
    {
      category: "Returns & refunds",
      items: [
        {
          q: "What can I return?",
          a: `Because our products are packaged food items, for hygiene and safety we can't accept returns of khakhra once the pack has been opened, consumed or tampered with, or of personalised orders — except where they're defective or were damaged in transit. You are eligible for a replacement or refund if the product arrived damaged, crushed or stale; you received the wrong item; or it was past or near its best-before date on arrival.`,
        },
        {
          q: "How do refunds work and how long do they take?",
          a: `Once a refund is approved, prepaid orders (card / UPI / net-banking) are refunded to your original payment method within ${refundSlaDays} business days. The exact time for the amount to reflect then depends on your bank or payment provider. For eligible damaged, defective or wrong items we'll offer a replacement where stock allows; otherwise a full refund is issued.`,
        },
        {
          q: "Can I cancel my order?",
          a: `Yes — you can cancel free of charge any time before your order is dispatched, from your account (Orders → Cancel) or by contacting us. If you cancel a prepaid order before dispatch, the full amount is refunded to your original payment method. Once an order has been dispatched it can't be cancelled; if there's a problem on arrival, use the damaged/wrong-item route above.`,
        },
        {
          q: "How do I raise a return or refund request?",
          a: `Email ${email} or call ${phone} within ${hours} hours of delivery with your order number and, for damage or defect claims, clear photos. We'll acknowledge your request and confirm the resolution — replacement, refund or store credit — after a quick review.`,
        },
      ],
    },
    {
      category: "Gifting",
      items: [
        {
          q: "Do you offer gift wrap and a personal note?",
          a: `We do. At checkout you can add gift wrap and a handwritten note — we'll write your message by hand and pack the order so it's ready to give. Gift packs travel well: sealed, flat-packed and cushioned, with no refrigeration needed on the way.`,
        },
        {
          q: "Can I send an order straight to the recipient?",
          a: `Absolutely. Just enter the recipient's address as the shipping address at checkout. Add a handwritten note so they know who it's from, and we'll take care of the rest — packed crisp so it arrives whole.`,
        },
        {
          q: "Will the price show up in the gift?",
          a: `No. We never include an invoice or pricing inside the parcel — your GST invoice goes to you by email. The gift arrives with just your handwritten note (if you add one) and the khakhra.`,
        },
      ],
    },
    {
      category: "Ingredients & allergens",
      items: [
        {
          q: "What is your khakhra made of? Does it contain gluten?",
          a: `Yes — khakhra is a wheat flatbread, so every pack contains wheat (gluten). Beyond that the list is short: flour, oil, salt and the flavouring of that variety — methi leaves, jeera, pudina, a house masala, or a blend of grains for the multigrain. Some varieties contain sesame. The full ingredient list, allergen declaration and net quantity are printed on every pack and shown on each product page.`,
        },
        {
          q: "Is your khakhra vegetarian, and are you FSSAI-licensed?",
          a: `Yes — we are an FSSAI-licensed food business${vegLine}, and every product page carries the FSSAI veg / non-veg mark along with full ingredients, allergens and net quantity. All our khakhra is vegetarian. Check the specific product page for its mark and ingredient list before ordering.`,
        },
      ],
    },
    {
      category: "Account & payments",
      items: [
        {
          q: "How do I sign in? Do I need a password?",
          a: `No passwords here. We sign you in with a one-time password (OTP) sent to your mobile number — enter your number, then the code we text you. It's quick, and it keeps your account secure without another password to remember.`,
        },
        {
          q: "What payment methods do you accept?",
          a:
            `We accept prepaid payments securely through Razorpay — cards, UPI, net-banking and wallets. We never store your card, UPI or bank credentials on our servers.` +
            (c.codEnabled
              ? ` Cash on Delivery is also available at checkout where your PIN code is eligible.`
              : ` We are prepaid-only at the moment.`),
        },
        {
          q: "Can I get help from a real person?",
          a: `Always. Email ${email} or call ${phone} during our support hours (${c.supportHours}) and a member of our team will help. You can also reach us any time through the contact page.`,
        },
      ],
    },
  ];
};
