"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cx } from "@kakoa/ui";
import { useAuthOptional, type AuthContextValue } from "@/components/auth/AuthProvider";
import { CustomerAvatar } from "@/components/auth/CustomerAvatar";
import { BrandLockup } from "./BrandMark";
import { MegaMenu } from "./MegaMenu";
import { SearchOverlay } from "./SearchOverlay";
import { useCartChrome } from "./useCartChrome";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

/** Desktop nav — inline links (≥1000px). `activeOn` drives the active
 * underline; `mega` marks the item that opens the Shop mega-menu on hover/focus. */
const NAV_LINKS = [
  { href: "/shop", label: "Shop", activeOn: ["/shop", "/product"], mega: true },
  { href: "/shop?category=gifts", label: "Gifts", activeOn: [], mega: false },
  { href: "/about", label: "Our Story", activeOn: ["/about"], mega: false },
  { href: "/journal", label: "Journal", activeOn: ["/journal"], mega: false },
] as const;

/**
 * Mobile menu (< 1000px) — primary nav shown as a serif list. `children`, when
 * present, renders an inline accordion (the collections drill-down).
 * Subscription & gift cards are deferred (PROJECT_PLAN §6).
 */
const MOBILE_PRIMARY = [
  {
    label: "Shop",
    href: "/shop",
    children: [
      { href: "/shop", label: "All chocolate" },
      { href: "/shop?category=bars", label: "Bars" },
      { href: "/shop?category=pralines", label: "Pralines" },
      { href: "/shop?category=signature", label: "Signature" },
      { href: "/shop?category=gifts", label: "Gifts" },
    ],
  },
  { label: "Gifts", href: "/shop?category=gifts" },
  { label: "Our Story", href: "/about" },
  { label: "Journal", href: "/journal" },
] as const;

/** Mobile menu — secondary utility links (accent colour, below the primary list). */
const MOBILE_SECONDARY = [
  { href: "/support", label: "Help centre" },
  { href: "/locator", label: "Store locator" },
  { href: "/account/track", label: "Track an order" },
] as const;

