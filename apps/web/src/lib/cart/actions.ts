'use server';

/**
 * Cart Server Actions — Module 2 (docs/modules/cart.md §5, Contract §2.3).
 *
 * THE shared cart interface: getCart / addToCart / updateCartItem /
 * setGiftOptions / removeCartItem / applyCoupon / removeCoupon. Every
 * mutation returns `ApiResult<CartView>` and NEVER throws for expected
 * failures (zod ⇒ VALIDATION_ERROR envelope). Nothing is revalidated —
 * the cart is fully dynamic (`GET /api/cart` is no-store).
 *
 * Invariants (spec §5/§6):
 * - Lines are NEVER price snapshots — every view joins live
 *   `product_variants.price_paise`.
 * - Lazy cart creation: `getCart()` never writes (renders can't set
 *   cookies); the first mutation creates the row + signed cookie.
 * - Every `itemId` lookup is scoped `AND cart_id = <resolved cart>` —
 *   forged/foreign ids are indistinguishable from missing (NOT_FOUND).
 * - All money in integer paise via @kakoa/core money helpers.
 * - Rate limiting (Class B, 60/min) is middleware-owned, not done here.
 * - Per-customer coupon limits (`per_customer_limit`, `first_order_only`)
 *   are OUT OF SCOPE until auth lands (§3.5) — `COUPON_LIMIT_REACHED` is
 *   reserved for that pass; only global checks run today.
 */

import { createHash } from 'node:crypto';

import {
  addToCartInputSchema,
  applyCouponInputSchema,
  CART_QTY_MAX,
  computeCartTotals,
  emptyCartView,
  err,
  estimateCouponDiscount,
  multiplyPaise,
  normalizeGiftMessage,
  ok,
  productToneSchema,
  removeCartItemInputSchema,
  setGiftOptionsInputSchema,
  stockStateForLine,
  toPaise,
  updateCartItemInputSchema,
  type ApiResult,
  type CartLineView,
  type CartView,
  type ErrorCode,
  type ProductTone,
} from '@kakoa/core';
import {
  cartItems,
  carts,
  coupons,
  db,
  productImages,
  products,
  productVariants,
  storeSettings,
} from '@kakoa/db';
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';

import { readCartToken, setCartCookie } from './cookies';

/* ------------------------------------------------------------------ */
/* Shared plumbing                                                     */
/* ------------------------------------------------------------------ */

const GENERIC_COUPON_MESSAGE = "This coupon code isn't valid."; // enumeration posture: identical copy for every COUPON_* code
const INTERNAL_MESSAGE = 'Something went wrong. Please try again.';
const ITEM_NOT_FOUND_MESSAGE = 'This item is no longer in your cart.';

/** Structural stand-in for `z.ZodError` (apps/web has no direct zod dep). */
interface FlattenableError {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}

function validationErr(zodError: FlattenableError): ApiResult<CartView> {
  const flattened = zodError.flatten();
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      fieldErrors[key] = messages;
    }
  }
  return err('VALIDATION_ERROR', 'Please check your input and try again.', {
    fieldErrors,
  });
}

/** `products.tone` is text — coerce defensively (same as catalog). */
function toTone(value: string | null): ProductTone {
  const parsed = productToneSchema.safeParse(value);
  return parsed.success ? parsed.data : 'dark';
}

