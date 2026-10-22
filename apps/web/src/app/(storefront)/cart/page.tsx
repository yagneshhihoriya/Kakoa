import type { Metadata } from "next";
import Link from "next/link";
import { CartPageClient } from "@/components/cart/CartPageClient";

export const metadata: Metadata = {
  title: "Your bag",
  description:
    "Review your KAKOA bag — small-batch chocolate, gift wrap, and coupons.",
  robots: { index: false },
};

/**
 * Cart page (prototype 40-cart-page.html) — RSC shell: 1240px container,
 * breadcrumb, serif display h1. The cart itself is per-user and live-priced
 * (Cache-Control: no-store on the API), so all cart content renders in the
 * `CartPageClient` island off the CartProvider context.
 */
export default function CartPage() {
  return (
    <main
      style={{ fontFamily: "var(--font-ui)" }}
      className="mx-auto max-w-[1240px] px-8 pt-7 pb-[72px] max-[680px]:px-4"
    >
      <nav
        aria-label="Breadcrumb"
        className="mb-[22px] text-[13px] font-light tracking-[0.4px] text-[#8a7a68]"
      >
        <Link
          href="/"
          className="text-[#8a7a68] no-underline transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
        >
          Home
        </Link>
        <span aria-hidden="true">&nbsp;&nbsp;/&nbsp;&nbsp;</span>
        <span aria-current="page" className="text-ink">
          Bag
        </span>
      </nav>

      <h1 className="mb-8 text-[46px] leading-none font-medium text-[#000]">
        Your bag
      </h1>

      <CartPageClient />
    </main>
  );
}
