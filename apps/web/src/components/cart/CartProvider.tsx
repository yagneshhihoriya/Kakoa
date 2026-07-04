"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import type { ApiResult, CartView } from "@kakoa/core";
import { useToast } from "@kakoa/ui/client";
import {
  addToCart,
  applyCoupon,
  removeCartItem,
  removeCoupon,
  setGiftOptions,
  updateCartItem,
} from "@/lib/cart/actions";

/** Contract merge cap (PROJECT_PLAN §2.3) — optimistic qty clamp mirror. */
const MAX_QTY = 20;

type CartLine = CartView["lines"][number];

/** Hydration status of the initial `GET /api/cart` read. */
export type CartStatus = "loading" | "error" | "ready";

export interface AddItemInput {
  variantId: string;
  qty: number;
  giftWrap?: boolean;
  giftMessage?: string;
  /**
   * LIVE unit price in integer paise, if the caller has it (PDP/card knows the
   * variant price). Lets the optimistic reducer bump the subtotal for a
   * brand-new line so the badge and drawer summary stay directionally
   * consistent ("count up" ⇒ "total up") until the server reconciles the real
   * line. Omit when unknown — the reducer falls back to a count-only bump.
   */
  unitPricePaise?: number;
}

export interface CartContextValue {
  /** Optimistic view — server truth reconciles when actions settle. */
  cart: CartView | null;
  status: CartStatus;
  /** True while any cart mutation is in flight. */
  pending: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Re-fetch `/api/cart` (inline retry panel per module doc). */
  refresh: () => Promise<void>;
  /** Optimistic add — opens the drawer on success unless `openDrawer: false`. */
  addItem: (
    input: AddItemInput,
    options?: { openDrawer?: boolean },
  ) => Promise<ApiResult<CartView>>;
  /** Optimistic qty set — `qty 0` removes the line (Contract). */
  updateItem: (input: {
    itemId: string;
    qty: number;
  }) => Promise<ApiResult<CartView>>;
  /** Optimistic line removal. */
  removeItem: (input: { itemId: string }) => Promise<ApiResult<CartView>>;
  /** Per-line gift wrap toggle + ≤300-char message. */
  setGift: (input: {
    itemId: string;
    giftWrap: boolean;
    giftMessage?: string;
  }) => Promise<ApiResult<CartView>>;
  /** No toast on failure — callers render the inline coupon error. */
  applyCouponCode: (input: { code: string }) => Promise<ApiResult<CartView>>;
  removeCouponCode: () => Promise<ApiResult<CartView>>;
}

/* ------------------------------------------------------------------ */
/* Optimistic reducer                                                  */
/* ------------------------------------------------------------------ */

type OptimisticOp =
  | { kind: "add"; variantId: string; qty: number; unitPricePaise?: number }
  | { kind: "qty"; itemId: string; qty: number }
  | { kind: "remove"; itemId: string }
  | { kind: "gift"; itemId: string; giftWrap: boolean; giftMessage: string | null };

/** New qty on a line — clamp to 1..20, keep line total in integer paise. */
function withQty(line: CartLine, qty: number): CartLine {
  const clamped = Math.min(MAX_QTY, Math.max(1, qty));
  return {
    ...line,
    qty: clamped,
    lineTotalPaise: line.unitPricePaise * clamped,
  };
}

/**
 * Recompute the derived money fields after an optimistic line change.
 * Unavailable lines (`stockState: 'out'`) are excluded from the subtotal
 * (module doc edge case #4); coupon/gift-wrap totals are left as-is — the
 * server response is the only authority and reconciles them.
 */
function recompute(cart: CartView, lines: CartLine[]): CartView {
  const subtotalPaise = lines
    .filter((line) => line.stockState !== "out")
    .reduce((sum, line) => sum + line.unitPricePaise * line.qty, 0);
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  return { ...cart, lines, subtotalPaise, count };
}

function optimisticReducer(
  cart: CartView | null,
  op: OptimisticOp,
): CartView | null {
  if (cart === null) return cart;
  switch (op.kind) {
    case "add": {
      const existing = cart.lines.find((l) => l.variantId === op.variantId);
      if (existing === undefined) {
        // New variant: the full line shape (itemId/name/tone/slug) lives
        // server-side, so we can't fabricate a real line without rendering
        // garbage in the drawer. We DON'T append a provisional line; instead we
        // keep the two summary numbers directionally consistent — bump `count`
        // always, and bump `subtotalPaise` too when the caller passed the live
        // unit price (avoids "count up, total unchanged"). The reconciled
        // CartView replaces both with server truth and fills the line in.
        return {
          ...cart,
          count: cart.count + op.qty,
          subtotalPaise:
            op.unitPricePaise !== undefined
              ? cart.subtotalPaise + op.unitPricePaise * op.qty
              : cart.subtotalPaise,
        };
      }
      return recompute(
        cart,
        cart.lines.map((l) =>
          l.itemId === existing.itemId ? withQty(l, l.qty + op.qty) : l,
        ),
      );
    }
    case "qty": {
      if (op.qty <= 0) {
        return recompute(
          cart,
          cart.lines.filter((l) => l.itemId !== op.itemId),
        );
      }
      return recompute(
        cart,
        cart.lines.map((l) =>
          l.itemId === op.itemId ? withQty(l, op.qty) : l,
        ),
      );
    }
    case "remove":
      return recompute(
        cart,
        cart.lines.filter((l) => l.itemId !== op.itemId),
      );
    case "gift":
      return recompute(
        cart,
        cart.lines.map((l) =>
          l.itemId === op.itemId
            ? { ...l, giftWrap: op.giftWrap, giftMessage: op.giftMessage }
            : l,
        ),
      );
  }
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

const CartContext = createContext<CartContextValue | null>(null);

/** Access the cart context. Must render inside `<CartProvider>`. */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context === null) {
    throw new Error("useCart must be used within a <CartProvider>");
  }
  return context;
}

