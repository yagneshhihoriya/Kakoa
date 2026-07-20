import { Suspense, type ReactNode } from "react";
import { ToastProvider } from "@kakoa/ui/client";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { WishlistProvider } from "@/components/auth/WishlistProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import { BackToTop } from "@/components/chrome/BackToTop";
import { CartDrawer } from "@/components/chrome/CartDrawer";
import { Footer } from "@/components/chrome/Footer";
import { Header } from "@/components/chrome/Header";
import { RevealInit } from "@/components/chrome/RevealInit";
import { RouteProgress } from "@/components/chrome/RouteProgress";

/**
 * Storefront chrome per the prototype (00-global-header-drawers.html +
 * 05-footer.html): announcement ribbon → sticky glass header → page →
 * ink footer, with the cart drawer portal-free at the end of the shell.
 * Layout stays RSC; Header/CartDrawer are the only client islands.
 */
export default function StorefrontLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <ToastProvider>
      <CartProvider>
        {/* AuthProvider reads `?login=1` via useSearchParams — needs Suspense. */}
        <Suspense fallback={null}>
          <AuthProvider>
            <WishlistProvider>
            <div className="flex min-h-screen flex-col bg-cream text-ink">
              {/* WCAG 2.4.1 — bypass the header nav; visible only on keyboard focus. */}
              <a
                href="#main-content"
                className="sr-only rounded-lg bg-ink px-4 py-2 font-body text-sm font-semibold text-card focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[200] focus:shadow-lg"
              >
                Skip to content
              </a>
              <RevealInit />
              <RouteProgress />

              {/* ANNOUNCEMENT (prototype ribbon; free-ship copy kept price-free —
                  the threshold is data-driven and rendered inside the cart). */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-3 py-2.5 text-center font-mono text-[10px] font-medium leading-tight tracking-[0.08em] text-gold-soft uppercase sm:px-4 sm:py-[11px] sm:text-[11px] sm:tracking-[0.16em]">
                <span>Complimentary shipping on qualifying orders</span>
                <span aria-hidden="true" className="text-espresso max-[680px]:hidden">
                  ✦
                </span>
                <span className="max-[680px]:hidden">
                  Hand-made in small batches
                </span>
                <span aria-hidden="true" className="text-espresso max-[680px]:hidden">
                  ✦
                </span>
                <span className="max-[680px]:hidden">Ships cold &amp; safe</span>
              </div>

              <Header />

              <div id="main-content" className="flex-1">{children}</div>

              <Footer />

              <CartDrawer />
              <BackToTop />
            </div>
            </WishlistProvider>
          </AuthProvider>
        </Suspense>
      </CartProvider>
    </ToastProvider>
  );
}
