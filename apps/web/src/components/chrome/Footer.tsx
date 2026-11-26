import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import {
  getCompanyInfo,
  getFssaiLicense,
  type StorefrontSettings,
} from "@/lib/catalog/queries";
import { cx } from "@kakoa/ui";
import { brand, staticNav, vocabulary } from "@/lib/brand";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { BrandLockup } from "./BrandMark";
import { categoryHref, type NavCategory } from "./nav";

/* ------------------------------------------------------------------ */
/* Link data — categories from the catalogue, static pages from the    */
/* brand pack; every href maps to a real app route (kept working).     */
/* ------------------------------------------------------------------ */

interface FooterLink {
  href: Route;
  label: string;
}

/** "Shop" column — "All <collective>" then every active category (position order). */
function shopLinks(categories: readonly NavCategory[]): FooterLink[] {
  return [
    { href: "/shop" as Route, label: `All ${vocabulary.noun.collective}` },
    ...categories.map((category) => ({ href: categoryHref(category.slug), label: category.name })),
  ];
}

/** "Company" column — the pack's static pages, feature-gated routes dropped. */
const COMPANY_LINKS: FooterLink[] = staticNav(brand.profile.nav.footerCompany).map((link) => ({
  href: link.href as Route,
  label: link.label,
}));

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
 * flat `field` band with `field-ink` text, Poppins (via --font-ui), underlined
 * links at 75% opacity that brighten on hover, square bordered email input and
 * a solid cream rectangular submit. Below the desktop breakpoint the brand
 * block and the signup span the full row and the three link lists sit side by
 * side (two columns on phones, three on tablets), everything left-aligned, so
 * the footer stays short on a phone instead of one long centred column.
 *
 * ONE dark band, replacing
 * the previous dark-newsletter-over-cream-body split. Layout: brand + contact
 * + social, three link columns, and the newsletter pulled inline as the final
 * column; a single rule above the legal bar carrying the India-compliance line
 * (FSSAI / MRP) and the accepted payment methods.
 *
 * Server component; the only client island is the newsletter form. All routes
 * and compliance content preserved — presentation only. Copy is the brand
 * pack's; social links and the newsletter offer are store settings. The legal
 * bar also carries the pack's font attribution when its typeface licence
 * requires one (CC BY-ND faces).
 */
export interface FooterProps {
  /** Active catalogue categories — the "Shop" column. */
  categories: readonly NavCategory[];
  /** Storefront settings — social links, newsletter offer, logo. */
  settings: StorefrontSettings;
}