/**
 * Module 2 client cart state (docs/modules/cart.md): hydrates from
 * `GET /api/cart` on mount (never 404s — empty cart when no cookie), then
 * runs every mutation optimistically via `useOptimistic`. Server truth
 * always wins on reconcile; an `ApiErr` rolls the optimistic change back
 * automatically (the transition settles against the unchanged base cart)
 * and surfaces `error.message` as a toast (edge case #6). Double-tap "+"
 * races converge to the server-clamped value, not the last guess.
 */
export function CartProvider({
  children,
  initialCart = null,
}: Readonly<{ children: ReactNode; initialCart?: CartView | null }>): ReactNode {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  // Seed from the server-read cart so the header count matches SSR on first
  // paint (no hydration mismatch, no 0→N flash). A background refresh still
  // reconciles to live prices/stock after mount.
  const [serverCart, setServerCart] = useState<CartView | null>(initialCart);
  const [status, setStatus] = useState<CartStatus>(
    initialCart !== null ? "ready" : "loading",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cart, applyOptimistic] = useOptimistic(serverCart, optimisticReducer);

  const refresh = useCallback(async (): Promise<void> => {
    setStatus("loading");
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      const result = (await response.json()) as ApiResult<{ cart: CartView }>;
      if (result.ok) {
        setServerCart(result.data.cart);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    } catch {
      // Rest of the page stays interactive; cart surfaces retry panels.
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDrawer = useCallback((): void => {
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback((): void => {
    setDrawerOpen(false);
  }, []);

  /**
   * Shared mutation runner: apply the optimistic op, await the Server
   * Action, reconcile to the returned CartView on success. On `ApiErr` the
   * optimistic layer reverts by itself; `toastOnError` controls the rollback
   * toast (coupon flows render inline errors instead).
   */
  const runMutation = useCallback(
    (
      op: OptimisticOp | null,
      call: () => Promise<ApiResult<CartView>>,
      options?: { toastOnError?: boolean; onSuccess?: (cart: CartView) => void },
    ): Promise<ApiResult<CartView>> =>
      new Promise((resolve) => {
        startTransition(async () => {
          if (op !== null) applyOptimistic(op);
          const result = await call();
          if (result.ok) {
            setServerCart(result.data);
            setStatus("ready");
            options?.onSuccess?.(result.data);
          } else if (options?.toastOnError !== false) {
            toast({ kind: "error", message: result.error.message });
          }
          resolve(result);
        });
      }),
    [applyOptimistic, toast],
  );

  const addItem = useCallback(
    (
      input: AddItemInput,
      options?: { openDrawer?: boolean },
    ): Promise<ApiResult<CartView>> =>
      runMutation(
        {
          kind: "add",
          variantId: input.variantId,
          qty: input.qty,
          ...(input.unitPricePaise !== undefined
            ? { unitPricePaise: input.unitPricePaise }
            : {}),
        },
        // `unitPricePaise` is client-only (optimistic subtotal bump); the
        // action's `.strict()` schema rejects unknown keys, so pass only the
        // fields the contract accepts.
        () =>
          addToCart({
            variantId: input.variantId,
            qty: input.qty,
            ...(input.giftWrap !== undefined ? { giftWrap: input.giftWrap } : {}),
            ...(input.giftMessage !== undefined
              ? { giftMessage: input.giftMessage }
              : {}),
          }),
        {
          onSuccess: () => {
            if (options?.openDrawer !== false) setDrawerOpen(true);
          },
        },
      ),
    [runMutation],
  );

  const updateItem = useCallback(
    (input: { itemId: string; qty: number }): Promise<ApiResult<CartView>> =>
      runMutation({ kind: "qty", itemId: input.itemId, qty: input.qty }, () =>
        updateCartItem(input),
      ),
    [runMutation],
  );

  const removeItem = useCallback(
    (input: { itemId: string }): Promise<ApiResult<CartView>> =>
      runMutation({ kind: "remove", itemId: input.itemId }, () =>
        removeCartItem(input),
      ),
    [runMutation],
  );

  const setGift = useCallback(
    (input: {
      itemId: string;
      giftWrap: boolean;
      giftMessage?: string;
    }): Promise<ApiResult<CartView>> =>
      runMutation(
        {
          kind: "gift",
          itemId: input.itemId,
          giftWrap: input.giftWrap,
          giftMessage:
            input.giftMessage !== undefined && input.giftMessage.trim() !== ""
              ? input.giftMessage
              : null,
        },
        () => setGiftOptions(input),
      ),
    [runMutation],
  );

  const applyCouponCode = useCallback(
    (input: { code: string }): Promise<ApiResult<CartView>> =>
      runMutation(null, () => applyCoupon(input), { toastOnError: false }),
    [runMutation],
  );

  const removeCouponCode = useCallback(
    (): Promise<ApiResult<CartView>> =>
      runMutation(null, () => removeCoupon(), { toastOnError: false }),
    [runMutation],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      status,
      pending,
      drawerOpen,
      openDrawer,
      closeDrawer,
      refresh,
      addItem,
      updateItem,
      removeItem,
      setGift,
      applyCouponCode,
      removeCouponCode,
    }),
    [
      cart,
      status,
      pending,
      drawerOpen,
      openDrawer,
      closeDrawer,
      refresh,
      addItem,
      updateItem,
      removeItem,
      setGift,
      applyCouponCode,
      removeCouponCode,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
