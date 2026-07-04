/**
 * Checkout quote engine — checkout.md §5.2 (`POST /api/checkout/quote`).
 *
 * `computeQuote` is the single money-truthful path: it loads the ACTIVE cart,
 * re-verifies LIVE stock per line, re-validates the coupon, checks
 * serviceability + COD eligibility, and computes every rupee figure the Review
 * step displays — the client never sends a price. Nothing here is cached (§3).
 *
 * The MONEY MODEL (mirrors the `orders` CHECK exactly):
 *   subtotal   = Σ(unit_price × qty)                      (GST-inclusive)
 *   giftWrap   = Σ(giftWrap ? gift_wrap_fee : 0)
 *   line_total = unit × qty + (giftWrap ? fee : 0)
 *   total      = subtotal − discount + shipping + cod_fee + giftWrap
 * GST is EXTRACTED per line from the inclusive line product value (unit × qty),
 * split CGST/SGST when ship-to state == seller state else IGST — informational.
 *
 * The pure `computeQuoteMoney` core is DB-free so the money math is unit-tested
 * without a database; `computeQuote` wraps it with the live reads.
 *
 * SERVER-ONLY: uses @kakoa/db.
 */
import {
  addPaise,
  estimateCouponDiscount,
  multiplyPaise,
  splitGst,
  taxFromInclusive,
  toPaise,
  type CartLineView,
  type CheckoutQuote,
  type DeliveryOption,
  type PaymentMode,
  type QuoteTaxIncluded,
} from '@kakoa/core';
import {
  carts,
  cartItems,
  coupons,
  db,
  products,
  productVariants,
} from '@kakoa/db';
import { and, asc, eq } from 'drizzle-orm';

import { getShippingProvider } from '@kakoa/integrations';

import { getCart } from '@/lib/cart/actions';
import { readCartToken } from '@/lib/cart/cookies';
import {
  loadCheckoutSettings,
  type CheckoutSettings,
} from './settings';

/* ------------------------------------------------------------------ */
/* Typed error result (routes map code → HTTP status)                  */
/* ------------------------------------------------------------------ */

/** Every expected quote failure, matching the §5.2 error registry codes. */
export type QuoteErrorCode =
  | 'CART_EXPIRED'
  | 'OUT_OF_STOCK'
  | 'PINCODE_UNSERVICEABLE'
  | 'COD_UNAVAILABLE'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'COUPON_MIN_NOT_MET'
  | 'COUPON_EXHAUSTED'
  | 'COUPON_LIMIT_REACHED'
  | 'UPSTREAM_ERROR';

/** A per-line sold-out marker (§5.3 `details`). */
export interface StockShortfall {
  variantId: string;
  requested: number;
  available: number;
}

/**
 * Typed quote failure. `computeQuote` throws this for every expected error so
 * the Route Handler maps `.code` → HTTP status with `jsonErr`; `details` carries
 * the OUT_OF_STOCK line list when present.
 */
export class QuoteError extends Error {
  override readonly name = 'QuoteError';
  readonly code: QuoteErrorCode;
  readonly details?: unknown;

