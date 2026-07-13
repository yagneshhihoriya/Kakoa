import { Suspense, type ReactNode } from "react";
import { ToastProvider } from "@kakoa/ui/client";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { WishlistProvider } from "@/components/auth/WishlistProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/chrome/CartDrawer";
import { Footer } from "@/components/chrome/Footer";
import { Header } from "@/components/chrome/Header";
import { RevealInit } from "@/components/chrome/RevealInit";

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

              {/* ANNOUNCEMENT (prototype ribbon; free-ship copy kept price-free —
                  the threshold is data-driven and rendered inside the cart). */}
              <div className="bg-ink px-4 py-[9px] text-center font-body text-[12.5px] font-medium leading-none tracking-[.02em] text-card">
                Complimentary shipping on qualifying orders&nbsp;·&nbsp;Hand-made
                in small batches&nbsp;·&nbsp;Ships cold &amp; safe
              </div>

              <Header />

              <div id="main-content" className="flex-1">{children}</div>

              <Footer />

              <CartDrawer />
            </div>
            </WishlistProvider>
          </AuthProvider>
        </Suspense>
      </CartProvider>
    </ToastProvider>
  );
}
