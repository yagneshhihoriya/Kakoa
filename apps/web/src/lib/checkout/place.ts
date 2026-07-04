/**
 * Order placement — checkout.md §5.3, Contract §2.5 (normative transaction).
 *
 * `placeOrder` is the single money-truthful entry point for creating an order.
 * It is idempotent (client-minted `idempotencyKey`), recomputes the quote from
 * live prices/stock/coupons (never trusting the client's `expectedTotalPaise`),
 * verifies the COD OTP when required, then runs the placement transaction in
 * the EXACT §2.5 order:
 *
 *   1. recompute quote → compare total vs expectedTotalPaise (PRICE_CHANGED)
 *   2. INSERT orders (+ creation order_status_history row)
 *   3. atomic per-line stock decrements (OUT_OF_STOCK on any zero-row update)
 *   4. atomic coupon increment (+ coupon_redemptions row) — COUPON_EXHAUSTED
 *   5. INSERT order_items snapshots (name/SKU/HSN/gst_rate_bp/price/tax split)
 *   6. INSERT payments row (created | cod_pending_collection) + inventory_adjustments
 *   7. COMMIT → mark cart converted
 *   8. prepaid only: call Razorpay Orders API OUTSIDE the tx; on failure run a
 *      compensating tx (restock + payment failed + order payment_failed) → 502.
 *
 * Every money figure and address is SNAPSHOTTED onto the order — a later
 * settings/price/coupon edit never rewrites history. All timestamps are DB
 * `now()` (UTC). Typed errors (`PlacementError`) map 1:1 to the §5.3 codes.
 *
 * SERVER-ONLY: uses @kakoa/db, @kakoa/integrations, next/headers (via session).
 */
import { createHash } from 'node:crypto';

import {
  splitGst,
  taxableFromInclusive,
  taxFromInclusive,
  normalizePhoneE164,
  type CheckoutQuote,
  type ErrorCode,
  type PlaceOrderInput,
  type PlaceOrderResult,
} from '@kakoa/core';
import {
  cartItems,
  carts,
  coupons,
  couponRedemptions,
  db,
  inventoryAdjustments,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
  productImages,
  products,
  productVariants,
  type AddressSnapshot,
} from '@kakoa/db';
import { parseServerEnv } from '@kakoa/config';
import { getPaymentProvider } from '@kakoa/integrations';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { readCartToken } from '@/lib/cart/cookies';
import { getCurrentCustomer } from '@/lib/auth/session';
import { verifyCode } from '@/lib/auth/otp';
import { saveCheckoutAddress } from '@/lib/account/addresses';
import { sendOrderConfirmation } from '@/lib/email/send';
import { computeQuote, type ComputeQuoteInput } from './quote';
import { loadCheckoutSettings } from './settings';

/*
 * `computeQuote` is owned by lib/checkout/quote.ts (Backend A). It is the money
 * authority: `computeQuote(input): Promise<CheckoutQuote>`, throwing a typed
 * `QuoteError` (code ∈ OUT_OF_STOCK / CART_EXPIRED / COUPON_* / PINCODE_* /
 * COD_UNAVAILABLE / UPSTREAM_ERROR) that the Route Handler surfaces verbatim.
 *
 * The quote's `totalPaise` is `stateCode`-independent (GST is EXTRACTED from
 * inclusive prices, so the CGST/SGST-vs-IGST split never moves the total) — so
 * comparing it against `expectedTotalPaise` is exact. The quote's informational
 * GST split, however, is computed inter-state (the quote has no address state
 * code); placement recomputes the AUTHORITATIVE split per line from
 * `shippingAddress.stateCode` and writes those figures to the order header.
 */

/* ------------------------------------------------------------------ */
/* Typed placement errors (→ §5.3 status codes)                        */
/* ------------------------------------------------------------------ */

/** Details carried by a `PlacementError` for the envelope. */
export interface PlacementErrorDetails {
  quote?: CheckoutQuote;
  lines?: { variantId: string; requested: number; available: number }[];
  attemptsLeft?: number;
}

/**
 * A typed, expected placement failure. The Route Handler maps `code` straight
 * to the registry HTTP status; `details` becomes the envelope `details`.
 */
