import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPaise } from "@kakoa/core";
import { getCompanyInfo, type CompanyInfo } from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

/**
 * India-market legal pages (Privacy / Terms / Refund-Return-Cancellation /
 * Shipping) rendered from real, business-configurable content. Company identity
 * and contact come from Settings (`getCompanyInfo`) so the pages stay accurate
 * and consistent with invoices. Written to satisfy the Consumer Protection
 * (E-Commerce) Rules 2020, the DPDP Act 2023, and payment-gateway (Razorpay)
 * activation requirements (concrete refund timelines, named grievance officer,
 * physical contact details).
 */

const DOC_TITLES = {
  privacy: "Privacy Policy",
  terms: "Terms & Conditions",
  refund: "Refund, Return & Cancellation Policy",
  shipping: "Shipping Policy",
} as const;
type Doc = keyof typeof DOC_TITLES;

const EFFECTIVE = "12 July 2026";

/** A content block is a paragraph (string) or a bullet list (string[]). */
type Block = string | string[];
interface Section {
  heading: string;
  blocks: Block[];
}

export function generateStaticParams(): { doc: Doc }[] {
  return (Object.keys(DOC_TITLES) as Doc[]).map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  if (!(doc in DOC_TITLES)) return { title: "Legal · Kakao" };
  return {
    title: `${DOC_TITLES[doc as Doc]} · Kakao`,
    description: `${DOC_TITLES[doc as Doc]} for Kakao Chocolate.`,
    alternates: { canonical: `/legal/${doc}` },
  };
}

function freeShipText(c: CompanyInfo): string {
  if (c.freeShippingThresholdPaise === null) return "on eligible orders";
  if (c.freeShippingThresholdPaise === 0) return "on all orders";
  return `on orders at or above ${formatPaise(c.freeShippingThresholdPaise)}`;
}

