"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cx } from "@kakoa/ui";
import { useAuthOptional, type AuthContextValue } from "@/components/auth/AuthProvider";
import { CustomerAvatar } from "@/components/auth/CustomerAvatar";
import { BrandLockup } from "./BrandMark";
import { SearchOverlay } from "./SearchOverlay";
import { useCartChrome } from "./useCartChrome";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

/** Desktop nav — prototype order. `activeOn` drives the active underline. */
const NAV_LINKS = [
  { href: "/shop", label: "Shop", activeOn: ["/shop", "/product"] },
  { href: "/shop", label: "Collections", activeOn: [] },
  { href: "/shop", label: "Gifts", activeOn: [] },
  { href: "/about", label: "Our Story", activeOn: ["/about"] },
  { href: "/journal", label: "Journal", activeOn: ["/journal"] },
] as const;

/** Mobile menu — prototype order (Search is prepended separately). */
// Subscription & gift cards are deferred (PROJECT_PLAN §6) — links return when the modules ship.
const MOBILE_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?category=gifts", label: "Gifts" },
  { href: "/about", label: "Our Story" },
  { href: "/journal", label: "Journal" },
  { href: "/support", label: "Help" },
  { href: "/login", label: "Sign in" },
] as const;

const ICON_BUTTON_CLASSES = cx(
  "grid h-10 w-10 place-items-center rounded-pill text-ink transition-colors hover:bg-[#F0E4D2]",
  FOCUS_RING,
);

