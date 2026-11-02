import type { Metadata } from "next";
import {
  ContentPageShell,
  ClosingCta,
} from "@/components/content/ContentPageShell";
import { FaqAccordion } from "@/components/content/FaqAccordion";
import { brand } from "@/lib/brand";
import { getCompanyInfo } from "@/lib/catalog/queries";

/**
 * Help centre — categorized FAQ with a live client-side search. The dataset is
 * the brand pack's `faq(company)`: every answer is grounded in the same policy
 * facts as the legal pages, with contact / shipping / SLA values interpolated
 * from `getCompanyInfo`. FAQPage JSON-LD is server-rendered from the same
 * dataset so search engines see identical copy.
 */

export const dynamic = "force-dynamic";

const { support } = brand.copy;

export const metadata: Metadata = {
  title: "Help Centre",
  description: support.metaDescription,
  alternates: { canonical: "/support" },
};

export default async function SupportPage() {
  const company = await getCompanyInfo();
  const faq = brand.faq(company);

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
        lede={support.lede}
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Help", href: "/support" },
        ]}
        width="narrow"
        footer={<ClosingCta copy={support.closing} />}
      >
        <FaqAccordion categories={faq} searchPlaceholder={support.searchPlaceholder} />
      </ContentPageShell>
    </>
  );
}
