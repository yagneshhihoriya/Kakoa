/**
 * Cart data layer barrel — Module 2 (docs/modules/cart.md).
 *
 * NOTE: `./actions` is a 'use server' module — import the actions
 * directly from '@/lib/cart/actions' in client components; this barrel
 * exists for server-side consumers (route handlers, RSC pages).
 */
export {
  addToCart,
  applyCoupon,
  getCart,
  removeCartItem,
  removeCoupon,
  setGiftOptions,
  updateCartItem,
} from './actions';
export {
  CART_COOKIE_NAME,
  CART_COOKIE_MAX_AGE_SECONDS,
  clearCartCookie,
  readCartToken,
  rotateCartCookie,
  setCartCookie,
  signCartToken,
  verifyCartCookieValue,
} from './cookies';
