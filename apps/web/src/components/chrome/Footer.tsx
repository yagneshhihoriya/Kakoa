import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { getCompanyInfo, getFssaiLicense } from "@/lib/catalog/queries";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { BrandLockup } from "./BrandMark";

/* ------------------------------------------------------------------ */
/* Link data — every href maps to a real app route (kept working).     */
/* ------------------------------------------------------------------ */

interface FooterLink {
  href: Route;
  label: string;
}

const SHOP_LINKS: FooterLink[] = [
  { href: "/shop" as Route, label: "All chocolate" },
  { href: "/shop?category=bars" as Route, label: "Bars" },
  { href: "/shop?category=pralines" as Route, label: "Pralines" },
  { href: "/shop?category=signature" as Route, label: "Signature" },
  { href: "/shop?category=gifts" as Route, label: "Gift boxes" },
];

const COMPANY_LINKS: FooterLink[] = [
  { href: "/about" as Route, label: "Our story" },
  { href: "/journal" as Route, label: "Journal" },
  { href: "/locator" as Route, label: "Store locator" },
  { href: "/account" as Route, label: "My account" },
];

const SUPPORT_LINKS: FooterLink[] = [
  { href: "/contact" as Route, label: "Contact us" },
  { href: "/support" as Route, label: "Help center & FAQ" },
  { href: "/account/track" as Route, label: "Track your order" },
  { href: "/legal/shipping" as Route, label: "Shipping" },
];

const LEGAL_LINKS: FooterLink[] = [
  { href: "/legal/privacy" as Route, label: "Privacy" },
  { href: "/legal/terms" as Route, label: "Terms" },
  { href: "/legal/refund" as Route, label: "Refund" },
];

/**
 * Global storefront footer — styled to match the Valrhona reference 1:1:
 * flat #683126 field, #FCF5E8 text, Poppins (via --font-footer), underlined
 * links at 75% opacity that brighten on hover, square bordered email input and
 * a solid cream rectangular submit. Mobile centres the brand, socials and
 * signup, as the reference does below 750px.
 *
 * ONE dark band, replacing
 * the previous dark-newsletter-over-cream-body split. Layout: brand + contact
 * + social, three link columns, and the newsletter pulled inline as the final
 * column; a single rule above the legal bar carrying the India-compliance line
 * (FSSAI / MRP) and the accepted payment methods.
 *
 * Server component; the only client island is the newsletter form. All routes
 * and compliance content preserved — presentation only.
 */
