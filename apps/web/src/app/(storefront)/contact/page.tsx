import type { Metadata } from "next";
import Link from "next/link";
import { getCompanyInfo } from "@/lib/catalog/queries";
import { brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Get in touch with ${brand.profile.name} — support, address, phone, email and our Grievance Officer.`,
  alternates: { canonical: "/contact" },
};

/**
 * Contact Us — the legally-required merchant disclosure page (Consumer
 * Protection E-Commerce Rules 2020 + payment-gateway activation): legal entity
 * name, physical registered address, working phone + email, support hours, tax
 * identifiers, and the named Grievance Officer with a resolution timeline. All
 * values come from Settings so they stay accurate and consistent with invoices;
 * the legal identity has no code default, so its rows render only once the
 * owner has configured them (never another brand's details).
 */
export default async function ContactPage() {
  const c = await getCompanyInfo();

  return (
    <main className="mx-auto w-full max-w-[820px] px-6 py-14 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-espresso">Get in touch</p>
      <h1 className="mt-2 text-[34px] leading-tight text-ink md:text-[40px]" style={{ fontFamily: "var(--font-display), serif" }}>
        Contact us
      </h1>
      <p className="mt-3 max-w-[600px] font-body text-[15px] leading-[1.7] text-espresso">
        We're a small team and we read every message. For order help, please include your order
        number so we can assist you faster.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ContactCard title="Customer support">
          <Row label="Email">
            <a href={`mailto:${c.supportEmail}`} className="font-semibold text-espresso underline">
              {c.supportEmail}
            </a>
          </Row>
          <Row label="Phone">
            <a href={`tel:${c.supportPhone.replace(/\s/g, "")}`} className="font-semibold text-espresso underline">
              {c.supportPhone}
            </a>
          </Row>
          <Row label="Hours">{c.supportHours}</Row>
        </ContactCard>

        <ContactCard title="Registered business">
          {c.legalName ? <Row label="Legal name">{c.legalName}</Row> : null}
          {c.address ? <Row label="Address">{c.address}</Row> : null}
          {c.gstin ? <Row label="GSTIN">{c.gstin}</Row> : null}
          {c.fssai ? <Row label="FSSAI Lic. No.">{c.fssai}</Row> : null}
          {!c.legalIdentityConfigured ? (
            <Row label="Registration details">Being updated — please contact support for our registered particulars.</Row>
          ) : null}
        </ContactCard>
      </div>

      {/* Grievance Officer — Consumer Protection (E-Commerce) Rules, 2020 */}
      <div className="mt-4 rounded-[18px] border border-line-soft bg-cream-2 p-6">
        <h2 className="font-body text-[15px] font-semibold text-ink">Grievance Officer</h2>
        <p className="mt-1 font-body text-[13.5px] leading-[1.7] text-ink-body">
          In line with the Consumer Protection (E-Commerce) Rules, 2020, complaints may be
          addressed to our Grievance Officer. We acknowledge complaints within 48 hours and aim to
          resolve them within one month of receipt.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Row label="Name">{c.grievanceName}</Row>
          {c.legalName ? <Row label="Company">{c.legalName}</Row> : null}
          {c.address ? <Row label="Address">{c.address}</Row> : null}
          <Row label="Email">
            <a href={`mailto:${c.supportEmail}`} className="font-semibold text-espresso underline">
              {c.supportEmail}
            </a>
          </Row>
          <Row label="Phone">
            <a href={`tel:${c.supportPhone.replace(/\s/g, "")}`} className="font-semibold text-espresso underline">
              {c.supportPhone}
            </a>
          </Row>
        </div>
      </div>

      <p className="mt-8 font-body text-[13.5px] text-ink-muted">
        See also our{" "}
        <Link href="/legal/shipping" className="font-semibold text-espresso underline">Shipping</Link>,{" "}
        <Link href="/legal/refund" className="font-semibold text-espresso underline">Refund &amp; Cancellation</Link>,{" "}
        <Link href="/legal/privacy" className="font-semibold text-espresso underline">Privacy</Link> and{" "}
        <Link href="/legal/terms" className="font-semibold text-espresso underline">Terms</Link> policies.
      </p>
    </main>
  );
}

function ContactCard({ title, children }: { title: string; children: React.ReactNode }): React.ReactNode {
  return (
    <div className="rounded-[18px] border border-line-soft bg-white p-6">
      <h2 className="mb-3 font-body text-[15px] font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{label}</span>
      <span className="font-body text-[14px] leading-[1.5] text-ink">{children}</span>
    </div>
  );
}