function SearchIcon(): ReactNode {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

/**
 * Global storefront header (prototype 00-global-header-drawers.html):
 * sticky, cream glass (rgba(251,246,239,.86) + 12px blur), 1240px / 74px
 * shell, gradient-square cacao mark + serif wordmark, nav with grow-in
 * underlines, icon buttons, dark cart pill with kk-pop count, mobile menu
 * sheet, and the search overlay island.
 */
export function Header(): ReactNode {
  const pathname = usePathname();
  const router = useRouter();
  const cartCtx = useCartChrome();
  const auth = useAuthOptional();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Condense the header (shorter + stronger shadow) once the page scrolls.
  useEffect(() => {
    const onScroll = (): void => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // The cart count is per-user client state fetched after mount; the server
  // renders 0. Gate the displayed count on `mounted` so SSR and the first
  // client render agree (no hydration mismatch) on statically-rendered pages,
  // then reveal the real count once hydrated.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const count = mounted ? (cartCtx?.cart?.count ?? 0) : 0;

  // kk-pop the cart count whenever it changes — but never on the initial
  // mount reveal (skip until after the first post-mount render).
  const prevCount = useRef(0);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (!mounted || count === prevCount.current) return;
    prevCount.current = count;
    setPop(true);
    const timer = window.setTimeout(() => {
      setPop(false);
    }, 600);
    return () => {
      window.clearTimeout(timer);
    };
  }, [count, mounted]);

  // Close the mobile menu after any navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const openCart = (): void => {
    if (cartCtx !== null) {
      cartCtx.openDrawer();
    } else {
      router.push("/cart");
    }
  };

  const isActive = (activeOn: readonly string[]): boolean =>
    activeOn.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  return (
    <>
      <header
        className={cx(
          "sticky top-0 z-40 border-b border-line bg-cream/80 backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-300 supports-[backdrop-filter]:bg-cream/70",
          scrolled ? "shadow-[0_6px_24px_rgba(42,29,18,0.13)]" : "shadow-soft",
        )}
      >
        <div
          className={cx(
            "mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-8 transition-[height] duration-300 ease-brand max-[1000px]:gap-2.5 max-[1000px]:px-[22px] max-[680px]:gap-1 max-[680px]:px-4",
            scrolled ? "h-[60px]" : "h-[74px]",
          )}
        >
          <Link href="/" aria-label="Kakao home" className={cx("no-underline", FOCUS_RING)}>
            <BrandLockup size="header" />
          </Link>

          <nav
            aria-label="Primary"
            className="flex items-center gap-[30px] max-[1000px]:hidden"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                aria-current={isActive(link.activeOn) ? "page" : undefined}
                className={cx(
                  "relative p-0 font-body text-[14.5px] font-semibold text-ink no-underline transition-colors hover:text-espresso",
                  "after:absolute after:-bottom-[7px] after:left-0 after:right-0 after:h-[1.5px] after:origin-left after:bg-espresso after:transition-transform after:duration-300 after:ease-[cubic-bezier(.2,.7,.3,1)] after:content-['']",
                  isActive(link.activeOn)
                    ? "after:scale-x-100"
                    : "after:scale-x-0 hover:after:scale-x-100",
                  FOCUS_RING,
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title="Menu"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((current) => !current);
              }}
              className={cx(
                "hidden h-10 w-10 place-items-center rounded-pill text-xl text-ink transition-colors hover:bg-[#F0E4D2] max-[1000px]:grid",
                FOCUS_RING,
              )}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <button
              type="button"
              title="Search"
              aria-label="Search"
              onClick={() => {
                setSearchOpen(true);
              }}
              className={ICON_BUTTON_CLASSES}
            >
              <SearchIcon />
            </button>
            <AccountControl auth={auth} />
            <button
              type="button"
              title="Cart"
              aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
              onClick={openCart}
              className={cx(
                "relative flex h-10 items-center gap-1.5 rounded-pill px-3 font-body text-sm font-semibold text-ink transition-colors hover:bg-[#F0E4D2]",
                FOCUS_RING,
              )}
            >
              <span className="inline-flex [perspective:360px]">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="origin-center animate-[kk-flip-y_2.6s_linear_infinite] [transform-style:preserve-3d] drop-shadow-[0_1.5px_1.5px_rgba(42,29,18,0.35)] motion-reduce:animate-none"
                >
                  <defs>
                    <linearGradient id="kk-bag-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d9ac5e" />
                      <stop offset="100%" stopColor="#8a5a34" />
                    </linearGradient>
                  </defs>
                  {/* Filled bag body (chocolate sheen) + darker handle for depth. */}
                  <path
                    d="M5 7.5h14l-1.05 11.6a2.2 2.2 0 0 1-2.19 2H8.24a2.2 2.2 0 0 1-2.19-2L5 7.5Z"
                    fill="url(#kk-bag-grad)"
                  />
                  <path
                    d="M8.7 7.5V6.6a3.3 3.3 0 0 1 6.6 0v.9"
                    fill="none"
                    stroke="#6b4423"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className={pop ? "animate-[kk-pop_.45s_ease]" : undefined}>
                {count}
              </span>
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="sticky top-[74px] z-[38] flex flex-col gap-0.5 border-b border-line bg-cream px-5 pt-2.5 pb-4 shadow-[0_12px_24px_rgba(42,29,18,.08)] animate-[kk-menu_.22s_ease]">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSearchOpen(true);
            }}
            className={cx(
              "flex items-center gap-2.5 border-b border-[#F0E4D2] px-1.5 py-[13px] text-left font-body text-base font-semibold text-ink",
              FOCUS_RING,
            )}
          >
            <SearchIcon />
            Search
          </button>
          {MOBILE_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => {
                setMenuOpen(false);
              }}
              className={cx(
                "border-b border-[#F0E4D2] px-1.5 py-[13px] font-body text-base font-semibold text-ink no-underline",
                FOCUS_RING,
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/account"
            onClick={() => {
              setMenuOpen(false);
            }}
            className={cx(
              "px-1.5 py-[13px] font-body text-base font-semibold text-espresso no-underline",
              FOCUS_RING,
            )}
          >
            My account
          </Link>
        </div>
      ) : null}

      <SearchOverlay
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
        }}
      />
    </>
  );
}

function PersonIcon(): ReactNode {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

/**
 * Header account affordance (auth-otp.md §2): anonymous → open the login
 * sheet; signed-in → link to `/account` with an initials avatar. Falls back
 * to a plain `/account` link when no auth context is mounted (defensive).
 */
function AccountControl({
  auth,
}: {
  auth: AuthContextValue | null;
}): ReactNode {
  if (auth === null) {
    return (
      <Link
        href="/account"
        title="Account"
        aria-label="Account"
        className={cx("max-[680px]:hidden", ICON_BUTTON_CLASSES)}
      >
        <PersonIcon />
      </Link>
    );
  }

  if (auth.customer !== null) {
    return (
      <Link
        href="/account"
        title="Your account"
        aria-label="Your account"
        className={cx(
          "grid h-10 w-10 place-items-center rounded-pill no-underline transition-transform hover:scale-105 max-[680px]:hidden",
          FOCUS_RING,
        )}
      >
        <CustomerAvatar
          name={auth.customer.name}
          phone={auth.customer.phone}
          email={auth.customer.email}
          size={38}
        />
      </Link>
    );
  }

  return (
    <button
      type="button"
      title="Sign in"
      aria-label="Sign in"
      onClick={() => {
        auth.open();
      }}
      className={cx("max-[680px]:hidden", ICON_BUTTON_CLASSES)}
    >
      <PersonIcon />
    </button>
  );
}