export class PlacementError extends Error {
  override readonly name = 'PlacementError';
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: PlacementErrorDetails,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Request context stamped for forensics (never used for authz). */
export interface PlaceOrderContext {
  ip?: string | null;
  ua?: string | null;
}

/** A `PlaceOrderResult` plus the idempotent-replay flag (§5.3 DUPLICATE_REQUEST). */
export type PlaceOrderOutcome = PlaceOrderResult & { duplicate: boolean };

/**
 * Place an order. Idempotent on `input.idempotencyKey`: a repeat of the SAME
 * attempt replays the original 201 body with `duplicate: true`. Throws a
 * `PlacementError` for every expected failure; a genuinely unexpected fault
 * surfaces as a normal Error (→ 500 at the Route Handler).
 */
export async function placeOrder(
  input: PlaceOrderInput,
  ctx: PlaceOrderContext = {},
): Promise<PlaceOrderOutcome> {
  // (a) Idempotency — a completed attempt with this key replays verbatim.
  const replay = await findReplay(input.idempotencyKey);
  if (replay !== null) return replay;

  // Normalize the contact + recipient phones once (stored form).
  const contactPhone = normalizePhoneE164(input.contact.phone);
  if (contactPhone === null) {
    throw new PlacementError(
      'VALIDATION_ERROR',
      'Enter a valid 10-digit Indian mobile number starting with 6–9.',
    );
  }
  const shipPhone = normalizePhoneE164(input.shippingAddress.phone) ?? contactPhone;
  const contactEmail = input.contact.email ?? null;

  // (b) Recompute the quote from live prices/stock/coupons/settings. The quote
  // engine (Backend A) is the money authority; it throws typed errors for
  // OUT_OF_STOCK / CART_EXPIRED / coupon / serviceability, which the Route
  // Handler maps identically to placement.
  const quoteReq: ComputeQuoteInput = {
    pincode: input.shippingAddress.pincode,
    deliveryOption: input.deliveryOption,
    paymentMode: input.paymentMode,
    ...(input.couponCode !== undefined ? { couponCode: input.couponCode } : {}),
  };
  const quote = await computeQuote(quoteReq);

  // (b) PRICE_CHANGED — server total is the authority; the client's displayed
  // total must match to the paisa.
  if (quote.totalPaise !== input.expectedTotalPaise) {
    console.info('checkout.price_changed', {
      delta_paise: quote.totalPaise - input.expectedTotalPaise,
    });
    throw new PlacementError(
      'PRICE_CHANGED',
      'Prices have changed since you started checkout — please review the updated total.',
      { quote },
    );
  }

  const settings = await loadCheckoutSettings();

  // Prepaid-only launch: COD is gated behind the `cod_enabled` store setting
  // (default off). When disabled, reject any COD placement — defense-in-depth
  // behind the UI, which also hides the option. Flip `cod_enabled` to re-enable.
  if (input.paymentMode === 'cod' && !settings.codEnabled) {
    throw new PlacementError(
      'COD_UNAVAILABLE',
      'Cash on Delivery is currently unavailable. Please pay online.',
    );
  }

  // Resolve the authenticated customer ONCE (null = guest). Used for the COD
  // session-verified-phone shortcut and stamped as `orders.customer_id`.
  const customer = await getCurrentCustomer();
  const customerId = customer?.id ?? null;

  // (c) COD OTP gate — required unless a live session already holds a verified
  // phone equal to the (normalized) contact phone.
  let codVerified = false;
  if (input.paymentMode === 'cod') {
    const sessionPhoneVerified =
      customer !== null &&
      customer.phoneVerifiedAt !== null &&
      customer.phone === contactPhone;

    if (!sessionPhoneVerified) {
      if (input.codOtp === undefined) {
        throw new PlacementError(
          'OTP_INCORRECT',
          'Please verify your phone number to place a COD order.',
          { attemptsLeft: 0 },
        );
      }
      const outcome = await verifyCode({
        challengeId: input.codOtp.challengeId,
        code: input.codOtp.code,
      });
      if (outcome.status === 'incorrect') {
        throw new PlacementError(
          'OTP_INCORRECT',
          `Incorrect OTP. ${String(outcome.attemptsLeft)} attempts left.`,
          { attemptsLeft: outcome.attemptsLeft },
        );
      }
      if (
        outcome.status === 'expired' ||
        outcome.challenge.purpose !== 'cod_verification' ||
        outcome.challenge.destination !== contactPhone
      ) {
        throw new PlacementError(
          'OTP_EXPIRED',
          'This OTP has expired. Request a new one.',
        );
      }
      codVerified = true;
    }
  }

  // (d) The placement transaction (§2.5 normative order).
  const status = input.paymentMode === 'cod' ? 'cod_pending_confirmation' : 'pending_payment';

  const shippingSnapshot = toAddressSnapshot(input.shippingAddress, shipPhone);
  const billingSnapshot =
    input.billingAddress !== undefined
      ? toAddressSnapshot(
          input.billingAddress,
          normalizePhoneE164(input.billingAddress.phone) ?? shipPhone,
        )
      : null;

  const intraState = input.shippingAddress.stateCode === settings.sellerStateCode;

  let committed: { orderId: string; orderNumber: string; accessToken: string };
  try {
    committed = await db.transaction(async (tx) => {
    // Resolve the active cart (the source of truth for lines). A converted /
    // missing cart ⇒ CART_EXPIRED (two-tabs edge case §7.14).
    const cart = await resolveActiveCart(tx);

    // Read every line's LIVE variant snapshot data (SKU/HSN/gst/price/image)
    // and the cart's gift fields — inside the tx, so it is consistent with the
    // stock decrement that follows.
    const lines = await readCartLines(tx, cart.id);
    if (lines.length === 0) {
      throw new PlacementError('CART_EXPIRED', 'Your cart is empty.');
    }

    // Build the order_items snapshots + the AUTHORITATIVE header GST split from
    // `shippingAddress.stateCode` (the quote's split is inter-state placeholder).
    // The money aggregates (subtotal/discount/shipping/cod/giftwrap/total) are
    // the quote's — GST is extracted and never moves the total, so the row
    // satisfies the orders total CHECK to the paisa.
    const itemSnapshots = lines.map((line) => buildItemSnapshot(line, settings, intraState));
    const headerGst = itemSnapshots.reduce(
      (acc, item) => ({
        cgstPaise: acc.cgstPaise + (item.cgstPaise ?? 0),
        sgstPaise: acc.sgstPaise + (item.sgstPaise ?? 0),
        igstPaise: acc.igstPaise + (item.igstPaise ?? 0),
      }),
      { cgstPaise: 0, sgstPaise: 0, igstPaise: 0 },
    );

    // Resolve the coupon id ONCE (reused for the orders row + the increment).
    const couponId =
      quote.coupon !== null ? await resolveCouponId(tx, quote.coupon.code) : null;

    // 2. INSERT orders + creation history row.
    const [orderRow] = await tx
      .insert(orders)
      .values({
        customerId,
        cartId: cart.id,
        status,
        paymentMode: input.paymentMode,
        contactPhone,
        contactEmail,
        codPhoneVerifiedAt: codVerified ? sql`now()` : null,
        shippingAddress: shippingSnapshot,
        billingAddress: billingSnapshot,
        shipToStateCode: input.shippingAddress.stateCode,
        deliveryOpt: input.deliveryOption,
        subtotalPaise: quote.subtotalPaise,
        discountPaise: quote.discountPaise,
        shippingFeePaise: quote.shippingFeePaise,
        codFeePaise: quote.codFeePaise,
        giftWrapTotalPaise: quote.giftWrapTotalPaise,
        totalPaise: quote.totalPaise,
        cgstPaise: headerGst.cgstPaise,
        sgstPaise: headerGst.sgstPaise,
        igstPaise: headerGst.igstPaise,
        couponId,
        couponCode: quote.coupon?.code ?? null,
        idempotencyKey: input.idempotencyKey,
        customerNote: input.customerNote ?? null,
      })
      .returning({
        id: orders.id,
        orderNumber: orders.orderNumber,
        accessToken: orders.accessToken,
      });
    if (!orderRow) throw new Error('orders insert returned no row');

    await tx.insert(orderStatusHistory).values({
      orderId: orderRow.id,
      fromStatus: null,
      toStatus: status,
      actorType: 'customer',
      actorId: customerId,
    });

    // 3. Atomic stock decrements — one conditional UPDATE per line. Zero rows
    //    on ANY line ⇒ OUT_OF_STOCK, aborting the whole tx.
    for (const line of lines) {
      const decremented = await tx
        .update(productVariants)
        .set({
          stockQuantity: sql`${productVariants.stockQuantity} - ${line.qty}`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(productVariants.id, line.variantId),
            sql`${productVariants.stockQuantity} >= ${line.qty}`,
          ),
        )
        .returning({ stockAfter: productVariants.stockQuantity });

      const after = decremented[0];
      if (!after) {
        // Read the current availability for the per-line marker (best effort).
        const [current] = await tx
          .select({ available: productVariants.stockQuantity })
          .from(productVariants)
          .where(eq(productVariants.id, line.variantId))
          .limit(1);
        console.info('order.oversell_rejected', {
          variant_id: line.variantId,
          requested: line.qty,
        });
        throw new PlacementError('OUT_OF_STOCK', 'One or more items just sold out.', {
          lines: [
            {
              variantId: line.variantId,
              requested: line.qty,
              available: current?.available ?? 0,
            },
          ],
        });
      }

      // 6 (interleaved): inventory ledger row per decrement.
      await tx.insert(inventoryAdjustments).values({
        variantId: line.variantId,
        delta: -line.qty,
        reason: 'order_placed',
        orderId: orderRow.id,
        stockAfter: after.stockAfter,
      });
    }

    // 4. Coupon: atomic increment guarded by the usage limit, then a redemption
    //    row. Zero rows ⇒ the coupon was exhausted between quote and placement.
    if (quote.coupon !== null && couponId !== null) {
      const bumped = await tx
        .update(coupons)
        .set({
          redemptionCount: sql`${coupons.redemptionCount} + 1`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(coupons.id, couponId),
            sql`(${coupons.usageLimit} IS NULL OR ${coupons.redemptionCount} < ${coupons.usageLimit})`,
          ),
        )
        .returning({ id: coupons.id });
      if (bumped.length === 0) {
        throw new PlacementError(
          'COUPON_EXHAUSTED',
          'This coupon has been fully redeemed.',
        );
      }
      await tx.insert(couponRedemptions).values({
        couponId,
        orderId: orderRow.id,
        customerId,
        contactPhone,
        discountPaise: quote.coupon.discountPaise,
      });
    }

    // 5. order_items snapshots — every GST/HSN/price field frozen at placement
    //    (precomputed above so the header GST matches the line sum exactly).
    await tx.insert(orderItems).values(
      itemSnapshots.map((item) => ({ ...item, orderId: orderRow.id })),
    );

    // 6. payments row (prepaid: created; cod: cod_pending_collection).
    await tx.insert(payments).values({
      orderId: orderRow.id,
      provider: input.paymentMode === 'cod' ? 'cod' : 'razorpay',
      method: input.paymentMode === 'cod' ? 'cod' : 'unknown',
      status: input.paymentMode === 'cod' ? 'cod_pending_collection' : 'created',
      amountPaise: quote.totalPaise,
    });

    // 7. Mark the cart converted — the second tab's placement now 410s.
    await tx
      .update(carts)
      .set({ status: 'converted', updatedAt: sql`now()` })
      .where(eq(carts.id, cart.id));

      return {
        orderId: orderRow.id,
        orderNumber: orderRow.orderNumber,
        accessToken: orderRow.accessToken,
      };
    });
  } catch (cause) {
    // Concurrent double-submit: two requests with the SAME key both passed the
    // pre-tx replay check, then raced the INSERT. The loser hits the UNIQUE
    // constraint on `orders.idempotency_key` — resolve it into a replay of the
    // winner (checkout.md §7.2), never a spurious 500.
    if (isUniqueViolation(cause)) {
      const replayed = await findReplay(input.idempotencyKey);
      if (replayed !== null) return replayed;
    }
    throw cause;
  }

  console.info('order.created', {
    order_number: committed.orderNumber,
    payment_mode: input.paymentMode,
    total_paise: quote.totalPaise,
    contact_phone_hash: hashPhone(contactPhone),
    ip_hash: ctx.ip ? hashPhone(ctx.ip) : null,
  });

  // Save-at-checkout: a logged-in customer's shipping address is folded into
  // their address book (smart-address Phase 1). Best-effort and OUTSIDE the
  // placement tx — `saveCheckoutAddress` swallows all errors and de-dupes
  // against an existing row, so the order is never blocked or double-saved.
  // Guests (customerId === null) never get a book row.
  if (customerId !== null) {
    await saveCheckoutAddress(customerId, {
      fullName: input.shippingAddress.fullName,
      phone: shipPhone,
      line1: input.shippingAddress.line1,
      ...(input.shippingAddress.line2 !== undefined
        ? { line2: input.shippingAddress.line2 }
        : {}),
      ...(input.shippingAddress.landmark !== undefined
        ? { landmark: input.shippingAddress.landmark }
        : {}),
      city: input.shippingAddress.city,
      state: input.shippingAddress.state,
      stateCode: input.shippingAddress.stateCode,
      pincode: input.shippingAddress.pincode,
    });
  }

  // (e) COD — done; the confirm queue drives the rest.
  if (input.paymentMode === 'cod') {
    // Best-effort order confirmation email, AFTER the money commit and OUTSIDE
    // any transaction — never blocks or fails the placement (COD is "order
    // placed — we'll confirm by phone").
    void sendOrderConfirmation(committed.orderId).catch(() => {});
    return {
      paymentMode: 'cod',
      orderId: committed.orderId,
      orderNumber: committed.orderNumber,
      accessToken: committed.accessToken,
      status: 'cod_pending_confirmation',
      duplicate: false,
    };
  }

  // (e) Prepaid — call Razorpay OUTSIDE the tx; on failure, compensate + 502.
  const provider = getPaymentProvider();
  let providerOrder: {
    providerOrderId: string;
    amountPaise: number;
    currency: string;
    keyId: string;
  };
  try {
    providerOrder = await provider.createOrder({
      orderNumber: committed.orderNumber,
      amountPaise: quote.totalPaise,
      receipt: input.idempotencyKey,
    });
  } catch (cause) {
    await compensatePrepaidFailure(committed.orderId);
    console.error('checkout.razorpay_create_failed', {
      order_number: committed.orderNumber,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    throw new PlacementError(
      'UPSTREAM_ERROR',
      'Payment setup failed — your card was not charged. Please try again.',
    );
  }

  // Persist the provider order id on the payment row.
  await db
    .update(payments)
    .set({ providerOrderId: providerOrder.providerOrderId, updatedAt: sql`now()` })
    .where(
      and(
        eq(payments.orderId, committed.orderId),
        eq(payments.status, 'created'),
      ),
    );

  // NO confirmation email here. The order is still `pending_payment` — the
  // customer has a Razorpay handoff but has NOT paid yet, and the prepaid email
  // copy is "Payment received". Sending now would falsely tell an abandoner
  // their payment succeeded. The confirmation mail fires exactly once from
  // confirm.ts, on the verify fast-path or the webhook, after capture.

  return {
    paymentMode: 'prepaid',
    orderId: committed.orderId,
    orderNumber: committed.orderNumber,
    accessToken: committed.accessToken,
    razorpay: {
      orderId: providerOrder.providerOrderId,
      keyId: providerOrder.keyId,
      amountPaise: providerOrder.amountPaise,
      currency: 'INR',
      prefill: {
        contact: contactPhone,
        ...(contactEmail !== null ? { email: contactEmail } : {}),
      },
    },
    duplicate: false,
  };
}

/* ------------------------------------------------------------------ */
/* Idempotent replay (§5.3)                                            */
/* ------------------------------------------------------------------ */

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Replay the original 201 for a completed placement attempt. Returns `null`
 * when the key is unseen. Rebuilds the discriminated result from the persisted
 * order + payment rows so a double-submit is byte-stable for the client.
 */
async function findReplay(
  idempotencyKey: string,
): Promise<PlaceOrderOutcome | null> {
  const [row] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      accessToken: orders.accessToken,
      paymentMode: orders.paymentMode,
      totalPaise: orders.totalPaise,
      contactPhone: orders.contactPhone,
      contactEmail: orders.contactEmail,
    })
    .from(orders)
    .where(eq(orders.idempotencyKey, idempotencyKey))
    .limit(1);
  if (!row) return null;

  if (row.paymentMode === 'cod') {
    return {
      paymentMode: 'cod',
      orderId: row.id,
      orderNumber: row.orderNumber,
      accessToken: row.accessToken,
      status: 'cod_pending_confirmation',
      duplicate: true,
    };
  }

  // Prepaid replay: the provider order id lives on the latest payment row.
  const [pay] = await db
    .select({
      providerOrderId: payments.providerOrderId,
      amountPaise: payments.amountPaise,
    })
    .from(payments)
    .where(eq(payments.orderId, row.id))
    .orderBy(sql`${payments.createdAt} DESC`)
    .limit(1);

  return {
    paymentMode: 'prepaid',
    orderId: row.id,
    orderNumber: row.orderNumber,
    accessToken: row.accessToken,
    razorpay: {
      // The stored provider order id + key id fully rebuild the handoff — no
      // second Razorpay create (that would mint a duplicate gateway order).
      orderId: pay?.providerOrderId ?? '',
      keyId: resolveKeyId(),
      amountPaise: pay?.amountPaise ?? row.totalPaise,
      currency: 'INR',
      prefill: {
        contact: row.contactPhone,
        ...(row.contactEmail !== null ? { email: row.contactEmail } : {}),
      },
    },
    duplicate: true,
  };
}

/**
 * The public Razorpay key id the client needs to open the checkout widget.
 * Deterministic per environment: the live key when configured, else the mock's
 * fixed id — matching what `MockPaymentProvider.createOrder` returns.
 */
function resolveKeyId(): string {
  return parseServerEnv().RAZORPAY_KEY_ID ?? 'rzp_test_mock';
}

/* ------------------------------------------------------------------ */
/* Transaction helpers                                                 */
/* ------------------------------------------------------------------ */

interface ResolvedCart {
  id: string;
}

/**
 * Resolve the caller's ACTIVE cart from the cart cookie, FOR the placement tx.
 * A converted/merged/expired/absent cart ⇒ CART_EXPIRED (the second tab in the
 * two-tabs race, or a stale checkout).
 */
async function resolveActiveCart(tx: DbTx): Promise<ResolvedCart> {
  const token = await readCartToken();
  if (token === null) {
    throw new PlacementError('CART_EXPIRED', 'Your cart is empty.');
  }
  const [cart] = await tx
    .select({ id: carts.id })
    .from(carts)
    .where(
      and(
        eq(carts.token, token),
        eq(carts.status, 'active'),
        sql`${carts.expiresAt} > now()`,
      ),
    )
    .limit(1);
  if (!cart) {
    throw new PlacementError('CART_EXPIRED', 'Your cart is empty.');
  }
  return cart;
}

interface PlacementLine {
  variantId: string;
  qty: number;
  unitPricePaise: number;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  hsnCode: string;
  gstRateBp: number;
  giftWrap: boolean;
  giftMessage: string | null;
}

/**
 * Load every cart line with its LIVE variant snapshot data (price, SKU, HSN,
 * gst rate, product name, image) — the raw material for `order_items`. Read
 * inside the tx so the snapshot is consistent with the stock decrement.
 * Out-of-stock (stock 0) or inactive lines are excluded from the order exactly
 * as the quote excludes them, so the money aggregates line up.
 */
async function readCartLines(
  tx: DbTx,
  cartId: string,
): Promise<PlacementLine[]> {
  const rows = await tx
    .select({
      variantId: cartItems.variantId,
      qty: cartItems.quantity,
      giftWrap: cartItems.giftWrap,
      giftMessage: cartItems.giftMessage,
      unitPricePaise: productVariants.pricePaise,
      variantName: productVariants.name,
      sku: productVariants.sku,
      hsnCode: productVariants.hsnCode,
      gstRateBp: productVariants.gstRateBp,
      variantActive: productVariants.isActive,
      stockQuantity: productVariants.stockQuantity,
      productName: products.name,
      productActive: products.isActive,
      productId: products.id,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(sql`${cartItems.createdAt} ASC`, sql`${cartItems.id} ASC`);

  const sellable = rows.filter(
    (r) => r.variantActive && r.productActive && r.stockQuantity > 0,
  );

  // First image per product (pinned to product; variant-scoped preferred).
  const productIds = Array.from(new Set(sellable.map((r) => r.productId)));
  const imageByProduct = new Map<string, string>();
  if (productIds.length > 0) {
    const images = await tx
      .select({
        productId: productImages.productId,
        url: productImages.url,
        position: productImages.position,
      })
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(sql`${productImages.position} ASC`);
    for (const img of images) {
      if (!imageByProduct.has(img.productId)) {
        imageByProduct.set(img.productId, img.url);
      }
    }
  }

  return sellable.map((r) => ({
    variantId: r.variantId,
    qty: r.qty,
    unitPricePaise: r.unitPricePaise,
    productName: r.productName,
    variantName: r.variantName,
    sku: r.sku,
    imageUrl: imageByProduct.get(r.productId) ?? null,
    hsnCode: r.hsnCode,
    gstRateBp: r.gstRateBp,
    giftWrap: r.giftWrap,
    giftMessage: r.giftMessage,
  }));
}

/** Resolve the coupon id by code (citext, case-insensitive), or `null`. */
async function resolveCouponId(
  tx: DbTx,
  code: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ id: coupons.id })
    .from(coupons)
    .where(eq(coupons.code, code))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Compensating transaction after a Razorpay create failure (§5.3 step 8):
 * restock every line via `inventory_adjustments` (`order_cancelled`), flip the
 * payment row to `failed`, move the order to `payment_failed`, write history.
 * The old idempotency key stays burned on the failed order — the client mints a
 * NEW key to retry.
 */
async function compensatePrepaidFailure(orderId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const items = await tx
      .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    for (const item of items) {
      const [restored] = await tx
        .update(productVariants)
        .set({
          stockQuantity: sql`${productVariants.stockQuantity} + ${item.quantity}`,
          updatedAt: sql`now()`,
        })
        .where(eq(productVariants.id, item.variantId))
        .returning({ stockAfter: productVariants.stockQuantity });
      if (restored) {
        await tx.insert(inventoryAdjustments).values({
          variantId: item.variantId,
          delta: item.quantity,
          reason: 'order_cancelled',
          orderId,
          stockAfter: restored.stockAfter,
        });
      }
    }

    await tx
      .update(payments)
      .set({
        status: 'failed',
        failureReason: 'razorpay_order_create_failed',
        updatedAt: sql`now()`,
      })
      .where(and(eq(payments.orderId, orderId), eq(payments.status, 'created')));

    await tx
      .update(orders)
      .set({ status: 'payment_failed', updatedAt: sql`now()` })
      .where(eq(orders.id, orderId));

    await tx.insert(orderStatusHistory).values({
      orderId,
      fromStatus: 'pending_payment',
      toStatus: 'payment_failed',
      actorType: 'system',
      note: 'Razorpay order create failed',
    });
  });
}

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

