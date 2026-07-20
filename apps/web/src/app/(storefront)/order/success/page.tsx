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
import { formatPaise, formatIST, type ApiResult } from "@kakoa/core";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Minimal confirmation payload returned by
 * `GET /api/orders/[orderNumber]/summary?token=` (§5). The endpoint
 * deliberately withholds line items, addresses, and the money breakdown
 * beyond the total — so this page renders only what it receives.
 */
interface OrderSummaryPayload {
  orderNumber: string;
  status: string;
  paymentMode: "prepaid" | "cod";
  totalPaise: number;
  /** ISO-8601 UTC placement instant — displayed IST. */
  placedAt: string;
  itemCount: number;
  contactPhoneMasked: string;
}

/** Absolute base for the RSC-side fetch (Route Handlers are same-origin). */
function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit != null && explicit !== "") return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel != null && vercel !== "") return `https://${vercel}`;
  return "http://localhost:3000";
}

/**
 * One-shot celebratory confetti burst behind the success badge. Pure CSS,
 * server-rendered (no client JS): a fixed set of pieces with staggered
 * colours / offsets / delays fall once and fade. Hidden for reduced-motion.
 */
const CONFETTI_PIECES: {
  left: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  round: boolean;
}[] = [
  { left: -70, color: "#d9ac5e", delay: 0, duration: 1.5, size: 8, round: false },
  { left: -48, color: "#7C8A4E", delay: 0.18, duration: 1.7, size: 7, round: true },
  { left: -30, color: "#b5472f", delay: 0.06, duration: 1.4, size: 9, round: false },
  { left: -12, color: "#E9C46A", delay: 0.28, duration: 1.8, size: 6, round: true },
  { left: 6, color: "#8a5a34", delay: 0.12, duration: 1.55, size: 8, round: false },
  { left: 24, color: "#7C8A4E", delay: 0.32, duration: 1.65, size: 7, round: false },
  { left: 42, color: "#d9ac5e", delay: 0.04, duration: 1.75, size: 9, round: true },
  { left: 60, color: "#b5472f", delay: 0.22, duration: 1.45, size: 6, round: false },
  { left: 78, color: "#E9C46A", delay: 0.1, duration: 1.6, size: 8, round: false },
  { left: -58, color: "#b5472f", delay: 0.4, duration: 1.85, size: 6, round: true },
  { left: -2, color: "#d9ac5e", delay: 0.36, duration: 1.5, size: 7, round: false },
  { left: 52, color: "#8a5a34", delay: 0.46, duration: 1.7, size: 8, round: true },
];

function Confetti() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-0 z-0 h-[84px] w-[220px] -translate-x-1/2 motion-reduce:hidden"
    >
      {CONFETTI_PIECES.map((p, i) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={`absolute top-[30px] ${p.round ? "rounded-full" : "rounded-[1px]"}`}
          style={{
            left: `calc(50% + ${p.left}px)`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animation: `kk-confetti ${p.duration}s ease-in ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  );
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
      {/* Success badge + one-shot confetti burst */}
      <div className="relative mx-auto mb-6 h-[84px] w-[84px]">
        <Confetti />
        <div className="relative z-10 grid h-[84px] w-[84px] origin-center animate-[kk-badgepop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both] place-items-center rounded-pill bg-[#7C8A4E] text-card shadow-[0_14px_34px_rgba(124,138,78,.34)] motion-reduce:animate-none">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path
              d="M4 12l5 5L20 6"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1}
              className="animate-[kk-checkdraw_0.45s_ease-out_0.35s_forwards] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
            />
          </svg>
        </div>
      </div>

      <p className="mb-3.5 font-mono text-[12px] uppercase tracking-[0.2em] text-[#8a5a34]">
        {isCod ? "Order placed" : "Order confirmed"}
      </p>
      <h1
        className="mb-3.5 text-[38px] leading-[1.1] text-ink sm:text-[44px]"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Thank you.
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
          {/* Order meta */}
          <div className="mb-5 grid grid-cols-1 gap-[18px] border-b border-[#EADBC6] pb-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.1em] text-[#8a5a34]">
                Items
              </p>
              <p className="font-body text-[16px] font-semibold text-ink">
                {summary.itemCount}{" "}
                {summary.itemCount === 1 ? "item" : "items"}
              </p>
            </div>
            <div>
              <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.1em] text-[#8a5a34]">
                Payment
              </p>
              <p className="font-body text-[14.5px] leading-relaxed text-ink">
                {isCod ? "Cash on Delivery" : "Paid online"}
              </p>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-baseline justify-between">
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
          <p className="mt-1 font-body text-[12.5px] text-[#8a7a68]">
            We&apos;ll email your delivery window and full order details
            shortly.
          </p>
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
