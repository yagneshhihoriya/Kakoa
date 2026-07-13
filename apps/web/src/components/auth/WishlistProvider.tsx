"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuthOptional } from "./AuthProvider";

interface WishlistContextValue {
  isSaved: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

/**
 * Client wishlist state. Loads the signed-in customer's saved product ids once
 * (GET /api/wishlist) so hearts render filled/outline correctly everywhere, and
 * toggles optimistically via POST/DELETE. Guests keep an empty set (the heart
 * opens the login sheet). Mounted inside AuthProvider.
 */
export function WishlistProvider({ children }: { children: ReactNode }): ReactNode {
  const auth = useAuthOptional();
  const signedIn = auth?.customer != null;
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!signedIn) {
      setIds(new Set());
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/wishlist");
        const data = await res.json();
        if (alive && data.ok) setIds(new Set<string>(data.data.productIds));
      } catch {
        /* leave empty on failure */
      }
    })();
    return () => {
      alive = false;
    };
  }, [signedIn]);

  const isSaved = useCallback((productId: string) => ids.has(productId), [ids]);

  const toggle = useCallback(
    async (productId: string): Promise<void> => {
      const currently = ids.has(productId);
      setIds((prev) => {
        const next = new Set(prev);
        if (currently) next.delete(productId);
        else next.add(productId);
        return next;
      });
      try {
        const res = await fetch("/api/wishlist", {
          method: currently ? "DELETE" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error("failed");
      } catch {
        // Revert on failure.
        setIds((prev) => {
          const next = new Set(prev);
          if (currently) next.add(productId);
          else next.delete(productId);
          return next;
        });
      }
    },
    [ids],
  );

  return <WishlistContext.Provider value={{ isSaved, toggle }}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue | null {
  return useContext(WishlistContext);
}