function toPaiseSetting(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

interface CartSettings {
  freeShippingThresholdPaise: number;
  giftWrapFeePaise: number;
}

/** Live `store_settings` reads — missing keys degrade to 0, never a 500. */
async function fetchCartSettings(): Promise<CartSettings> {
  const rows = await db
    .select({ key: storeSettings.key, value: storeSettings.value })
    .from(storeSettings)
    .where(
      inArray(storeSettings.key, [
        'free_shipping_threshold_paise',
        'gift_wrap_fee_paise',
      ]),
    );
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return {
    freeShippingThresholdPaise:
      toPaiseSetting(byKey.get('free_shipping_threshold_paise')) ?? 0,
    giftWrapFeePaise: toPaiseSetting(byKey.get('gift_wrap_fee_paise')) ?? 0,
  };
}

interface ResolvedCart {
  id: string;
}

/**
 * Resolve the ACTIVE, unexpired cart from a verified cookie. Tampered /
 * absent / terminal-status / expired ⇒ `null` — silently, never an error
 * (spec §6: a merged/converted token replayed yields a fresh empty cart).
 */
async function findActiveCart(): Promise<ResolvedCart | null> {
  const token = await readCartToken();
  if (token === null) return null;
  const [cart] = await db
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
  return cart ?? null;
}

/**
 * Lazy cart creation — mutations only (Server Actions may set cookies;
 * renders may not). New row: status 'active', expires_at now()+30d (DB
 * defaults), fresh HMAC-signed cookie issued.
 */
async function ensureCart(): Promise<ResolvedCart> {
  const existing = await findActiveCart();
  if (existing !== null) return existing;
  const [created] = await db
    .insert(carts)
    .values({})
    .returning({ id: carts.id, token: carts.token });
  if (!created) throw new Error('cart insert returned no row');
  await setCartCookie(created.token);
  return { id: created.id };
}

/** Keep the abandonment sweep honest — bump `updated_at` on mutation. */
async function touchCart(cartId: string): Promise<void> {
  await db
    .update(carts)
    .set({ updatedAt: sql`now()` })
    .where(eq(carts.id, cartId));
}

/* ------------------------------------------------------------------ */
/* CartView composition (live prices, live stock — every read)         */
/* ------------------------------------------------------------------ */

async function loadCartView(cartId: string): Promise<CartView> {
  const [rows, settings, [cartRow]] = await Promise.all([
    db
      .select({
        itemId: cartItems.id,
        variantId: cartItems.variantId,
        qty: cartItems.quantity,
        giftWrap: cartItems.giftWrap,
        giftMessage: cartItems.giftMessage,
        unitPricePaise: productVariants.pricePaise,
        variantName: productVariants.name,
        variantActive: productVariants.isActive,
        stockQuantity: productVariants.stockQuantity,
        lowStockThreshold: productVariants.lowStockThreshold,
        productSlug: products.slug,
        productName: products.name,
        productTone: products.tone,
        productActive: products.isActive,
        // Primary product image (lowest position) for the cart thumbnail.
        productImageUrl: sql<string | null>`(
          select ${productImages.url}
          from ${productImages}
          where ${productImages.productId} = ${products.id}
          order by ${productImages.position} asc, ${productImages.createdAt} asc
          limit 1
        )`,
      })
      .from(cartItems)
      .leftJoin(productVariants, eq(productVariants.id, cartItems.variantId))
      .leftJoin(products, eq(products.id, productVariants.productId))
      .where(eq(cartItems.cartId, cartId))
      .orderBy(asc(cartItems.createdAt), asc(cartItems.id)),
    fetchCartSettings(),
    db
      .select({ couponId: carts.couponId })
      .from(carts)
      .where(eq(carts.id, cartId))
      .limit(1),
  ]);

  const lines: CartLineView[] = [];
  const clamps: { itemId: string; variantId: string; requested: number; granted: number }[] = [];

  for (const row of rows) {
    // FK cascade makes a truly dangling variant impossible; degrade
    // defensively rather than 500 if one ever appears (edge case §7.4).
    if (
      row.variantId === null ||
      row.unitPricePaise === null ||
      row.variantName === null ||
      row.productSlug === null ||
      row.productName === null
    ) {
      continue;
    }

    const sellable =
      (row.variantActive ?? false) && (row.productActive ?? false);
    const stockQuantity = row.stockQuantity ?? 0;
    const lowStockThreshold = row.lowStockThreshold ?? 0;

    // Over-stock auto-clamp — persisted in the same read (spec §5 GET).
    let qty = row.qty;
    if (sellable && stockQuantity > 0 && qty > stockQuantity) {
      qty = stockQuantity;
      clamps.push({
        itemId: row.itemId,
        variantId: row.variantId,
        requested: row.qty,
        granted: qty,
      });
    }

    lines.push({
      itemId: row.itemId,
      variantId: row.variantId,
      productSlug: row.productSlug,
      name: row.productName,
      variantName: row.variantName,
      tone: toTone(row.productTone),
      imageUrl: row.productImageUrl ?? null,
      unitPricePaise: row.unitPricePaise,
      qty,
      giftWrap: row.giftWrap,
      giftMessage: row.giftMessage,
      lineTotalPaise: multiplyPaise(toPaise(row.unitPricePaise), qty),
      stockState: stockStateForLine(sellable, stockQuantity, lowStockThreshold),
    });
  }

  if (clamps.length > 0) {
    await Promise.all(
      clamps.map((clamp) =>
        db
          .update(cartItems)
          .set({ quantity: clamp.granted, updatedAt: sql`now()` })
          .where(
            and(eq(cartItems.id, clamp.itemId), eq(cartItems.cartId, cartId)),
          ),
      ),
    );
    for (const clamp of clamps) {
      console.info('cart.clamped', {
        cart_id: cartId,
        variant_id: clamp.variantId,
        requested: clamp.requested,
        granted: clamp.granted,
      });
    }
  }

  const totals = computeCartTotals(lines, settings.giftWrapFeePaise);

  // Coupon: re-validate on every read; auto-detach when it no longer
  // applies (below-minimum after a line removal, window closed, disabled)
  // — never a checkout-time 500 (edge case §7.11).
  let coupon: CartView['coupon'] = null;
  const couponId = cartRow?.couponId ?? null;
  if (couponId !== null) {
    const [couponRow] = await db
      .select({
        code: coupons.code,
        percentBp: coupons.percentBp,
        flatPaise: coupons.flatPaise,
        maxDiscountPaise: coupons.maxDiscountPaise,
        minSubtotalPaise: coupons.minSubtotalPaise,
        isActive: coupons.isActive,
        startsAt: coupons.startsAt,
        endsAt: coupons.endsAt,
      })
      .from(coupons)
      .where(eq(coupons.id, couponId))
      .limit(1);

    const now = Date.now();
    const stillValid =
      couponRow !== undefined &&
      couponRow.isActive &&
      new Date(couponRow.startsAt).getTime() <= now &&
      (couponRow.endsAt === null || new Date(couponRow.endsAt).getTime() > now) &&
      totals.subtotalPaise >= couponRow.minSubtotalPaise;

    if (stillValid) {
      coupon = {
        code: couponRow.code,
        discountPaise: estimateCouponDiscount(couponRow, totals.subtotalPaise),
      };
    } else {
      await db
        .update(carts)
        .set({ couponId: null, updatedAt: sql`now()` })
        .where(eq(carts.id, cartId));
      console.info('coupon.detached', {
        cart_id: cartId,
        reason: couponRow === undefined ? 'missing' : 'ineligible',
      });
    }
  }

  return {
    id: cartId,
    lines,
    subtotalPaise: totals.subtotalPaise,
    giftWrapTotalPaise: totals.giftWrapTotalPaise,
    coupon,
    freeShippingThresholdPaise: settings.freeShippingThresholdPaise,
    count: totals.count,
  };
}

/* ------------------------------------------------------------------ */
/* getCart                                                             */
/* ------------------------------------------------------------------ */

/**
 * Current cart view. No/invalid/terminal cookie ⇒ empty CartView — never
 * a 404, never a thrown error for a missing cookie. Does NOT create a
 * cart row (cookie writes are impossible during render; creation is the
 * first mutation's job).
 */
export async function getCart(): Promise<CartView> {
  const cart = await findActiveCart();
  if (cart === null) {
    const settings = await fetchCartSettings().catch(
      (): CartSettings => ({
        freeShippingThresholdPaise: 0,
        giftWrapFeePaise: 0,
      }),
    );
    return emptyCartView(settings.freeShippingThresholdPaise);
  }
  return loadCartView(cart.id);
}

/* ------------------------------------------------------------------ */
/* addToCart                                                           */
/* ------------------------------------------------------------------ */

export async function addToCart(input: {
  variantId: string;
  qty: number;
  giftWrap?: boolean;
  giftMessage?: string;
}): Promise<ApiResult<CartView>> {
  const parsed = addToCartInputSchema.safeParse(input);
  if (!parsed.success) return validationErr(parsed.error);
  const { variantId, qty, giftWrap, giftMessage } = parsed.data;

  try {
    // Live variant — unknown or inactive (variant OR product) ⇒ NOT_FOUND.
    const [variant] = await db
      .select({
        stockQuantity: productVariants.stockQuantity,
        variantActive: productVariants.isActive,
        productActive: products.isActive,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(productVariants.id, variantId))
      .limit(1);

    if (!variant || !variant.variantActive || !variant.productActive) {
      return err(
        'NOT_FOUND',
        'Something went wrong adding this item. Please refresh and try again.',
      );
    }
    const available = variant.stockQuantity;
    if (available <= 0) {
      return err('OUT_OF_STOCK', 'This item is out of stock.', {
        details: { available: 0 },
      });
    }

    const cart = await ensureCart();
    const message = normalizeGiftMessage(giftMessage);

    // Idempotent upsert on UNIQUE (cart_id, variant_id): existing line ⇒
    // quantities summed, clamped to 20 and live stock (spec §5). Gift
    // fields only overwrite when the caller supplied them.
    const conflictSet: {
      quantity: SQL;
      updatedAt: SQL;
      giftWrap?: boolean;
      giftMessage?: string | null;
    } = {
      quantity: sql`LEAST(${CART_QTY_MAX}, ${available}, ${cartItems.quantity} + ${qty})`,
      updatedAt: sql`now()`,
    };
    if (giftWrap !== undefined) conflictSet.giftWrap = giftWrap;
    if (giftMessage !== undefined) conflictSet.giftMessage = message;

    const requested = qty;
    const [line] = await db
      .insert(cartItems)
      .values({
        cartId: cart.id,
        variantId,
        quantity: Math.min(requested, CART_QTY_MAX, available),
        giftWrap: giftWrap ?? false,
        giftMessage: message,
      })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.variantId],
        set: conflictSet,
      })
      .returning({ quantity: cartItems.quantity });

    if (line && line.quantity < requested) {
      console.info('cart.clamped', {
        cart_id: cart.id,
        variant_id: variantId,
        requested,
        granted: line.quantity,
      });
    }

    await touchCart(cart.id);
    return ok(await loadCartView(cart.id));
  } catch (cause) {
    console.error('cart.add_failed', { cause });
    return err('INTERNAL', INTERNAL_MESSAGE);
  }
}