export async function Footer(): Promise<ReactNode> {
  const [fssai, company] = await Promise.all([
    getFssaiLicense().catch(() => null),
    getCompanyInfo(),
  ]);
  const year = new Date().getFullYear();

  const payments = ["UPI", "Cards", "Netbanking", ...(company.codEnabled ? ["Cash on delivery"] : [])];

  return (
    <footer
      className="relative overflow-hidden bg-[#683126] text-[#FCF5E8]"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
        {/* ---- Brand · link columns · newsletter ---- */}
        <div className="grid gap-x-8 gap-y-10 py-12 sm:py-14 max-[680px]:grid-cols-1 max-[1023px]:grid-cols-2 lg:grid-cols-[1.55fr_.85fr_.85fr_.85fr_1.3fr]">
          {/* Brand · about · contact · social */}
          <div className="max-[1023px]:col-span-2 max-[680px]:col-span-1 max-[749px]:flex max-[749px]:flex-col max-[749px]:items-center max-[749px]:text-center">
            <BrandLockup size="footer" />
            <p className="mt-3.5 max-w-[320px] text-[14px] leading-[21px] tracking-[0.4px] text-[#FCF5E8]">
              Chocolate that tastes of somewhere.
            </p>
            <p className="mt-2 max-w-[320px] text-[13px] leading-[19.5px] tracking-[0.4px] text-[#FCF5E8]/75">
              Small-batch, single-origin chocolate, roasted and hand-finished in
              our own kitchen.
            </p>

            <address className="mt-5 flex flex-col gap-1 text-[13px] font-light not-italic max-[749px]:items-center">
              <a
                href={`mailto:${company.supportEmail}`}
                className="w-fit tracking-[0.65px] text-[#FCF5E8]/75 underline underline-offset-[3px] transition-colors hover:text-[#FCF5E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCF5E8]"
              >
                {company.supportEmail}
              </a>
              <a
                href={`tel:${company.supportPhone.replace(/\s/g, "")}`}
                className="w-fit tracking-[0.65px] text-[#FCF5E8]/75 underline underline-offset-[3px] transition-colors hover:text-[#FCF5E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCF5E8]"
              >
                {company.supportPhone}
              </a>
              <span className="mt-2 text-[13px] font-light leading-[19.5px] text-[#FCF5E8]/60">
                <span className="block font-normal text-[#FCF5E8]/80">
                  {company.legalName}
                </span>
                {company.address}
              </span>
            </address>

            <div className="mt-6 flex items-center gap-1 max-[749px]:justify-center">
              <SocialLink label="KAKOA on Instagram" href="https://instagram.com">
                <InstagramIcon />
              </SocialLink>
              <SocialLink label="KAKOA on Facebook" href="https://facebook.com">
                <FacebookIcon />
              </SocialLink>
              <SocialLink label="KAKOA on Pinterest" href="https://pinterest.com">
                <PinterestIcon />
              </SocialLink>
              <SocialLink label="KAKOA on YouTube" href="https://youtube.com">
                <YouTubeIcon />
              </SocialLink>
            </div>
          </div>

          <FooterColumn heading="Shop" links={SHOP_LINKS} />
          <FooterColumn heading="Company" links={COMPANY_LINKS} />
          <FooterColumn heading="Support" links={SUPPORT_LINKS} />

          {/* Newsletter — inline final column */}
          <div className="max-[1023px]:col-span-2 max-[680px]:col-span-1 max-[749px]:text-center">
            <p className="text-[12px] font-medium tracking-[2.4px] text-[#FCF5E8] uppercase">
              The KAKOA Club
            </p>
            <p className="mt-1.5 max-w-[300px] text-[12px] font-medium tracking-[2.4px] text-[#FCF5E8] uppercase max-[749px]:mx-auto">
              15% off your first box
            </p>
            <div className="mt-4">
              <NewsletterForm variant="square" />
            </div>
          </div>
        </div>

        {/* ---- Legal bar ---- */}
        <div className="flex flex-col gap-3 border-t border-[#FCF5E8]/15 py-6 max-[749px]:items-center max-[749px]:text-center sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-light tracking-[0.4px] text-[#FCF5E8]/60 max-[749px]:justify-center">
            <span>© {year} KAKOA Chocolates. All rights reserved.</span>
            {LEGAL_LINKS.map((link) => (
              <span key={link.label} className="flex items-center gap-x-2.5">
                <span aria-hidden="true" className="text-[#FCF5E8]/25">
                  ·
                </span>
                <Link
                  href={link.href}
                  className="tracking-[0.65px] text-[#FCF5E8]/75 underline underline-offset-[3px] transition-colors hover:text-[#FCF5E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCF5E8]"
                >
                  {link.label}
                </Link>
              </span>
            ))}
            <span aria-hidden="true" className="text-[#FCF5E8]/25">
              ·
            </span>
            <span>
              {fssai !== null ? `FSSAI Lic. No. ${fssai}` : "FSSAI licensed"} · MRP
              inclusive of all taxes
            </span>
          </div>

          {/* Accepted payment methods — text, not vendor logos */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-light tracking-[0.4px] text-[#FCF5E8]/55 max-[749px]:justify-center">
            {payments.map((method, i) => (
              <span key={method} className="flex items-center gap-x-2">
                {i > 0 && (
                  <span aria-hidden="true" className="text-[#FCF5E8]/25">
                    ·
                  </span>
                )}
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: FooterLink[];
}): ReactNode {
  return (
    <nav aria-label={heading} className="max-[749px]:text-center">
      <div className="mb-4 text-[12px] font-medium tracking-[2.4px] text-[#FCF5E8] uppercase">
        {heading}
      </div>
      <ul className="flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="inline-block w-fit py-[5px] text-[13px] font-light leading-[19.5px] tracking-[0.65px] text-[#FCF5E8]/75 underline underline-offset-[3px] transition-colors hover:text-[#FCF5E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCF5E8]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}): ReactNode {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="grid h-11 w-11 place-items-center text-[#FCF5E8]/75 transition-colors hover:text-[#FCF5E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCF5E8]"
    >
      {children}
    </a>
  );
}

/* ---- Icons (server-safe inline SVG) ---- */

function InstagramIcon(): ReactNode {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon(): ReactNode {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 9h3V5.5h-3c-2 0-3.5 1.6-3.5 3.6V11H8v3.5h2.5V21H14v-6.5h2.6l.4-3.5H14V9.4c0-.3.2-.4.6-.4Z" />
    </svg>
  );
}

function PinterestIcon(): ReactNode {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-3.3 17.4c-.1-.7-.1-1.9 0-2.7l1.1-4.5s-.3-.6-.3-1.4c0-1.3.8-2.3 1.7-2.3.8 0 1.2.6 1.2 1.3 0 .8-.5 2-.8 3.2-.2.9.5 1.6 1.4 1.6 1.7 0 2.9-2.2 2.9-4.7 0-1.9-1.3-3.4-3.7-3.4a4.2 4.2 0 0 0-4.4 4.2c0 .8.3 1.4.7 1.8.2.2.2.3.1.5l-.2.8c-.1.3-.3.4-.5.2-1-.4-1.5-1.6-1.5-3 0-2.3 2-5 5.8-5 3.1 0 5.1 2.2 5.1 4.6 0 3.2-1.8 5.6-4.4 5.6-.9 0-1.7-.5-2-1l-.5 2c-.2.7-.6 1.5-1 2.1A9 9 0 1 0 12 3Z" />
    </svg>
  );
}

function YouTubeIcon(): ReactNode {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.6 8.2a2.4 2.4 0 0 0-1.7-1.7C18.3 6 12 6 12 6s-6.3 0-7.9.5A2.4 2.4 0 0 0 2.4 8.2 25 25 0 0 0 2 12a25 25 0 0 0 .4 3.8 2.4 2.4 0 0 0 1.7 1.7C5.7 18 12 18 12 18s6.3 0 7.9-.5a2.4 2.4 0 0 0 1.7-1.7A25 25 0 0 0 22 12a25 25 0 0 0-.4-3.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  );
}
