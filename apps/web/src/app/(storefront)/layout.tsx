import { Suspense, type ReactNode } from "react";
import { ToastProvider } from "@kakoa/ui/client";
import { AuthProvider } from "@/components/auth/AuthProvider";
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
            <div className="flex min-h-screen flex-col bg-cream text-ink">
              <RevealInit />

              {/* ANNOUNCEMENT (prototype ribbon; free-ship copy kept price-free —
                  the threshold is data-driven and rendered inside the cart). */}
              <div className="bg-ink px-4 py-[9px] text-center font-body text-[12.5px] font-medium leading-none tracking-[.02em] text-card">
                Complimentary shipping on qualifying orders&nbsp;·&nbsp;Hand-made
                in small batches&nbsp;·&nbsp;Ships cold &amp; safe
              </div>

              <Header />

              <div className="flex-1">{children}</div>

              <Footer />

              <CartDrawer />
            </div>
          </AuthProvider>
        </Suspense>
      </CartProvider>
    </ToastProvider>
  );
}