function buildSections(doc: Doc, c: CompanyInfo): Section[] {
  const name = c.legalName;
  const email = c.supportEmail;
  const phone = c.supportPhone;
  const addr = c.address;

  if (doc === "privacy") {
    return [
      {
        heading: "1. Who we are",
        blocks: [
          `This Privacy Policy explains how ${name} ("we", "us", "the Company"), with its registered office at ${addr}, collects, uses, shares and protects your personal data when you use our website and place orders. We are the data fiduciary for the personal data described below and process it in accordance with India's Digital Personal Data Protection Act, 2023 (DPDP Act) and applicable rules.`,
        ],
      },
      {
        heading: "2. Information we collect",
        blocks: [
          "We collect only the data needed to run the store and fulfil your orders:",
          [
            "Contact & identity: your name, mobile number and email address.",
            "Delivery & billing: shipping and billing addresses and PIN code.",
            "Order data: items purchased, order value, and order history.",
            "Payment data: processed securely by our payment partner (Razorpay). We do NOT store your card, UPI or bank credentials on our servers.",
            "Technical & usage data: device, browser and cookie identifiers strictly needed to run your cart, session and site functionality.",
          ],
        ],
      },
      {
        heading: "3. How we use your data",
        blocks: [
          "We use your personal data to:",
          [
            "process, fulfil and deliver your orders and send order/shipping updates;",
            "take payment and issue GST invoices as required by law;",
            "provide customer support and handle cancellations, returns and refunds;",
            "prevent fraud and secure our platform; and",
            "send marketing communications only where you have opted in (you may opt out at any time).",
          ],
        ],
      },
      {
        heading: "4. Consent & legal basis",
        blocks: [
          "We process your personal data based on your consent (given at sign-in/checkout) and, where applicable, to perform the contract of sale and to meet our legal obligations. You may withdraw consent at any time by contacting us; withdrawal does not affect processing already carried out or processing required by law (for example, retaining tax invoices).",
        ],
      },
      {
        heading: "5. Who we share it with",
        blocks: [
          "We share the minimum data necessary with trusted partners who act on our behalf:",
          [
            "Logistics/courier partners (e.g. our shipping aggregator and delivery couriers) to deliver your order;",
            "Payment gateway (Razorpay) to process payments and refunds;",
            "Communication providers to send transactional email and SMS; and",
            "Government, tax or law-enforcement authorities where required by law.",
          ],
          "We do not sell your personal data to third parties.",
        ],
      },
      {
        heading: "6. Data retention",
        blocks: [
          "We retain your personal data only for as long as needed to provide our services and to comply with legal obligations. Order and invoice records are retained for the period required under Indian tax and company law. When data is no longer required, we delete or anonymise it.",
        ],
      },
      {
        heading: "7. Your rights",
        blocks: [
          "Under the DPDP Act you have the right to access, correct and update your personal data, to request erasure (deletion) of your data, to withdraw consent, and to nominate a person to exercise your rights. To exercise any right, email us at " +
            `${email} or contact our Grievance Officer (below). We will verify your request and respond within the timelines required by law.`,
        ],
      },
      {
        heading: "8. Cookies",
        blocks: [
          "We use only functional cookies necessary to operate the site — for example, to keep your cart and sign-in session working. We do not use third-party advertising cookies without your consent.",
        ],
      },
      {
        heading: "9. Security",
        blocks: [
          "We protect your data with encryption in transit (HTTPS), access controls and the security practices of our payment and infrastructure partners. No method of transmission is completely secure, but we work to protect your information and to notify you and the authorities of any reportable breach as required by law.",
        ],
      },
      {
        heading: "10. Children",
        blocks: [
          "Our store is intended for users aged 18 and above and is not directed at children. We do not knowingly collect the personal data of children without verifiable parental consent.",
        ],
      },
      {
        heading: "11. Changes to this policy",
        blocks: [
          "We may update this policy from time to time. The current version, with its effective date, will always be available on this page.",
        ],
      },
      grievanceSection(c),
    ];
  }

  if (doc === "terms") {
    return [
      {
        heading: "1. Acceptance of these terms",
        blocks: [
          `This website is operated by ${name} (GSTIN ${c.gstin}), registered office ${addr}. By browsing or purchasing from this website you agree to these Terms & Conditions, our Privacy Policy, Shipping Policy and Refund, Return & Cancellation Policy, each linked in the footer and accessible from checkout.`,
        ],
      },
      {
        heading: "2. Eligibility",
        blocks: [
          "You must be at least 18 years old and capable of entering into a legally binding contract to purchase from this website. You agree to provide accurate contact and delivery information.",
        ],
      },
      {
        heading: "3. Products, pricing & taxes",
        blocks: [
          "All prices are in Indian Rupees (INR) and are inclusive of GST unless stated otherwise (MRP inclusive of all taxes). Product images are indicative. We make every effort to display accurate prices and availability but errors can occur; where a genuine error is found we may cancel the affected order and refund any amount paid.",
        ],
      },
      {
        heading: "4. Orders & acceptance",
        blocks: [
          "Your order is an offer to purchase. A contract is formed only when we confirm the order. We may decline or cancel an order — including after payment — in cases such as items being out of stock, a pricing/description error, or suspected fraud; in such cases any amount already paid is refunded per our Refund Policy.",
        ],
      },
      {
        heading: "5. Payments",
        blocks: [
          "Payments are processed securely through Razorpay (cards, UPI, net-banking and wallets) and, where offered, Cash on Delivery. We do not store your card or bank credentials. You confirm that the payment instrument used is lawfully yours.",
        ],
      },
      {
        heading: "6. Perishable / food products",
        blocks: [
          "Our products are food items and may be temperature-sensitive and perishable. Please refer to the storage instructions and use-by information on each product and store them appropriately on receipt. We are an FSSAI-licensed food business" +
            (c.fssai ? ` (FSSAI Lic. No. ${c.fssai}).` : "."),
        ],
      },
      {
        heading: "7. Shipping, returns & refunds",
        blocks: [
          "Delivery timelines and charges are set out in our Shipping Policy. Cancellations, returns, replacements and refunds are governed by our Refund, Return & Cancellation Policy, including the specific rules for perishable food items.",
        ],
      },
      {
        heading: "8. Intellectual property",
        blocks: [
          "All content on this website — including text, logos, photographs and designs — is owned by or licensed to the Company and may not be copied, reproduced or used without our written permission.",
        ],
      },
      {
        heading: "9. Acceptable use",
        blocks: [
          "You agree not to misuse the website, attempt to gain unauthorised access, interfere with its operation, or use it for any unlawful purpose.",
        ],
      },
      {
        heading: "10. Limitation of liability",
        blocks: [
          "To the maximum extent permitted by law, the Company is not liable for indirect or consequential losses. Nothing in these terms limits your rights under the Consumer Protection Act, 2019 or excludes liability that cannot be excluded by law.",
        ],
      },
      {
        heading: "11. Governing law & jurisdiction",
        blocks: [
          "These terms are governed by the laws of India. Subject to applicable consumer-protection law, the courts at the location of the Company's registered office shall have jurisdiction over any disputes.",
        ],
      },
      {
        heading: "12. Changes",
        blocks: [
          "We may revise these terms from time to time. The version published on this page, with its effective date, applies to your use of the website.",
        ],
      },
      grievanceSection(c),
    ];
  }

  if (doc === "refund") {
    return [
      {
        heading: "1. Order cancellation",
        blocks: [
          "You may cancel an order free of charge any time before it is dispatched — from your account (Orders → Cancel) or by contacting us. Once an order has been dispatched it cannot be cancelled; please refer to the returns section below. If you cancel a prepaid order before dispatch, the full amount is refunded to your original payment method.",
        ],
      },
      {
        heading: "2. Returns — perishable food items",
        blocks: [
          "Because our products are food items, for hygiene and safety reasons we cannot accept returns of products that have been opened, consumed or tampered with. However, you are fully protected if something is wrong with your order. You are eligible for a replacement or refund if:",
          [
            "the product arrived damaged, melted, spoilt or leaking;",
            "you received the wrong item; or",
            "the product was past or near its use-by date on arrival.",
          ],
          "Please report such issues within 48 hours of delivery, with your order number and clear photographs of the product and packaging, so we can resolve it quickly.",
        ],
      },
      {
        heading: "3. Non-returnable items",
        blocks: [
          "Opened or partially consumed food items, products past their use-by date once delivered in good condition, and personalised/custom orders are not eligible for return except where they are defective or were damaged in transit.",
        ],
      },
      {
        heading: "4. How to raise a request",
        blocks: [
          `Email ${email} or call ${phone} within 48 hours of delivery with your order number and photos (for damage/defect claims). Our team will acknowledge your request and confirm the resolution — replacement, refund, or store credit — after a quick review.`,
        ],
      },
      {
        heading: "5. Refund method & timelines",
        blocks: [
          "Once a refund is approved:",
          [
            "Prepaid orders (card/UPI/net-banking): refunded to your original payment method within 5–7 business days of approval.",
            "Cash on Delivery orders: refunded via bank transfer/UPI to the details you provide, within 5–7 business days of approval.",
            "The exact time for the amount to reflect depends on your bank or payment provider.",
          ],
        ],
      },
      {
        heading: "6. Replacements",
        blocks: [
          "For eligible damaged, defective or wrong items we will offer a replacement where stock allows; otherwise a full refund is issued.",
        ],
      },
      {
        heading: "7. Failed or refused delivery",
        blocks: [
          "If a shipment is returned to us undelivered after reasonable delivery attempts, or is refused at the door, we will refund the order value; the shipping charge may be deducted for prepaid orders where the return was not due to our error.",
        ],
      },
      grievanceSection(c),
    ];
  }

  // shipping
  return [
    {
      heading: "1. Where we ship",
      blocks: [
        "We ship across India to all serviceable PIN codes. Serviceability for your address is checked at checkout; if we cannot deliver to your PIN code you will be notified before payment.",
      ],
    },
    {
      heading: "2. Order processing & dispatch",
      blocks: [
        "Orders are processed and dispatched within 1–2 business days of successful payment (or order confirmation for Cash on Delivery). Business days exclude Sundays and public holidays.",
      ],
    },
    {
      heading: "3. Delivery timelines",
      blocks: [
        "Once dispatched, orders are typically delivered within 2–7 business days depending on your location. Metro cities are usually faster; remote PIN codes may take longer. A tracking link is shared by email/SMS once your order ships.",
      ],
    },
    {
      heading: "4. Shipping charges",
      blocks: [
        "Shipping charges are shown at checkout before payment:",
        shippingChargeLines(c),
      ],
    },
    {
      heading: "5. Perishable / cold-chain handling",
      blocks: [
        "Our chocolates are temperature-sensitive. We use protective and, where needed, insulated packaging, and plan dispatch to reduce time in transit. During warmer months or to certain regions we may adjust dispatch scheduling to protect product quality.",
      ],
    },
    {
      heading: "6. Tracking your order",
      blocks: [
        "You can track your order any time from your account (Orders → Track) or via the tracking link in your shipping email/SMS. Guests can track using the order number and the contact details used at checkout.",
      ],
    },
    {
      heading: "7. Delays & undelivered orders",
      blocks: [
        "We are not responsible for delays caused by events beyond our control (weather, strikes, courier disruptions or force majeure). If delivery fails after reasonable attempts, the order is returned to us and handled per our Refund, Return & Cancellation Policy.",
      ],
    },
    grievanceSection(c),
  ];
}

