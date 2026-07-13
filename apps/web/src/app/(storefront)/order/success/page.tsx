/**
 * `/order/success` — post-placement confirmation (checkout.md §2 steps 6–7,
 * prototype 51-order-success.html).
 *
 * Reads `?order={orderNumber}&token={accessToken}` from the client redirect
 * and fetches the guest-scoped order summary. The token is a capability
 * credential (checkout.md §6) — never rendered, never leaked in the referer
 * (this route sets `Referrer-Policy: strict-origin-when-cross-origin` via the
 * response headers configured in next.config). A fetch failure degrades to a
 * minimal "Order placed — {number}" acknowledgement rather than a 500.
 *
 * COD vs prepaid drive the confirmation copy: COD says "we'll call to confirm",
 * prepaid says "confirmed".
 */
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import {
  formatPaise,
  formatIST,
  type ApiResult,
  type CartLineView,
} from "@kakoa/core";
import { ChocoPlaceholder } from "@/components/catalog/ChocoPlaceholder";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Shape returned by `GET /api/orders/[orderNumber]/summary?token=` (§5). */
interface OrderSummaryPayload {
  orderNumber: string;
  status: string;
  paymentMode: "prepaid" | "cod";
  contactName: string;
  shippingCity: string;
  shippingState: string;
  lines: CartLineView[];
  subtotalPaise: number;
  discountPaise: number;
  shippingFeePaise: number;
  codFeePaise: number;
  giftWrapTotalPaise: number;
  totalPaise: number;
  etaDaysMin: number;
  etaDaysMax: number;
  /** ISO-8601 UTC placement instant — displayed IST. */
  placedAt: string;
}

/** Absolute base for the RSC-side fetch (Route Handlers are same-origin). */
function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit != null && explicit !== "") return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel != null && vercel !== "") return `https://${vercel}`;
  return "http://localhost:3000";
}

/** IST placement label, or `null` when the timestamp is missing/malformed. */
function safePlacedIST(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatIST(date);
}

async function fetchSummary(
  orderNumber: string,
  token: string,
): Promise<OrderSummaryPayload | null> {
  try {
    const url = `${siteOrigin()}/api/orders/${encodeURIComponent(
      orderNumber,
    )}/summary?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { cache: "no-store" });
    const result = (await response.json()) as ApiResult<OrderSummaryPayload>;
    if (result.ok) return result.data;
    return null;
  } catch {
    return null;
  }
}

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const { order, token } = await searchParams;
  const orderNumber = typeof order === "string" ? order : "";
  const summary =
    orderNumber !== "" && typeof token === "string" && token !== ""
      ? await fetchSummary(orderNumber, token)
      : null;

  const isCod = summary?.paymentMode === "cod";

  // "Track order" CTA carries the read-only access_token (≤24h) so the guest
  // lands directly on the tracking view (order-tracking.md §2 direct path).
  const trackHref: Route =
    orderNumber !== "" && typeof token === "string" && token !== ""
      ? (`/account/track?order=${encodeURIComponent(
          orderNumber,
        )}&accessToken=${encodeURIComponent(token)}` as Route)
      : ("/account/track" as Route);

  return (
    <main className="mx-auto max-w-[720px] px-5 pb-20 pt-14 text-center sm:px-8 sm:pt-16">
      {/* Success badge */}
      <div className="mx-auto mb-6 grid h-[84px] w-[84px] place-items-center rounded-pill bg-[#7C8A4E] text-card shadow-[0_14px_34px_rgba(124,138,78,.34)]">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
        >
          <path d="M4 12l5 5L20 6" />
        </svg>
      </div>

      <p className="mb-3.5 font-mono text-[12px] uppercase tracking-[0.2em] text-[#8a5a34]">
        {isCod ? "Order placed" : "Order confirmed"}
      </p>
      <h1
        className="mb-3.5 text-[38px] leading-[1.1] text-ink sm:text-[44px]"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {summary?.contactName != null && summary.contactName !== ""
          ? `Thank you, ${summary.contactName.split(" ")[0]}.`
          : "Thank you."}
      </h1>

      <p className="mx-auto mb-2 max-w-[440px] font-body text-[16px] leading-relaxed text-espresso">
        {isCod
          ? "We'll call to confirm your Cash on Delivery order before we hand-pack it."
          : "Your chocolates are being hand-packed. A confirmation is on its way to your inbox."}
      </p>

      {orderNumber !== "" ? (
        <p className="mb-8 font-body text-[14px] font-semibold text-ink">
          Order <span className="text-[#8a5a34]">#{orderNumber}</span>
        </p>
      ) : null}

      {summary !== null ? (
        <div className="mb-6 rounded-[20px] border border-line bg-card p-6 text-left">
          {/* Delivery + ship-to */}
          <div className="mb-5 grid grid-cols-1 gap-[18px] border-b border-[#EADBC6] pb-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.1em] text-[#8a5a34]">
                Estimated delivery
              </p>
              <p className="font-body text-[16px] font-semibold text-ink">
                {summary.etaDaysMin > 0
                  ? `${summary.etaDaysMin}–${summary.etaDaysMax} business days`
                  : "We'll email your delivery window"}
              </p>
            </div>
            <div>
              <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.1em] text-[#8a5a34]">
                Shipping to
              </p>
              <p className="font-body text-[14.5px] leading-relaxed text-ink">
                {summary.shippingCity}
                {summary.shippingState !== "" ? `, ${summary.shippingState}` : ""}
              </p>
            </div>
          </div>

          {/* Lines */}
          {summary.lines.map((line) => (
            <div
              key={line.itemId}
              className="flex items-center gap-3.5 py-2.5"
            >
              <div className="w-[48px] flex-none">
                <ChocoPlaceholder tone={line.tone} ratio="48 / 56" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-[15px] font-semibold text-ink">
                  {line.name}
                </p>
                <p className="font-body text-[13px] text-[#8a7a68]">
                  Qty {line.qty}
                </p>
              </div>
              <span className="font-body text-[15px] font-bold tabular-nums text-ink">
                {formatPaise(line.lineTotalPaise)}
              </span>
            </div>
          ))}

          {/* Totals */}
          <div className="mt-2 flex items-baseline justify-between border-t border-[#EADBC6] pt-4">
            <span className="font-body text-[15px] font-semibold text-ink">
              {isCod ? "Total due" : "Total paid"}
            </span>
            <span className="font-body text-[22px] font-bold tabular-nums text-ink">
              {formatPaise(summary.totalPaise)}
            </span>
          </div>
          {safePlacedIST(summary.placedAt) !== null ? (
            <p className="mt-2 font-body text-[12.5px] text-[#8a7a68]">
              Placed {safePlacedIST(summary.placedAt)}
            </p>
          ) : null}
        </div>
      ) : orderNumber !== "" ? (
        // Graceful degradation — fetch failed but the order exists.
        <div className="mb-6 rounded-[20px] border border-line bg-card p-6 text-left">
          <p className="font-body text-[14.5px] leading-relaxed text-espresso">
            Your order <span className="font-semibold text-ink">#{orderNumber}</span>{" "}
            has been placed. We&apos;ll email you the full details shortly.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href={trackHref}
          className="rounded-pill bg-ink px-7 py-[15px] font-body text-[15px] font-bold text-card no-underline transition-colors hover:bg-[#3f2c1b]"
        >
          Track my order
        </Link>
        <Link
          href="/shop"
          className="rounded-pill border-[1.5px] border-[#E0CFB6] px-7 py-[15px] font-body text-[15px] font-bold text-ink no-underline transition-colors hover:bg-[#F3E7D5]"
        >
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