const ICON_BUTTON_CLASSES = cx(
  "grid h-10 w-10 place-items-center rounded-pill text-ink transition-colors hover:bg-cream-2",
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

function MenuIcon(): ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon(): ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Chevron used by the mobile accordion — rotates 180° when its section is open. */
function Chevron({ open }: { open: boolean }): ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx(
        "transition-transform duration-300 ease-brand motion-reduce:transition-none",
        open && "rotate-180",
      )}
    >
      <path d="M6 9l6 6 6-6" />
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
  // Which mobile-menu accordion section is expanded (by label), or null.
  const [openSection, setOpenSection] = useState<string | null>(null);

  // Desktop "Shop" mega-menu. Opens on hover/focus of the Shop trigger (or the
  // panel); a short close delay bridges the gap between the trigger and panel so
  // the pointer can travel between them without the menu flickering shut.
  const [megaOpen, setMegaOpen] = useState(false);
  const megaCloseTimer = useRef<number | undefined>(undefined);
  const openMega = (): void => {
    if (megaCloseTimer.current !== undefined) window.clearTimeout(megaCloseTimer.current);
    setMegaOpen(true);
  };
  const closeMegaSoon = (): void => {
    if (megaCloseTimer.current !== undefined) window.clearTimeout(megaCloseTimer.current);
    megaCloseTimer.current = window.setTimeout(() => setMegaOpen(false), 120);
  };
  const closeMegaNow = (): void => {
    if (megaCloseTimer.current !== undefined) window.clearTimeout(megaCloseTimer.current);
    setMegaOpen(false);
  };
  useEffect(
    () => () => {
      if (megaCloseTimer.current !== undefined) window.clearTimeout(megaCloseTimer.current);
    },
    [],
  );
  // Close the mega-menu on Escape (focus stays where the user left it).
  useEffect(() => {
    if (!megaOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMegaOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [megaOpen]);

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

  // Close the mobile menu and Shop mega-menu after any navigation.
  useEffect(() => {
    setMenuOpen(false);
    setMegaOpen(false);
  }, [pathname]);

  // While the full-screen mobile menu is open: lock body scroll and close on
  // Escape. Collapses any expanded accordion section when the menu closes.
  useEffect(() => {
    if (!menuOpen) {
      setOpenSection(null);
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

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

  // Shared action controls, reused by the desktop (inline) and mobile (centered)
  // header layouts so the cart bag/count markup isn't duplicated.
  const searchButton = (
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
  );

  const cartButton = (
    <button
      type="button"
      title="Cart"
      aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
      onClick={openCart}
      className={cx(
        "relative flex h-10 items-center gap-1.5 rounded-pill px-3 font-body text-sm font-semibold text-ink transition-colors hover:bg-cream-2",
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
            "mx-auto max-w-[1240px] px-5 transition-[height] duration-300 ease-brand sm:px-8",
            scrolled ? "h-[60px]" : "h-[72px]",
          )}
        >
          {/* DESKTOP (≥1000px) — unchanged: logo left · inline nav · actions right */}
          <div className="hidden h-full items-center justify-between gap-6 min-[1000px]:flex">
            <Link href="/" aria-label="KAKOA home" className={cx("no-underline", FOCUS_RING)}>
              <BrandLockup size="header" />
            </Link>
            <nav
              aria-label="Primary"
              className="flex items-center gap-[30px]"
              onMouseLeave={closeMegaSoon}
            >
              {NAV_LINKS.map((link) => {
                const active = isActive(link.activeOn);
                const megaProps = link.mega
                  ? {
                      "aria-haspopup": "menu" as const,
                      "aria-expanded": megaOpen,
                      onMouseEnter: openMega,
                      onFocus: openMega,
                    }
                  : { onMouseEnter: closeMegaNow };
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    {...megaProps}
                    className={cx(
                      "relative flex items-center p-0 font-body text-[14.5px] font-semibold text-ink no-underline transition-colors hover:text-espresso",
                      "after:absolute after:-bottom-[7px] after:left-0 after:right-0 after:h-[1.5px] after:origin-left after:bg-espresso after:transition-transform after:duration-300 after:ease-[cubic-bezier(.2,.7,.3,1)] after:content-['']",
                      active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
                      FOCUS_RING,
                    )}
                  >
                    {link.label}
                    {link.mega ? (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className={cx(
                          "ml-1 text-espresso/70 transition-transform duration-[var(--duration-base)] ease-brand motion-reduce:transition-none",
                          megaOpen && "rotate-180",
                        )}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            {megaOpen ? (
              <div
                role="region"
                aria-label="Shop menu"
                onMouseEnter={openMega}
                onMouseLeave={closeMegaSoon}
                className="absolute inset-x-0 top-full z-40 border-b border-line bg-cream shadow-[0_22px_44px_-18px_rgba(42,29,18,0.30)] animate-[kk-rise_.2s_var(--ease-entrance)] motion-reduce:animate-none"
              >
                <MegaMenu onNavigate={closeMegaNow} />
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              {searchButton}
              <AccountControl auth={auth} />
              {cartButton}
            </div>
          </div>

          {/* MOBILE (<1000px) — centered logo: menu left · logo center · search+cart right */}
          <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center gap-2 min-[1000px]:hidden">
            <div className="flex items-center justify-self-start">
              <button
                type="button"
                title={menuOpen ? "Close menu" : "Menu"}
                aria-label={menuOpen ? "Close menu" : "Menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                onClick={() => {
                  setMenuOpen((current) => !current);
                }}
                className={cx(
                  "relative z-[46] inline-flex items-center gap-2 rounded-pill px-2.5 py-2 text-ink transition-colors hover:bg-cream-2",
                  FOCUS_RING,
                )}
              >
                {menuOpen ? <CloseIcon /> : <MenuIcon />}
                <span className="font-body text-[13px] font-semibold max-[680px]:hidden">
                  {menuOpen ? "Close" : "Menu"}
                </span>
              </button>
            </div>
            <Link
              href="/"
              aria-label="KAKOA home"
              className={cx("justify-self-center no-underline", FOCUS_RING)}
            >
              <BrandLockup size="header" />
            </Link>
            <div className="flex items-center justify-self-end gap-0.5">
              {searchButton}
              {cartButton}
            </div>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col bg-cream animate-[kk-overlay_.25s_ease] min-[1000px]:hidden"
        >
          {/* Menu's own top bar — mirrors the header: close · logo · cart. */}
          <div className="flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-line px-5 sm:px-8">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => {
                setMenuOpen(false);
              }}
              className={cx(
                "inline-flex items-center gap-2 rounded-pill px-2.5 py-2 text-ink transition-colors hover:bg-cream-2",
                FOCUS_RING,
              )}
            >
              <CloseIcon />
              <span className="font-body text-[13px] font-semibold max-[680px]:hidden">
                Close
              </span>
            </button>
            <Link
              href="/"
              aria-label="KAKOA home"
              onClick={() => {
                setMenuOpen(false);
              }}
              className={cx("no-underline", FOCUS_RING)}
            >
              <BrandLockup size="header" />
            </Link>
            <div className="flex items-center gap-0.5">{cartButton}</div>
          </div>

          {/* Scrollable menu body. */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] animate-[kk-rise_.34s_var(--ease-entrance)]">
            {/* Search launcher */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
              className={cx(
                "mb-6 flex w-full items-center gap-3 rounded-2xl border border-line-soft bg-surface px-4 py-3.5 text-left font-body text-[15px] font-medium text-ink-muted shadow-soft transition-colors hover:bg-card",
                FOCUS_RING,
              )}
            >
              <SearchIcon />
              Search chocolate…
            </button>

            {/* Primary — serif list, hairline dividers, collections accordion. */}
            <nav aria-label="Primary" className="border-t border-line">
              {MOBILE_PRIMARY.map((item) => {
                const kids = "children" in item ? item.children : null;
                const expanded = openSection === item.label;
                return (
                  <div key={item.label} className="border-b border-line">
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        onClick={() => {
                          setMenuOpen(false);
                        }}
                        aria-current={isActive([item.href]) ? "page" : undefined}
                        className={cx(
                          "flex-1 py-[18px] font-display text-[26px] leading-none text-ink no-underline transition-colors hover:text-espresso",
                          FOCUS_RING,
                        )}
                      >
                        {item.label}
                      </Link>
                      {kids !== null ? (
                        <button
                          type="button"
                          aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label}`}
                          aria-expanded={expanded}
                          onClick={() => {
                            setOpenSection(expanded ? null : item.label);
                          }}
                          className={cx(
                            "-mr-1.5 grid h-12 w-12 place-items-center rounded-pill text-espresso transition-colors hover:bg-card",
                            FOCUS_RING,
                          )}
                        >
                          <Chevron open={expanded} />
                        </button>
                      ) : null}
                    </div>
                    {kids !== null && expanded ? (
                      <ul className="animate-[kk-rise_.24s_var(--ease-entrance)] pb-3 pl-1">
                        {kids.map((child) => (
                          <li key={child.label}>
                            <Link
                              href={child.href}
                              onClick={() => {
                                setMenuOpen(false);
                              }}
                              className={cx(
                                "block py-2.5 font-body text-[15px] font-medium text-ink-soft no-underline transition-colors hover:text-espresso",
                                FOCUS_RING,
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </nav>

            {/* Secondary — utility links + account. */}
            <nav aria-label="More" className="mt-8 flex flex-col items-start gap-1.5">
              {MOBILE_SECONDARY.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                  className={cx(
                    "rounded-sm py-1.5 font-body text-[14.5px] font-semibold text-espresso no-underline transition-colors hover:text-ink",
                    FOCUS_RING,
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {auth?.customer != null ? (
                <Link
                  href="/account"
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                  className={cx(
                    "rounded-sm py-1.5 font-body text-[14.5px] font-semibold text-espresso no-underline transition-colors hover:text-ink",
                    FOCUS_RING,
                  )}
                >
                  My account
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (auth !== null) auth.open();
                    else router.push("/login");
                  }}
                  className={cx(
                    "rounded-sm py-1.5 text-left font-body text-[14.5px] font-semibold text-espresso transition-colors hover:text-ink",
                    FOCUS_RING,
                  )}
                >
                  Sign in
                </button>
              )}
            </nav>
          </div>
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