/* ------------------------------------------------------------------ */
/* updateCartItem                                                      */
/* ------------------------------------------------------------------ */

/** `qty: 0` removes the line (module spec §1). */
export async function updateCartItem(input: {
  itemId: string;
  qty: number;
}): Promise<ApiResult<CartView>> {
  const parsed = updateCartItemInputSchema.safeParse(input);
  if (!parsed.success) return validationErr(parsed.error);
  const { itemId, qty } = parsed.data;

  try {
    const cart = await findActiveCart();
    if (cart === null) return err('NOT_FOUND', ITEM_NOT_FOUND_MESSAGE);

    // itemId ALWAYS scoped to the resolved cart — forged/foreign ids are
    // indistinguishable from missing (spec §6 authz).
    const [line] = await db
      .select({
        id: cartItems.id,
        variantActive: productVariants.isActive,
        stockQuantity: productVariants.stockQuantity,
      })
      .from(cartItems)
      .leftJoin(productVariants, eq(productVariants.id, cartItems.variantId))
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .limit(1);
    if (!line) return err('NOT_FOUND', ITEM_NOT_FOUND_MESSAGE);

    if (qty === 0) {
      await db
        .delete(cartItems)
        .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
      await touchCart(cart.id);
      return ok(await loadCartView(cart.id));
    }

    const available = (line.variantActive ?? false) ? (line.stockQuantity ?? 0) : 0;
    if (qty > available) {
      // Explicit reject (not clamp) — the optimistic UI rolls back to the
      // server-clamped truth with a notice (edge case §7.6).
      return err(
        'OUT_OF_STOCK',
        available > 0
          ? `Only ${String(available)} left in stock.`
          : 'This item is out of stock.',
        { details: { available } },
      );
    }

    await db
      .update(cartItems)
      .set({ quantity: qty, updatedAt: sql`now()` })
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
    await touchCart(cart.id);
    return ok(await loadCartView(cart.id));
  } catch (cause) {
    console.error('cart.update_failed', { cause });
    return err('INTERNAL', INTERNAL_MESSAGE);
  }
}

