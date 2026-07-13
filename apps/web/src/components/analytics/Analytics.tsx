"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Consent-gated analytics. GA4 / Meta Pixel load ONLY when (a) their public env
 * id is configured AND (b) the visitor has accepted analytics cookies. A consent
 * banner is shown only when analytics is actually configured — essential cookies
 * (cart, sign-in) never need consent, so a store with no pixels shows no banner.
 *
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID / NEXT_PUBLIC_META_PIXEL_ID to enable.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const HAS_ANALYTICS = Boolean(GA_ID || META_PIXEL_ID);
const CONSENT_KEY = "kakoa_cookie_consent";

type Consent = "granted" | "denied" | null;

export function Analytics(): ReactNode {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!HAS_ANALYTICS) return;
    try {
      const v = localStorage.getItem(CONSENT_KEY);
      setConsent(v === "granted" ? "granted" : v === "denied" ? "denied" : null);
    } catch {
      /* storage unavailable — treat as undecided */
    }
    setReady(true);
  }, []);

  if (!HAS_ANALYTICS) return null;

  function choose(value: "granted" | "denied"): void {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* ignore */
    }
    setConsent(value);
  }

  return (
    <>
      {consent === "granted" ? (
        <>
          {GA_ID ? (
            <>
              <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
              <Script id="ga4-init" strategy="afterInteractive">
                {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
              </Script>
            </>
          ) : null}
          {META_PIXEL_ID ? (
            <Script id="meta-pixel" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
            </Script>
          ) : null}
        </>
      ) : null}

      {ready && consent === null ? (
        <div
          role="dialog"
          aria-label="Cookie consent"
          className="fixed inset-x-4 bottom-4 z-[300] mx-auto max-w-[560px] rounded-2xl border border-[#EEE1CE] bg-white p-4 shadow-[0_16px_40px_rgba(42,29,18,0.18)] sm:left-auto sm:right-4"
        >
          <p className="font-body text-[13.5px] leading-relaxed text-[#4C3B2A]">
            We use analytics cookies to improve your experience. Essential cookies (cart, sign-in)
            are always on. See our{" "}
            <Link href="/legal/privacy" className="font-semibold underline">Privacy Policy</Link>.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => choose("granted")}
              className="rounded-pill bg-[#2a1d12] px-5 py-2 font-body text-[13px] font-bold text-[#f3e7d5]"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => choose("denied")}
              className="rounded-pill border border-[#e0cfb6] px-5 py-2 font-body text-[13px] font-semibold text-[#5c4b3a]"
            >
              Decline
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
