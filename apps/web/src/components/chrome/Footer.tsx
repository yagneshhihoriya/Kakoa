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
 * Global storefront footer (prototype 05-footer.html): ink slab, brand
 * column + three link columns on a 1.4fr/1fr/1fr/1fr grid, hairline legal
 * row — plus the India-compliance line (FSSAI / MRP) from Module 1.
 * Server component; zero client JS.
 */
export async function Footer(): Promise<ReactNode> {
  const fssai = await getFssaiLicense().catch(() => null);
  return (
    <footer className="bg-ink text-[#D8C7B0]">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 px-8 pt-14 pb-8 max-[1000px]:grid-cols-2 max-[680px]:gap-7">
        <div>
          <div className="mb-4">
            <BrandLockup size="footer" />
          </div>
          <p className="max-w-[280px] text-sm leading-[1.6] text-[#B8A88F]">
            Small-batch, single-origin chocolate made by hand. Bean to bar,
            always.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <div className="mb-3.5 font-body text-[13px] font-semibold uppercase tracking-[.1em] text-card">
              {column.heading}
            </div>
            <div className="flex flex-col gap-2.5 text-sm">
              {column.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href as Route}
                  className="text-[#B8A88F] no-underline transition-colors hover:text-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[rgba(216,199,176,.16)]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-8 py-5 text-[12.5px] text-[#8a7a63]">
          <div>
            <span>
              © {new Date().getFullYear()} Kakao Chocolate. All rights
              reserved.
            </span>
            <div>
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