/* ------------------------------------------------------------------ */
/* setGiftOptions                                                      */
/* ------------------------------------------------------------------ */

/**
 * Per-line gift wrap + message. An omitted `giftMessage` leaves the stored
 * message untouched; an empty (post-trim) one clears it.
 */
export async function setGiftOptions(input: {
  itemId: string;
  giftWrap: boolean;
  giftMessage?: string;
}): Promise<ApiResult<CartView>> {
  const parsed = setGiftOptionsInputSchema.safeParse(input);
  if (!parsed.success) return validationErr(parsed.error);
  const { itemId, giftWrap, giftMessage } = parsed.data;

  try {
    const cart = await findActiveCart();
    if (cart === null) return err('NOT_FOUND', ITEM_NOT_FOUND_MESSAGE);

    const updates: { giftWrap: boolean; updatedAt: SQL; giftMessage?: string | null } = {
      giftWrap,
      updatedAt: sql`now()`,
    };
    if (giftMessage !== undefined) {
      updates.giftMessage = normalizeGiftMessage(giftMessage);
    }

    const updated = await db
      .update(cartItems)
      .set(updates)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .returning({ id: cartItems.id });
    if (updated.length === 0) return err('NOT_FOUND', ITEM_NOT_FOUND_MESSAGE);

    await touchCart(cart.id);
    return ok(await loadCartView(cart.id));
  } catch (cause) {
    console.error('cart.gift_options_failed', { cause });
    return err('INTERNAL', INTERNAL_MESSAGE);
  }
}

