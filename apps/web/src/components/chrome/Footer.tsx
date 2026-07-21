import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { getFssaiLicense } from "@/lib/catalog/queries";
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
 * Global storefront footer (LCC-inspired two-tone). A centered dark cocoa
 * newsletter band sits above a light cream body: brand + contact, three link
 * columns, and a centered legal bar carrying the India-compliance line (FSSAI /
 * MRP). Server component; the only client island is the newsletter form. All
 * routes preserved — UI only.
 */
export async function Footer(): Promise<ReactNode> {
  const fssai = await getFssaiLicense().catch(() => null);
  const year = new Date().getFullYear();

  return (
    <footer>
      {/* ============ Newsletter band — dark, centered (LCC top) ============ */}
      <section className="relative overflow-hidden bg-ink text-cream kk-grain">
        <div className="relative mx-auto max-w-[680px] px-5 py-10 text-center sm:py-12">
          <div className="mb-2.5 font-mono text-eyebrow font-medium tracking-[0.2em] text-gold-soft uppercase">
            The KAKOA Club
          </div>
          <h2 className="font-display text-h2 font-normal text-cream">
            Sweeten your inbox
          </h2>
          <p className="mx-auto mt-2.5 max-w-[460px] font-body text-[15px] leading-[1.5] text-[#D8C7B0]">
            15% off your first box, plus first access to seasonal drops.
          </p>
          <div className="mx-auto mt-6 max-w-[520px]">
            <NewsletterForm variant="bare" />
          </div>
        </div>
      </section>

      {/* ==================== Main body — light cream ==================== */}
      <div className="border-t border-line bg-cream-2 text-ink">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          {/* ---- Brand + link columns ---- */}
          <div className="grid gap-x-8 gap-y-8 py-10 max-[680px]:grid-cols-1 max-[1000px]:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1fr]">
            {/* Brand · about · contact · social */}
            <div className="max-[1000px]:col-span-2 max-[680px]:col-span-1">
              <BrandLockup size="header" />
              <p className="mt-3.5 max-w-[300px] font-display text-[19px] leading-[1.2] text-ink">
                Chocolate that tastes of somewhere.
              </p>
              <p className="mt-2 max-w-[300px] font-body text-[14px] leading-[1.5] text-ink-muted">
                Small-batch, single-origin chocolate, roasted and hand-finished in
                our own kitchen.
              </p>

              <div className="mt-5 flex flex-col gap-1 font-body text-[15px] font-medium">
                <a
                  href="mailto:support@kakoa.in"
                  className="w-fit text-ink-soft no-underline transition-colors hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  support@kakoa.in
                </a>
                <a
                  href="tel:+919820012345"
                  className="w-fit text-ink-soft no-underline transition-colors hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  +91 98200 12345
                </a>
              </div>
            </div>

            <FooterColumn heading="Shop" links={SHOP_LINKS} />
            <FooterColumn heading="Company" links={COMPANY_LINKS} />
            <FooterColumn heading="Support" links={SUPPORT_LINKS} />
          </div>

          {/* ---- Legal bar — legal left · social right (same row) ---- */}
          <div className="flex flex-col gap-4 border-t border-line py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-body text-[13px] text-ink-muted">
              <span>© {year} KAKOA Chocolates. All rights reserved.</span>
              {LEGAL_LINKS.map((link) => (
                <span key={link.label} className="flex items-center gap-x-2.5">
                  <span aria-hidden="true" className="text-line">
                    ·
                  </span>
                  <Link
                    href={link.href}
                    className="font-medium text-ink-muted no-underline transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    {link.label}
                  </Link>
                </span>
              ))}
              <span aria-hidden="true" className="text-line">
                ·
              </span>
              <span>
                {fssai !== null ? `FSSAI Lic. No. ${fssai}` : "FSSAI licensed"} · MRP
                inclusive of all taxes
              </span>
            </div>

            {/* Social — right side */}
            <div className="flex shrink-0 items-center gap-2.5">
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
    <nav aria-label={heading}>
      <div className="mb-4 font-mono text-[11.5px] font-medium tracking-[0.16em] text-espresso uppercase">
        {heading}
      </div>
      <ul className="flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="group inline-flex w-fit items-center font-body text-[15px] font-medium text-ink-soft no-underline transition-colors hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <span
                aria-hidden="true"
                className="mr-0 inline-block h-px w-0 bg-espresso transition-[width,margin] duration-[var(--duration-base)] ease-brand group-hover:mr-2 group-hover:w-3 motion-reduce:transition-none"
              />
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
      className="grid h-9 w-9 place-items-center rounded-pill border border-line bg-surface text-espresso transition-all duration-[var(--duration-base)] ease-brand hover:-translate-y-0.5 hover:border-espresso hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transform-none motion-reduce:transition-none"
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
