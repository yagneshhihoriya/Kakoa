import { Fragment, Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { ToastProvider } from "@kakoa/ui/client";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { WishlistProvider } from "@/components/auth/WishlistProvider";
import { CartProvider } from "@/components/cart/CartProvider";
import { AddedToBagProvider } from "@/components/cart/AddedToBagSheet";
import { BackToTop } from "@/components/chrome/BackToTop";
import { CartDrawer } from "@/components/chrome/CartDrawer";
import { Footer } from "@/components/chrome/Footer";
import { Header } from "@/components/chrome/Header";
import { toNavCategories } from "@/components/chrome/nav";
import { RevealInit } from "@/components/chrome/RevealInit";
import { RouteProgress } from "@/components/chrome/RouteProgress";
import { THEME_TOKENS, type ThemeTokenKey } from "@/lib/admin/settings-schema";
import {
  defaultStorefrontSettings,
  getCategories,
  getStorefrontSettings,
  type StorefrontSettings,
} from "@/lib/catalog/queries";

/**
 * Storefront chrome per the prototype (00-global-header-drawers.html +
 * 05-footer.html): announcement ribbon → sticky glass header → page →
 * ink footer, with the cart drawer portal-free at the end of the shell.
 * Layout stays RSC; Header/CartDrawer are the only client islands.
 *
 * The chrome is data-driven: categories come from the catalogue, static pages
 * from the brand pack, and the ribbon / hero / social / logo / theme tweaks from
 * `store_settings` (Admin → Settings → Storefront / Brand). Both reads are
 * cached and `settings`/`categories`-tagged, and degrade to the brand defaults
 * if the database is unreachable so the shell always renders.
 */

async function loadChrome(): Promise<{
  categories: ReturnType<typeof toNavCategories>;
  settings: StorefrontSettings;
}> {
  const [categories, settings] = await Promise.all([
    getCategories().catch(() => []),
    getStorefrontSettings().catch(defaultStorefrontSettings),
  ]);
  return { categories: toNavCategories(categories), settings };
}

/** The configured share image (brand.og_image_url) becomes every storefront page's OG fallback. */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStorefrontSettings().catch(defaultStorefrontSettings);
  if (settings.ogImageUrl === null) return {};
  return {
    openGraph: { images: [{ url: settings.ogImageUrl }] },
    twitter: { card: "summary_large_image", images: [settings.ogImageUrl] },
  };
}

/**
 * `brand.theme.*` overrides as one `:root { … }` rule — after the pack's
 * theme.css in document order, so a configured hex wins over the pack value.
 * Values are validated `#RRGGBB` strings (settings-schema), never free text.
 */
function themeOverrideCss(theme: StorefrontSettings["theme"]): string | null {
  const declarations = (Object.keys(THEME_TOKENS) as ThemeTokenKey[])
    .filter((token) => theme[token] !== undefined)
    .map((token) => `${THEME_TOKENS[token]}:${theme[token]}`);
  return declarations.length > 0 ? `:root{${declarations.join(";")}}` : null;
}

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { categories, settings } = await loadChrome();
  const themeCss = themeOverrideCss(settings.theme);
  const [firstSegment, ...moreSegments] = settings.announcementSegments;

  return (
    <ToastProvider>
      <CartProvider>
        <AddedToBagProvider>
        {/* AuthProvider reads `?login=1` via useSearchParams — needs Suspense. */}
        <Suspense fallback={null}>
          <AuthProvider>
            <WishlistProvider>
            <div className="flex min-h-screen flex-col bg-cream text-ink">
              {themeCss !== null ? <style>{themeCss}</style> : null}
              {/* WCAG 2.4.1 — bypass the header nav; visible only on keyboard focus. */}
              <a
                href="#main-content"
                className="sr-only rounded-lg bg-ink px-4 py-2 font-body text-sm font-semibold text-card focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[200] focus:shadow-lg"
              >
                Skip to content
              </a>
              <RevealInit />
              <RouteProgress />

              {/* ANNOUNCEMENT (prototype ribbon) — `storefront.announcement_segments`:
                  the first segment always shows, the rest join it on wider
                  screens. Free-ship copy stays price-free; the threshold is
                  data-driven and rendered inside the cart. */}
              {firstSegment !== undefined ? (
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-field px-3 py-2 text-center text-[12px] font-medium leading-tight tracking-[1.2px] text-field-ink sm:px-4"
                  style={{ fontFamily: "var(--font-ui)" }}>
                  <span>{firstSegment}</span>
                  {moreSegments.map((segment) => (
                    <Fragment key={segment}>
                      <span aria-hidden="true" className="text-field-ink/45 max-[680px]:hidden">
                        ✦
                      </span>
                      <span className="max-[680px]:hidden">{segment}</span>
                    </Fragment>
                  ))}
                </div>
              ) : null}

              <Header categories={categories} logoUrl={settings.logoUrl} />

              <div id="main-content" className="flex-1">{children}</div>

              <Footer categories={categories} settings={settings} />

              <CartDrawer />
              <BackToTop />
            </div>
            </WishlistProvider>
          </AuthProvider>
        </Suspense>
        </AddedToBagProvider>
      </CartProvider>
    </ToastProvider>
  );
}