/* ------------------------------------------------------------------ */
/* removeCartItem                                                      */
/* ------------------------------------------------------------------ */

export async function removeCartItem(input: {
  itemId: string;
}): Promise<ApiResult<CartView>> {
  const parsed = removeCartItemInputSchema.safeParse(input);
  if (!parsed.success) return validationErr(parsed.error);
  const { itemId } = parsed.data;

  try {
    const cart = await findActiveCart();
    if (cart === null) return err('NOT_FOUND', ITEM_NOT_FOUND_MESSAGE);

    const deleted = await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .returning({ id: cartItems.id });
    if (deleted.length === 0) return err('NOT_FOUND', ITEM_NOT_FOUND_MESSAGE);

    await touchCart(cart.id);
    return ok(await loadCartView(cart.id));
  } catch (cause) {
    console.error('cart.remove_failed', { cause });
    return err('INTERNAL', INTERNAL_MESSAGE);
  }
}

/* ------------------------------------------------------------------ */
/* applyCoupon / removeCoupon                                          */
/* ------------------------------------------------------------------ */

/** Failed attempts log a hash, never the raw code (spec §6 "never log"). */
function couponFailure(code: ErrorCode, attempted: string): ApiResult<CartView> {
  console.info('coupon.rejected', {
    code,
    code_hash: createHash('sha256').update(attempted).digest('hex').slice(0, 16),
  });
  return err(code, GENERIC_COUPON_MESSAGE);
}

/**
 * Validate + attach a coupon. All five COUPON_* codes return IDENTICAL
 * message copy — the code field is internal telemetry only (no
 * enumeration oracle). The discount shown is an ESTIMATE; /checkout/quote
 * is the authoritative pricing point.
 */
export async function applyCoupon(input: {
  code: string;
}): Promise<ApiResult<CartView>> {
  const parsed = applyCouponInputSchema.safeParse(input);
  if (!parsed.success) {
    // Malformed codes get the same generic copy as unknown ones.
    return couponFailure('COUPON_INVALID', String(input.code ?? ''));
  }
  const { code } = parsed.data;

  try {
    const cart = await ensureCart();

    const [coupon] = await db
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
      .where(eq(coupons.code, code)) // citext — case-insensitive compare
      .limit(1);

    if (!coupon || !coupon.isActive) {
      return couponFailure('COUPON_INVALID', code);
    }
    const now = Date.now();
    if (
      new Date(coupon.startsAt).getTime() > now ||
      (coupon.endsAt !== null && new Date(coupon.endsAt).getTime() <= now)
    ) {
      return couponFailure('COUPON_EXPIRED', code);
    }
    if (
      coupon.usageLimit !== null &&
      coupon.redemptionCount >= coupon.usageLimit
    ) {
      return couponFailure('COUPON_EXHAUSTED', code);
    }
    // per_customer_limit / first_order_only: OUT OF SCOPE until auth
    // (§3.5) — enforced again at /checkout/quote and placement anyway.

    // Live subtotal (excludes out-of-stock lines) vs min_subtotal.
    const view = await loadCartView(cart.id);
    if (view.subtotalPaise < coupon.minSubtotalPaise) {
      return couponFailure('COUPON_MIN_NOT_MET', code);
    }

    await db
      .update(carts)
      .set({ couponId: coupon.id, updatedAt: sql`now()` })
      .where(eq(carts.id, cart.id));
    console.info('coupon.applied', { code: coupon.code, cart_id: cart.id });

    return ok({
      ...view,
      coupon: {
        code: coupon.code,
        discountPaise: estimateCouponDiscount(coupon, view.subtotalPaise),
      },
    });
  } catch (cause) {
    console.error('cart.apply_coupon_failed', { cause });
    return err('INTERNAL', INTERNAL_MESSAGE);
  }
}

export async function removeCoupon(): Promise<ApiResult<CartView>> {
  try {
    const cart = await findActiveCart();
    if (cart === null) return ok(await getCart()); // nothing to detach

    await db
      .update(carts)
      .set({ couponId: null, updatedAt: sql`now()` })
      .where(eq(carts.id, cart.id));
    console.info('coupon.detached', { cart_id: cart.id, reason: 'user' });

    return ok(await loadCartView(cart.id));
  } catch (cause) {
    console.error('cart.remove_coupon_failed', { cause });
    return err('INTERNAL', INTERNAL_MESSAGE);
  }
}
