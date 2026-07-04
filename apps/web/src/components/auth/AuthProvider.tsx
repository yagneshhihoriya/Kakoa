"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import type { ApiResult, CustomerView } from "@kakoa/core";
import { LoginSheet } from "./LoginSheet";

/** Hydration status of the initial `GET /api/auth/me` read. */
export type AuthStatus = "loading" | "ready";

export interface AuthContextValue {
  /** Signed-in customer projection, or `null` when anonymous. */
  customer: CustomerView | null;
  /** `loading` until the first `/api/auth/me` settles, then `ready`. */
  status: AuthStatus;
  /** Whether the login sheet is open. */
  isOpen: boolean;
  /**
   * Open the login sheet. `reason` (e.g. "wishlist", "checkout") is surfaced
   * as a subheading so the customer knows why they were prompted.
   */
  open: (reason?: string) => void;
  /** Close the login sheet without signing in. */
  close: () => void;
  /** Re-fetch `/api/auth/me` — called after verify/logout to reconcile. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Access the auth context. Must render inside `<AuthProvider>`. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
}

/**
 * Optional access to auth outside a provider (server-rendered islands that
 * may or may not be wrapped). Returns `null` rather than throwing so the
 * wishlist heart can degrade to a plain link when unmounted from context.
 */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}

/**
 * Module 3 client auth state (docs/modules/auth-otp.md §2). Hydrates from
 * `GET /api/auth/me` on mount (401 → anonymous, never an error surface), and
 * renders the `<LoginSheet>` when `open()` is called from the header account
 * icon, the wishlist heart, or the `?login=1` deep-link. On successful verify
 * the sheet calls `refresh()` so `customer` reconciles to server truth.
 */
export function AuthProvider({
  children,
}: Readonly<{ children: ReactNode }>): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [customer, setCustomer] = useState<CustomerView | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const result = (await response.json()) as ApiResult<{
        customer: CustomerView;
      }>;
      setCustomer(result.ok ? result.data.customer : null);
    } catch {
      // Network blip — treat as anonymous; the rest of the page stays usable.
      setCustomer(null);
    } finally {
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = useCallback((nextReason?: string): void => {
    setReason(nextReason);
    setIsOpen(true);
  }, []);

  const close = useCallback((): void => {
    setIsOpen(false);
  }, []);

  // `?login=1` deep-link (e.g. account page redirect) opens the sheet once,
  // then strips the param so a refresh/back doesn't re-open it.
  useEffect(() => {
    if (status !== "ready") return;
    if (searchParams.get("login") !== "1") return;
    if (customer !== null) {
      // Already signed in — just clean the URL.
      router.replace(pathname as Route);
      return;
    }
    setIsOpen(true);
    router.replace(pathname as Route);
  }, [status, searchParams, customer, pathname, router]);

  const value = useMemo<AuthContextValue>(
    () => ({ customer, status, isOpen, open, close, refresh }),
    [customer, status, isOpen, open, close, refresh],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginSheet isOpen={isOpen} reason={reason} onClose={close} />
    </AuthContext.Provider>
  );
}