export async function Footer({ categories, settings }: FooterProps): Promise<ReactNode> {
  const [fssai, company] = await Promise.all([
    getFssaiLicense().catch(() => null),
    getCompanyInfo(),
  ]);
  const year = new Date().getFullYear();

  const payments = ["UPI", "Cards", "Netbanking", ...(company.codEnabled ? ["Cash on delivery"] : [])];
  const { fontAttribution, profile, copy } = brand;
  const { footer } = copy;
  const socials = [
    { key: "instagram", label: "Instagram", href: settings.social.instagram, Icon: InstagramIcon },
    { key: "facebook", label: "Facebook", href: settings.social.facebook, Icon: FacebookIcon },
    { key: "pinterest", label: "Pinterest", href: settings.social.pinterest, Icon: PinterestIcon },
    { key: "youtube", label: "YouTube", href: settings.social.youtube, Icon: YouTubeIcon },
  ].filter((social): social is typeof social & { href: string } => social.href !== null);

  return (
    <footer
      className="relative overflow-hidden bg-field text-field-ink"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
        {/* ---- Brand · link columns · newsletter ---- */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 py-10 sm:grid-cols-3 sm:gap-x-8 sm:gap-y-10 sm:py-14 lg:grid-cols-[1.55fr_.85fr_.85fr_.85fr_1.3fr]">
          {/* Brand · about · contact · social */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <BrandLockup size="footer" logoUrl={settings.logoUrl} />
            <p className="mt-3.5 max-w-[320px] text-[14px] leading-[21px] tracking-[0.4px] text-field-ink">
              {footer.tagline}
            </p>
            <p className="mt-2 max-w-[320px] text-[13px] leading-[19.5px] tracking-[0.4px] text-field-ink/75">
              {footer.blurb}
            </p>

            <address className="mt-5 flex flex-col gap-1 text-[13px] font-light not-italic">
              <a
                href={`mailto:${company.supportEmail}`}
                className="w-fit tracking-[0.65px] text-field-ink/75 underline underline-offset-[3px] transition-colors hover:text-field-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-ink"
              >
                {company.supportEmail}
              </a>
              <a
                href={`tel:${company.supportPhone.replace(/\s/g, "")}`}
                className="w-fit tracking-[0.65px] text-field-ink/75 underline underline-offset-[3px] transition-colors hover:text-field-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-ink"
              >
                {company.supportPhone}
              </a>
              {/* Legal identity has no code default — rendered once configured. */}
              {company.legalName || company.address ? (
                <span className="mt-2 text-[13px] font-light leading-[19.5px] text-field-ink/60">
                  {company.legalName ? (
                    <span className="block font-normal text-field-ink/80">
                      {company.legalName}
                    </span>
                  ) : null}
                  {company.address}
                </span>
              ) : null}
            </address>

            {socials.length > 0 ? (
              <div className="mt-5 -ml-3 flex items-center gap-1">
                {socials.map(({ key, label, href, Icon }) => (
                  <SocialLink key={key} label={`${profile.name} on ${label}`} href={href}>
                    <Icon />
                  </SocialLink>
                ))}
              </div>
            ) : null}
          </div>

          {/* Phones: Shop fills the left column while Company and Support stack
              on the right, so no column sits beside an empty cell. */}
          <FooterColumn heading="Shop" links={shopLinks(categories)} className="row-span-2 sm:row-span-1" />
          <FooterColumn heading="Company" links={COMPANY_LINKS} />
          <FooterColumn heading="Support" links={SUPPORT_LINKS} />

          {/* Newsletter — inline final column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <p className="text-[12px] font-medium tracking-[2.4px] text-field-ink uppercase">
              {footer.clubHeading}
            </p>
            <p className="mt-1.5 max-w-[300px] text-[12px] font-medium tracking-[2.4px] text-field-ink uppercase">
              {settings.newsletterOffer}
            </p>
            <div className="mt-4">
              <NewsletterForm variant="square" offer={settings.newsletterOffer} />
            </div>
          </div>
        </div>

        {/* ---- Legal bar ---- */}
        {/* On phones each group gets its own line (no mid-line dot wrapping) and
            the extra bottom padding keeps the last line clear of the floating
            back-to-top button; from sm up they run inline, dot-separated, with
            payments at the end. */}
        <div className="flex flex-col gap-4 border-t border-field-ink/15 pt-6 pb-20 sm:flex-row sm:items-center sm:justify-between sm:pb-6">
          <div className="flex flex-col gap-1.5 text-[12.5px] font-light tracking-[0.4px] text-field-ink/60 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2.5 sm:gap-y-1 sm:text-[13px]">
            <span>© {year} {footer.copyrightHolder}. All rights reserved.</span>
            <span className="flex flex-wrap items-center gap-x-2.5">
              <Dot className="hidden sm:inline" />
              {LEGAL_LINKS.map((link, i) => (
                <span key={link.label} className="flex items-center gap-x-2.5">
                  {i > 0 ? <Dot /> : null}
                  <Link
                    href={link.href}
                    className="tracking-[0.65px] text-field-ink/75 underline underline-offset-[3px] transition-colors hover:text-field-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-ink"
                  >
                    {link.label}
                  </Link>
                </span>
              ))}
            </span>
            <span className="flex items-center gap-x-2.5">
              <Dot className="hidden sm:inline" />
              <span>
                {fssai !== null ? `FSSAI Lic. No. ${fssai}` : "FSSAI licensed"} · MRP
                inclusive of all taxes
              </span>
            </span>
            {fontAttribution !== null ? (
              <span className="flex items-center gap-x-2.5">
                <Dot className="hidden sm:inline" />
                <a
                  href={fontAttribution.href}
                  target="_blank"
                  rel="license noopener noreferrer"
                  className="tracking-[0.4px] text-field-ink/60 underline underline-offset-[3px] transition-colors hover:text-field-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-ink"
                >
                  {fontAttribution.text}
                </a>
              </span>
            ) : null}
          </div>

          {/* Accepted payment methods — text, not vendor logos */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-light tracking-[0.4px] text-field-ink/55">
            {payments.map((method, i) => (
              <span key={method} className="flex items-center gap-x-2">
                {i > 0 ? <Dot /> : null}
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
  className,
}: {
  heading: string;
  links: FooterLink[];
  className?: string;
}): ReactNode {
  return (
    <nav aria-label={heading} className={className}>
      <div className="mb-4 text-[12px] font-medium tracking-[2.4px] text-field-ink uppercase">
        {heading}
      </div>
      <ul className="flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="inline-block w-fit py-[5px] text-[13px] font-light leading-[19.5px] tracking-[0.65px] text-field-ink/75 underline underline-offset-[3px] transition-colors hover:text-field-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-ink"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Hairline dot separator between inline legal-bar items. */
function Dot({ className }: { className?: string }): ReactNode {
  return (
    <span aria-hidden="true" className={cx("text-field-ink/25", className)}>
      ·
    </span>
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
      className="grid h-11 w-11 place-items-center text-field-ink/75 transition-colors hover:text-field-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-ink"
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
