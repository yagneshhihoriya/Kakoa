/**
 * `/account/track` — guest order-tracking entry (order-tracking.md §2).
 *
 * Thin server wrapper: reads the success-page continuity params
 * (`?order=&accessToken=`) and hands them to the client `TrackOrderFlow`, which
 * runs the whole lookup → OTP → tracking flow (and the read-only accessToken
 * path). Dynamic — never statically rendered, no caching; the credential-gated
 * data is fetched client-side against the `no-store` tracking endpoint.
 *
 * The `accessToken` arrives in the URL by design (§6): it is read-only,
 * ≤24h-capped, and can't cancel — so it's safe to accept here.
 */
import type { Metadata } from "next";
import { TrackOrderFlow } from "@/components/orders/TrackOrderFlow";

export const metadata: Metadata = {
  title: "Track your order · Kakoa",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; accessToken?: string }>;
}) {
  const { order, accessToken } = await searchParams;

  return (
    <TrackOrderFlow
      {...(typeof order === "string" && order !== ""
        ? { initialOrderNumber: order }
        : {})}
      {...(typeof accessToken === "string" && accessToken !== ""
        ? { initialAccessToken: accessToken }
        : {})}
    />
  );
}