function shippingChargeLines(c: CompanyInfo): string[] {
  const lines: string[] = [];
  if (c.standardShippingPaise !== null) {
    lines.push(
      c.standardShippingPaise === 0
        ? "Standard shipping: free."
        : `Standard shipping: ${formatPaise(c.standardShippingPaise)} per order.`,
    );
  }
  if (c.expressShippingPaise !== null && c.expressShippingPaise > 0) {
    lines.push(`Express shipping (where available): ${formatPaise(c.expressShippingPaise)}.`);
  }
  lines.push(`Free shipping ${freeShipText(c)}.`);
  if (c.codEnabled && c.codFeePaise !== null && c.codFeePaise > 0) {
    lines.push(`Cash on Delivery is available with a surcharge of ${formatPaise(c.codFeePaise)}.`);
  }
  return lines;
}

/** Shared Grievance Officer block — required by the E-Commerce Rules 2020. */
function grievanceSection(c: CompanyInfo): Section {
  return {
    heading: "Grievance Officer & contact",
    blocks: [
      "In accordance with the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000, the Grievance Officer for this platform is:",
      [
        `Name: ${c.grievanceName}`,
        `Company: ${c.legalName}`,
        `Address: ${c.address}`,
        `Email: ${c.supportEmail}`,
        `Phone: ${c.supportPhone}`,
        `Hours: ${c.supportHours}`,
      ],
      "We acknowledge every complaint within 48 hours of receipt and endeavour to resolve it within one month from the date of receipt, in line with the applicable rules.",
    ],
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ doc: string }>;
}) {
  const { doc } = await params;
  if (!(doc in DOC_TITLES)) notFound();
  const key = doc as Doc;
  const company = await getCompanyInfo();
  const sections = buildSections(key, company);

  return (
    <main className="mx-auto w-full max-w-[820px] px-6 py-14 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-espresso">Legal</p>
      <h1 className="mt-2 text-[34px] leading-tight text-ink md:text-[40px]" style={{ fontFamily: "var(--font-display), serif" }}>
        {DOC_TITLES[key]}
      </h1>
      <p className="mt-2 font-body text-[13px] text-[#8a7a68]">Effective date: {EFFECTIVE}</p>

      <div className="mt-8 flex flex-col gap-7">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-2 font-body text-[16px] font-semibold text-ink">{section.heading}</h2>
            <div className="flex flex-col gap-3">
              {section.blocks.map((block, i) =>
                Array.isArray(block) ? (
                  <ul key={i} className="ml-5 flex list-disc flex-col gap-1.5 font-body text-[14.5px] leading-[1.7] text-[#4C3B2A]">
                    {block.map((li, j) => (
                      <li key={j}>{li}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i} className="font-body text-[14.5px] leading-[1.75] text-[#4C3B2A]">
                    {block}
                  </p>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-[#EEE1CE] pt-5 font-body text-[13px] text-[#8a7a68]">
        Questions about this policy? Email{" "}
        <a href={`mailto:${company.supportEmail}`} className="font-semibold text-espresso underline">
          {company.supportEmail}
        </a>{" "}
        or see our{" "}
        <a href="/contact" className="font-semibold text-espresso underline">
          Contact page
        </a>
        .
      </p>
    </main>
  );
}
