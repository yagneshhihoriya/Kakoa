/**
 * GET /api/cart — Module 2 (docs/modules/cart.md §5).
 *
 * Returns `ApiOk<{ cart: CartView }>` — NEVER 404: no/invalid/tampered
 * cookie resolves to an empty CartView with zero error surfaced (no
 * oracle). `Cache-Control: no-store` — the cart is per-user, live-priced,
 * live-stocked; any cache would violate "never lie about price or stock".
 * Rate limiting (Class B) is middleware-owned.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { getCart } from '@/lib/cart/actions';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const cart = await getCart();
    return jsonOk({ cart }, { cacheControl: NO_STORE });
  } catch {
    return jsonErr('INTERNAL', 'Something went wrong. Please try again.');
  }
}
