import type { Metadata } from "next";
import { formatPaise } from "@kakoa/core";
import {
  ContentPageShell,
  ContentClosingCta,
} from "@/components/content/ContentPageShell";
import {
  FaqAccordion,
  type FaqCategory,
} from "@/components/content/FaqAccordion";
import { getCompanyInfo, type CompanyInfo } from "@/lib/catalog/queries";

/**
 * KAKOA Help centre — categorized FAQ with a live client-side search. Every
 * answer is grounded in the same policy facts as our legal pages (dispatch in
 * 1–2 business days, delivery in 2–7, report damage within 48 hours with photos,
 * refunds to the original method in 5–7 business days), and real contact /
 * shipping values are interpolated from `getCompanyInfo`. FAQPage JSON-LD is
 * server-rendered from the same dataset so search engines see identical copy.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Help Centre",
  description:
    "Answers on shipping and cold-chain delivery, storage and freshness, returns and refunds, gifting, and payments — for KAKOA single-origin, bean-to-bar chocolate.",
  alternates: { canonical: "/support" },
};

/** Free-shipping phrase shared across shipping answers. */
function freeShipPhrase(c: CompanyInfo): string {
  if (c.freeShippingThresholdPaise === null) {
    return "We offer free shipping on eligible orders";
  }
  if (c.freeShippingThresholdPaise === 0) {
    return "Shipping is free on every order";
  }
  return `Orders at or above ${formatPaise(
    c.freeShippingThresholdPaise,
  )} ship free`;
}

