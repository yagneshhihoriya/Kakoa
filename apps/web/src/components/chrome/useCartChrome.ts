"use client";

import type { CartView } from "@kakoa/core";
import { useCart } from "@/components/cart/CartProvider";

/**
 * The slice of CartProvider context the global chrome consumes — the
 * pinned shared cart interface (Module 2). Everything beyond the pinned
 * members is optional so the chrome stays a pure *visual shell*: it renders
 * an empty-bag state and inert steppers until (or unless) the cart module's
 * optimistic wrappers are present, and never throws.
 */
export interface ChromeCartContext {
  cart: CartView | null;
  pending: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Optimistic wrapper over `updateCartItem` (qty 0 = remove). */
  updateItem?: (input: { itemId: string; qty: number }) => unknown;
  updateCartItem?: (input: { itemId: string; qty: number }) => unknown;
  /** Optimistic wrapper over `removeCartItem`. */
  removeItem?: (input: { itemId: string }) => unknown;
  removeCartItem?: (input: { itemId: string }) => unknown;
}

/**
 * Defensive optional hook — returns `null` instead of throwing when the
 * chrome is rendered outside a <CartProvider> (e.g. isolated previews or
 * before the cart module is mounted). Header count + CartDrawer treat
 * `null` exactly like an empty cart.
 */
export function useCartChrome(): ChromeCartContext | null {
  try {
    return useCart() as unknown as ChromeCartContext;
  } catch {
    return null;
  }
}
