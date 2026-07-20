import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { getFssaiLicense } from "@/lib/catalog/queries";
import { BrandLockup } from "./BrandMark";

/** Prototype 05-footer.html link columns, mapped to app routes. */
const COLUMNS = [
  {
    heading: "Shop",
    links: [
      { href: "/shop", label: "All chocolate" },
      { href: "/shop?category=gifts", label: "Gift boxes" },
      { href: "/shop?category=bars", label: "Bars" },
      { href: "/shop?category=pralines", label: "Pralines" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "Our story" },
      { href: "/journal", label: "Journal" },
      { href: "/locator", label: "Store locator" },
      { href: "/account", label: "My account" },
    ],
  },
  {
    heading: "Support",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/support", label: "Help center" },
      { href: "/support", label: "FAQ" },
      { href: "/account", label: "My account" },
    ],
  },
] as const;

const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/shipping", label: "Shipping" },
  { href: "/legal/refund", label: "Refund" },
] as const;

/**
 * Global storefront footer (2026 premium refresh): grain-textured ink slab
 * with a serif brand statement, three link columns, and a hairline legal row
 * carrying the India-compliance line (FSSAI / MRP) from Module 1. Server
 * component; zero client JS. Data + links are preserved from the original.
 */
export async function Footer(): Promise<ReactNode> {
  const fssai = await getFssaiLicense().catch(() => null);
  return (
    <footer className="relative overflow-hidden bg-ink text-[#D8C7B0] kk-grain">
      <div className="relative mx-auto max-w-[1240px] px-8 pt-16 pb-8">
        <div className="grid gap-11 border-b border-[rgba(216,199,176,.14)] pb-12 max-[1000px]:grid-cols-2 max-[680px]:gap-8 lg:grid-cols-[1.7fr_1fr_1fr_1fr]">
          <div className="max-[1000px]:col-span-2">
            <BrandLockup size="footer" />
            <p className="mt-5 max-w-[320px] font-display text-[24px] leading-[1.2] text-card">
              Chocolate that tastes of somewhere.
            </p>
            <p className="mt-3.5 max-w-[300px] font-body text-sm leading-[1.6] text-[#B8A88F]">
              Small-batch, single-origin chocolate made by hand. Bean to bar,
              always.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <div className="mb-4 font-mono text-[11px] font-medium tracking-[0.16em] text-gold-soft uppercase">
                {column.heading}
              </div>
              <div className="flex flex-col gap-3 text-sm">
                {column.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href as Route}
                    className="w-fit text-[#B8A88F] no-underline transition-colors hover:text-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-7 font-body text-[12.5px] text-[#8a7a63]">
          <div>
            <span>
              © {new Date().getFullYear()} Kakao Chocolate. All rights reserved.
            </span>
            <div className="mt-0.5">
              {fssai !== null ? `FSSAI Lic. No. ${fssai}` : "FSSAI licensed"} ·
              MRP inclusive of all taxes
            </div>
          </div>
          <div className="flex gap-[18px]">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[#8a7a63] no-underline transition-colors hover:text-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