/** Build the policy-grounded FAQ dataset from live company settings. */
function buildFaq(c: CompanyInfo): FaqCategory[] {
  const email = c.supportEmail;
  const phone = c.supportPhone;
  const vegLine = c.fssai !== "" ? ` (FSSAI Lic. No. ${c.fssai})` : "";

  return [
    {
      category: "Orders & shipping",
      items: [
        {
          q: "Where do you ship, and how fast?",
          a: `We ship across India to every serviceable PIN code — serviceability is checked at checkout before you pay. Orders are dispatched within 1–2 business days of a successful payment, and once on the way they typically arrive within 2–7 business days depending on your location. Metro cities are usually quicker; remote PIN codes can take a little longer.`,
        },
        {
          q: "How much does shipping cost?",
          a: `${freeShipPhrase(
            c,
          )}. Any charge below that is shown clearly at checkout before you pay, so there are never surprises.`,
        },
        {
          q: "Will my chocolate melt in transit during summer?",
          a: `Chocolate is temperature-sensitive, and we take it seriously. We pack cold and insulated — protective, insulated packaging with ice packs where needed — and plan dispatch to keep time in transit short. During warmer months or to certain regions we may adjust the dispatch schedule to protect quality. If anything arrives softened or heat-affected, tell us within 48 hours of delivery with photos and we'll make it right.`,
        },
        {
          q: "How do I track my order?",
          a: `A tracking link is sent by email and SMS the moment your order ships. You can also track any time from your account under Orders → Track. Ordered as a guest? Use your order number and the contact details you used at checkout on our order-tracking page.`,
        },
        {
          q: "My order arrived damaged, melted, or it's the wrong item — what now?",
          a: `You're fully covered. If your order arrived damaged, melted, spoilt, leaking, past its use-by date, or you received the wrong item, report it within 48 hours of delivery — email ${email} or call ${phone} with your order number and clear photos of the product and packaging. We'll confirm a replacement (where stock allows) or a refund, and approved refunds reach your original payment method within 5–7 business days.`,
        },
      ],
    },
    {
      category: "Storage & freshness",
      items: [
        {
          q: "How should I store my chocolate once it arrives?",
          a: `Keep it somewhere cool, dry and away from direct sunlight and strong odours — chocolate readily picks up surrounding smells. An airtight container in a cool cupboard is ideal. Avoid the fridge unless it's very warm where you are; if you must refrigerate, seal it well to prevent condensation and let it come back to room temperature, still wrapped, before eating. Always check the storage note printed on your specific product.`,
        },
        {
          q: "How long does it stay fresh?",
          a: `Each bar and box carries its own best-before / use-by date and storage guidance on the pack — that's your source of truth. Because we roast, conch and temper in small batches, your chocolate reaches you fresh. For the best flavour, enjoy it well within the printed window and keep it stored as above.`,
        },
        {
          q: "There's a pale film on my chocolate — has it gone bad?",
          a: `A dull or pale film is usually "bloom" — cocoa butter or sugar rising to the surface after warmth or temperature swings. It's harmless and safe to eat, though the texture may be slightly off. If your chocolate instead arrived clearly melted, spoilt or damaged, report it within 48 hours of delivery with photos and we'll sort out a replacement or refund.`,
        },
      ],
    },
    {
      category: "Returns & refunds",
      items: [
        {
          q: "What can I return?",
          a: `Because our products are food items, for hygiene and safety we can't accept returns of chocolate that has been opened, consumed or tampered with, or personalised orders — except where they're defective or were damaged in transit. You are eligible for a replacement or refund if the product arrived damaged, melted, spoilt or leaking; you received the wrong item; or it was past or near its use-by date on arrival.`,
        },
        {
          q: "How do refunds work and how long do they take?",
          a: `Once a refund is approved, prepaid orders (card / UPI / net-banking) are refunded to your original payment method within 5–7 business days. The exact time for the amount to reflect then depends on your bank or payment provider. For eligible damaged, defective or wrong items we'll offer a replacement where stock allows; otherwise a full refund is issued.`,
        },
        {
          q: "Can I cancel my order?",
          a: `Yes — you can cancel free of charge any time before your order is dispatched, from your account (Orders → Cancel) or by contacting us. If you cancel a prepaid order before dispatch, the full amount is refunded to your original payment method. Once an order has been dispatched it can't be cancelled; if there's a problem on arrival, use the damaged/wrong-item route above.`,
        },
        {
          q: "How do I raise a return or refund request?",
          a: `Email ${email} or call ${phone} within 48 hours of delivery with your order number and, for damage or defect claims, clear photos. We'll acknowledge your request and confirm the resolution — replacement, refund or store credit — after a quick review.`,
        },
      ],
    },
    {
      category: "Gifting",
      items: [
        {
          q: "Do you offer gift wrap and a personal note?",
          a: `We do. At checkout you can add gift wrap and a handwritten note — we'll write your message by hand and pack the order beautifully so it's ready to give. It's the loveliest way to send single-origin chocolate to someone you care about.`,
        },
        {
          q: "Can I send an order straight to the recipient?",
          a: `Absolutely. Just enter the recipient's address as the shipping address at checkout. Add a handwritten note so they know who it's from, and we'll take care of the rest — packed cold and insulated so it arrives in perfect condition.`,
        },
        {
          q: "Will the price show up in the gift?",
          a: `No. We never include an invoice or pricing inside the parcel — your GST invoice goes to you by email. The gift arrives with just your handwritten note (if you add one) and the chocolate.`,
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
          q: "Is your chocolate vegetarian, and are you FSSAI-licensed?",
          a: `Yes — we are an FSSAI-licensed food business${vegLine}, and every product page carries the FSSAI veg / non-veg mark along with full ingredients, allergens and net quantity. Check the specific product page for its mark and ingredient list before ordering.`,
        },
        {
          q: "Can I get help from a real person?",
          a: `Always. Email ${email} or call ${phone} during our support hours (${c.supportHours}) and a member of our team will help. You can also reach us any time through the contact page.`,
        },
      ],
    },
  ];
}

export default async function SupportPage() {
  const company = await getCompanyInfo();
  const faq = buildFaq(company);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <ContentPageShell
        eyebrow="Help centre"
        title="How can we help?"
        lede="Answers on shipping and cold-chain delivery, keeping your chocolate fresh, returns and refunds, gifting, and payments. Can't find what you need? We're a message away."
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Help", href: "/support" },
        ]}
        width="narrow"
        footer={
          <ContentClosingCta
            eyebrow="Still have a question?"
            title="We'd love to help you find the right chocolate."
            body="Reach our kitchen team directly, or check on an order in a couple of taps."
            primary={{ label: "Contact us", href: "/contact" }}
            secondary={{ label: "Track an order", href: "/account/track" }}
          />
        }
      >
        <FaqAccordion categories={faq} />
      </ContentPageShell>
    </>
  );
}