  constructor(code: QuoteErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export interface ComputeQuoteInput {
  pincode: string;
  deliveryOption: DeliveryOption;
  paymentMode: PaymentMode;
  couponCode?: string;
}

/* ------------------------------------------------------------------ */
/* Pure money core (DB-free — unit-tested)                             */
/* ------------------------------------------------------------------ */

/** A cart line reduced to exactly what the money math needs. */
export interface QuoteLineInput {
  /** LIVE unit price (GST-inclusive), paise. */
  unitPricePaise: number;
  qty: number;
  giftWrap: boolean;
  /** LIVE GST rate for this variant, basis points (5% = 500). */
  gstRateBp: number;
}

export interface QuoteMoneyInput {
  lines: readonly QuoteLineInput[];
  /** Already-validated discount for the applied coupon (0 when none). */
  discountPaise: number;
  deliveryOption: DeliveryOption;
  /** True ⇒ COD fee added. */
  cod: boolean;
  settings: CheckoutSettings;
  /** True ⇒ ship-to state == seller state ⇒ CGST/SGST; else IGST. */
  intraState: boolean;
}

export interface QuoteMoney {
  subtotalPaise: number;
  giftWrapTotalPaise: number;
  shippingFeePaise: number;
  codFeePaise: number;
  discountPaise: number;
  totalPaise: number;
  taxIncluded: QuoteTaxIncluded;
}

/**
 * The whole money model, pure and deterministic. Shipping is free when the
 * product subtotal reaches the free-shipping threshold, else the settings fee
 * for the chosen option; COD fee applies only for COD. GST is extracted per
 * line from the inclusive product value (unit × qty; gift wrap is a service,
 * not a product line, so it carries no GST here) and summed.
 */
export function computeQuoteMoney(input: QuoteMoneyInput): QuoteMoney {
  const { lines, settings } = input;

  let subtotal = toPaise(0);
  let giftWrapTotal = toPaise(0);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  for (const line of lines) {
    const lineProduct = multiplyPaise(toPaise(line.unitPricePaise), line.qty);
    subtotal = addPaise(subtotal, lineProduct);
    if (line.giftWrap) {
      giftWrapTotal = addPaise(giftWrapTotal, toPaise(settings.giftWrapFeePaise));
    }

    const lineTax = taxFromInclusive(lineProduct, line.gstRateBp);
    const split = splitGst(lineTax, input.intraState);
    cgst += split.cgstPaise;
    sgst += split.sgstPaise;
    igst += split.igstPaise;
  }

  // Shipping: free at/above the threshold, else the option fee.
  const shippingFee =
    subtotal >= settings.freeShippingThresholdPaise &&
    settings.freeShippingThresholdPaise > 0
      ? 0
      : input.deliveryOption === 'express'
        ? settings.shippingFeeExpressPaise
        : settings.shippingFeeStandardPaise;

  const codFee = input.cod ? settings.codFeePaise : 0;

  // Discount can never exceed the subtotal (mirrors the estimate helper).
  const discount = Math.max(0, Math.min(input.discountPaise, subtotal));

  const total = subtotal - discount + shippingFee + codFee + giftWrapTotal;

  return {
    subtotalPaise: subtotal,
    giftWrapTotalPaise: giftWrapTotal,
    shippingFeePaise: shippingFee,
    codFeePaise: codFee,
    discountPaise: discount,
    totalPaise: total,
    taxIncluded: { cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst },
  };
}

/* ------------------------------------------------------------------ */
/* Live-data quote                                                     */
/* ------------------------------------------------------------------ */

/** ETA of the chosen delivery option from the serviceability options. */
function etaFor(
  options: { option: 'standard' | 'express'; etaDaysMin: number; etaDaysMax: number }[],
  chosen: DeliveryOption,
): { min: number; max: number } {
  const match = options.find((o) => o.option === chosen);
  if (match) return { min: match.etaDaysMin, max: match.etaDaysMax };
  const standard = options.find((o) => o.option === 'standard');
  if (standard) return { min: standard.etaDaysMin, max: standard.etaDaysMax };
  return { min: 3, max: 5 };
}

/**
 * Compute the authoritative checkout quote for the current cart.
 *
 * Throws {@link QuoteError} for every expected failure (empty/expired cart,
 * live oversell, unserviceable pincode, COD ineligibility, coupon rejection,
 * shipping upstream failure). Success returns a {@link CheckoutQuote} with the
 * lines, every fee, the informational GST split, the applied coupon, and the
 * chosen option's ETA.
 */
export async function computeQuote(
  input: ComputeQuoteInput,
): Promise<CheckoutQuote> {
  // 1. Active cart — empty/expired ⇒ CART_EXPIRED (§2 step 1).
  const cartView = await getCart();
  if (cartView.id === '' || cartView.lines.length === 0) {
    throw new QuoteError(
      'CART_EXPIRED',
      'Your cart is empty. Please add items and try again.',
    );
  }

  // 2. Live variant data for every line (stock re-verify + GST rate).
  const token = await readCartToken();
  if (token === null) {
    throw new QuoteError('CART_EXPIRED', 'Your cart is empty.');
  }
  const rows = await db
    .select({
      itemId: cartItems.id,
      variantId: cartItems.variantId,
      qty: cartItems.quantity,
      giftWrap: cartItems.giftWrap,
      pricePaise: productVariants.pricePaise,
      gstRateBp: productVariants.gstRateBp,
      stockQuantity: productVariants.stockQuantity,
      variantActive: productVariants.isActive,
      productActive: products.isActive,
    })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(carts.token, token), eq(carts.status, 'active')))
    .orderBy(asc(cartItems.createdAt), asc(cartItems.id));

  if (rows.length === 0) {
    throw new QuoteError('CART_EXPIRED', 'Your cart is empty.');
  }

  // Re-verify LIVE stock per line — qty > available ⇒ OUT_OF_STOCK (§5.2).
  const shortfalls: StockShortfall[] = [];
  for (const row of rows) {
    const available =
      row.variantActive && row.productActive ? row.stockQuantity : 0;
    if (row.qty > available) {
      shortfalls.push({
        variantId: row.variantId,
        requested: row.qty,
        available,
      });
    }
  }
  if (shortfalls.length > 0) {
    throw new QuoteError(
      'OUT_OF_STOCK',
      'Some items just sold out. Please review your cart.',
      { lines: shortfalls },
    );
  }

  // 3. Fees / policy (§3 — snapshotted at placement, live here).
  const settings = await loadCheckoutSettings();

  // 4. Serviceability + COD eligibility (§5.1 / §5.2).
  let serviceability;
  try {
    serviceability = await getShippingProvider().serviceability({
      pincode: input.pincode,
      cod: input.paymentMode === 'cod',
    });
  } catch {
    throw new QuoteError(
      'UPSTREAM_ERROR',
      "We couldn't verify delivery to this PIN code. Please try again.",
    );
  }
  if (!serviceability.serviceable) {
    throw new QuoteError(
      'PINCODE_UNSERVICEABLE',
      `Sorry, we can't deliver to PIN code ${input.pincode} yet.`,
    );
  }
  if (input.paymentMode === 'cod' && !serviceability.codAvailable) {
    throw new QuoteError(
      'COD_UNAVAILABLE',
      "Cash on Delivery isn't available for this PIN code. Please pay online.",
    );
  }