/**
 * Build one `order_items` snapshot from a live cart line: GST is EXTRACTED from
 * the inclusive product value (unit × qty; gift wrap is a service, not a product
 * line, so it carries no GST) and split by the ship-to-state intra/inter flag.
 * `line_total = unit × qty + giftWrapFee`.
 */
function buildItemSnapshot(
  line: PlacementLine,
  settings: { giftWrapFeePaise: number },
  intraState: boolean,
): Omit<typeof orderItems.$inferInsert, 'orderId'> {
  const gross = line.unitPricePaise * line.qty; // GST-inclusive product total
  const giftFee = line.giftWrap ? settings.giftWrapFeePaise : 0;
  const lineTax = taxFromInclusive(gross, line.gstRateBp);
  const split = splitGst(lineTax, intraState);
  return {
    variantId: line.variantId,
    productName: line.productName,
    variantName: line.variantName,
    sku: line.sku,
    imageUrl: line.imageUrl,
    hsnCode: line.hsnCode,
    gstRateBp: line.gstRateBp,
    unitPricePaise: line.unitPricePaise,
    quantity: line.qty,
    lineTotalPaise: gross + giftFee,
    taxableValuePaise: taxableFromInclusive(gross, line.gstRateBp),
    cgstPaise: split.cgstPaise,
    sgstPaise: split.sgstPaise,
    igstPaise: split.igstPaise,
    giftWrap: line.giftWrap,
    giftWrapFeePaise: giftFee,
    giftMessage: line.giftMessage,
  };
}

/** Address form input + the resolved E.164 phone → the stored jsonb snapshot. */
function toAddressSnapshot(
  addr: PlaceOrderInput['shippingAddress'],
  phone: string,
): AddressSnapshot {
  return {
    fullName: addr.fullName,
    phone,
    line1: addr.line1,
    ...(addr.line2 !== undefined ? { line2: addr.line2 } : {}),
    ...(addr.landmark !== undefined ? { landmark: addr.landmark } : {}),
    city: addr.city,
    state: addr.state,
    stateCode: addr.stateCode,
    pincode: addr.pincode,
  };
}

/** sha256 prefix — the only form of a phone/IP that ever reaches the logs (§6). */
function hashPhone(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/**
 * Postgres unique-violation (SQLSTATE 23505). A concurrent placement with the
 * same idempotency key trips the UNIQUE constraint on `orders.idempotency_key`;
 * we resolve that into an idempotent replay rather than a 500.
 */
function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    (cause as { code: unknown }).code === '23505'
  );
}