  // 5. Coupon — re-validate against the LIVE cart subtotal (§5.2, edge §7.9).
  const productSubtotal = rows.reduce(
    (sum, row) => sum + row.pricePaise * row.qty,
    0,
  );
  const coupon = await validateCoupon(input.couponCode, productSubtotal);

  // 6. COD value cap — total above the cap ⇒ COD_UNAVAILABLE (cod.md §1).
  const money = computeQuoteMoney({
    lines: rows.map((row) => ({
      unitPricePaise: row.pricePaise,
      qty: row.qty,
      giftWrap: row.giftWrap,
      gstRateBp: row.gstRateBp,
    })),
    discountPaise: coupon?.discountPaise ?? 0,
    deliveryOption: input.deliveryOption,
    cod: input.paymentMode === 'cod',
    settings,
    intraState: settings.sellerStateCode === shipToStateCode(cartView),
  });

  if (
    input.paymentMode === 'cod' &&
    money.totalPaise > settings.codMaxOrderPaise
  ) {
    throw new QuoteError(
      'COD_UNAVAILABLE',
      "Cash on Delivery isn't available for this order value. Please pay online.",
    );
  }

  const eta = etaFor(serviceability.options, input.deliveryOption);

  return {
    lines: cartView.lines as CartLineView[],
    subtotalPaise: money.subtotalPaise,
    discountPaise: money.discountPaise,
    shippingFeePaise: money.shippingFeePaise,
    codFeePaise: money.codFeePaise,
    giftWrapTotalPaise: money.giftWrapTotalPaise,
    totalPaise: money.totalPaise,
    taxIncluded: money.taxIncluded,
    coupon: coupon ? { code: coupon.code, discountPaise: coupon.discountPaise } : null,
    etaDaysMin: eta.min,
    etaDaysMax: eta.max,
  };
}

/**
 * The quote request does not carry a `stateCode`; the tax split needs one. The
 * pincode alone cannot resolve a GST state deterministically at this layer, so
 * the quote treats the shipment as intra-state ONLY when the seller state can
 * be inferred — here we default to inter-state (all-IGST) unless a state code is
 * present on a later placement. The quote's GST figures are informational; the
 * authoritative split is snapshotted at placement from `shippingAddress.stateCode`.
 *
 * NOTE: `getCart` returns no state code, so this returns `''` (→ inter-state).
 * Backend B's placement path recomputes the split from the address.
 */
function shipToStateCode(_cart: { id: string }): string {
  return '';
}

/* ------------------------------------------------------------------ */
/* Coupon validation (live)                                            */
/* ------------------------------------------------------------------ */

interface ValidatedCoupon {
  id: string;
  code: string;
  discountPaise: number;
}

/**
 * Re-validate the coupon code against live coupon state and the current
 * product subtotal, mirroring `cart/actions.applyCoupon` but throwing the exact
 * §5.2 code so the quote auto-detaches on the client. Absent code ⇒ no coupon.
 */
async function validateCoupon(
  code: string | undefined,
  productSubtotalPaise: number,
): Promise<ValidatedCoupon | null> {
  if (code === undefined || code.trim() === '') return null;
  const normalized = code.trim().toUpperCase();

  const [row] = await db
    .select({
      id: coupons.id,
      code: coupons.code,
      percentBp: coupons.percentBp,
      flatPaise: coupons.flatPaise,
      maxDiscountPaise: coupons.maxDiscountPaise,
      minSubtotalPaise: coupons.minSubtotalPaise,
      startsAt: coupons.startsAt,
      endsAt: coupons.endsAt,
      usageLimit: coupons.usageLimit,
      redemptionCount: coupons.redemptionCount,
      isActive: coupons.isActive,
    })
    .from(coupons)
    .where(eq(coupons.code, normalized)) // citext — case-insensitive
    .limit(1);

  if (!row || !row.isActive) {
    throw new QuoteError('COUPON_INVALID', `Coupon ${normalized} isn't valid.`);
  }
  const now = Date.now();
  if (
    new Date(row.startsAt).getTime() > now ||
    (row.endsAt !== null && new Date(row.endsAt).getTime() <= now)
  ) {
    throw new QuoteError('COUPON_EXPIRED', `Coupon ${normalized} has expired.`);
  }
  if (row.usageLimit !== null && row.redemptionCount >= row.usageLimit) {
    throw new QuoteError(
      'COUPON_EXHAUSTED',
      `Coupon ${normalized} has been fully redeemed.`,
    );
  }
  if (productSubtotalPaise < row.minSubtotalPaise) {
    throw new QuoteError(
      'COUPON_MIN_NOT_MET',
      `Coupon ${normalized} requires a minimum order of ₹${String(
        Math.ceil(row.minSubtotalPaise / 100),
      )}.`,
    );
  }

  const discountPaise = estimateCouponDiscount(row, productSubtotalPaise);
  return { id: row.id, code: row.code, discountPaise };
}
