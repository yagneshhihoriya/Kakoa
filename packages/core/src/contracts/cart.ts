/**
 * Cart contracts — Contract §2.3 (docs/modules/cart.md §1/§5).
 *
 * zod schemas are the single source of truth for every cart DTO; TS types
 * are `z.infer` only. All money fields are integer paise. Cart lines are
 * NEVER price snapshots — every read reprices against live variants, so
 * these schemas describe the *view*, not stored rows.
 *
 * Also home to the PURE cart math shared by server actions and the
 * merge-on-login handler: `mergeCartLines`, `computeCartTotals`,
 * `estimateCouponDiscount`, `stockStateForLine` — unit-tested here with no
 * DB in sight (risk-engineering Module 2 requires the merge collision
 * matrix to live in @kakoa/core).
 */

import { z } from 'zod';
import { addPaise, multiplyPaise, toPaise, type Paise } from '../money';
import { productToneSchema } from './catalog';

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

/** RFC-4122 UUID (case-insensitive) — matches the module spec regex. */
const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

/** Matches DB CHECK `slug ~ '^[a-z0-9-]+$'`. */
const slugSchema = z.string().regex(/^[a-z0-9-]+$/);

/** Line qty hard cap — mirrors DB `CHECK (quantity BETWEEN 1 AND 20)`. */
export const CART_QTY_MAX = 20;

/** Gift message hard cap (post-trim) — mirrors the DB CHECK. */
export const GIFT_MESSAGE_MAX = 300;

/**
 * C0/C1-ish control chars stripped from gift messages. `\n` survives
 * (multi-line messages are legitimate); `\r`, `\t`, NUL etc. do not.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u0009\u000B-\u001F\u007F]/g;

/**
 * Gift message: control chars stripped, then trimmed, then capped at 300
 * (docs/modules/cart.md §1 — "305 with trailing spaces passes").
 * Empty-after-trim is normalized to `null` at the persistence layer.
 */
export const giftMessageSchema = z
  .string()
  .transform((raw) => raw.replace(CONTROL_CHARS_RE, '').trim())
  .refine((value) => value.length <= GIFT_MESSAGE_MAX, {
    message: 'Gift message can be at most 300 characters.',
  });

/** `''` (post-trim empty) → `null`; used before every DB write. */
export function normalizeGiftMessage(
  message: string | null | undefined,
): string | null {
  if (message === null || message === undefined) return null;
  const cleaned = message.replace(CONTROL_CHARS_RE, '').trim();
  return cleaned.length === 0 ? null : cleaned;
}

/* ------------------------------------------------------------------ */
/* CartView (Contract §2.3)                                            */
/* ------------------------------------------------------------------ */

export const CART_STOCK_STATES = ['ok', 'low', 'out'] as const;
export const cartStockStateSchema = z.enum(CART_STOCK_STATES);
export type CartStockState = z.infer<typeof cartStockStateSchema>;

export const cartLineSchema = z.object({
  itemId: uuidSchema,
  variantId: uuidSchema,
  productSlug: slugSchema,
  name: z.string(),
  variantName: z.string(),
  /** Design-system placeholder tone (fallback swatch when no image). */
  tone: productToneSchema,
  /** Primary product image URL, or null → render the placeholder swatch. */
  imageUrl: z.string().nullable(),
  /** LIVE `product_variants.price_paise` at read time — never a snapshot. */
  unitPricePaise: z.number().int().positive(),
  qty: z.number().int().min(1).max(CART_QTY_MAX),
  giftWrap: z.boolean(),
  giftMessage: z.string().max(GIFT_MESSAGE_MAX).nullable(),
  lineTotalPaise: z.number().int().min(0),
  stockState: cartStockStateSchema,
});
export type CartLineView = z.infer<typeof cartLineSchema>;

export const cartCouponViewSchema = z.object({
  code: z.string(),
  /** Display ESTIMATE only — checkout quote is the authoritative number. */
  discountPaise: z.number().int().min(0),
});
export type CartCouponView = z.infer<typeof cartCouponViewSchema>;

export const cartViewSchema = z.object({
  /**
   * Cart row uuid, or `''` when no cart exists yet — `getCart()` never
   * creates a row (and never throws); the first mutation does.
   */
  id: z.union([uuidSchema, z.literal('')]),
  lines: z.array(cartLineSchema),
  /** Excludes `stockState: 'out'` lines (module spec §5, GET /api/cart). */
  subtotalPaise: z.number().int().min(0),
  giftWrapTotalPaise: z.number().int().min(0),
  coupon: cartCouponViewSchema.nullable(),
  freeShippingThresholdPaise: z.number().int().min(0),
  /** Total item qty across all lines — feeds the header badge. */
  count: z.number().int().min(0),
});
export type CartView = z.infer<typeof cartViewSchema>;

/** The empty cart every unknown/invalid/absent cookie resolves to. */
export function emptyCartView(freeShippingThresholdPaise = 0): CartView {
  return {
    id: '',
    lines: [],
    subtotalPaise: 0,
    giftWrapTotalPaise: 0,
    coupon: null,
    freeShippingThresholdPaise,
    count: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Action input schemas (module spec §1 — `.strict()`, unknown keys    */
/* rejected with VALIDATION_ERROR)                                     */
/* ------------------------------------------------------------------ */

export const addToCartInputSchema = z
  .object({
    variantId: uuidSchema,
    qty: z
      .number()
      .int()
      .min(1, 'Quantity must be between 1 and 20.')
      .max(CART_QTY_MAX, 'Quantity must be between 1 and 20.'),
    giftWrap: z.boolean().optional(),
    giftMessage: giftMessageSchema.optional(),
  })
  .strict();
export type AddToCartInput = z.input<typeof addToCartInputSchema>;

export const updateCartItemInputSchema = z
  .object({
    itemId: uuidSchema,
    /** 0 means remove the line (module spec §1). */
    qty: z
      .number()
      .int()
      .min(0, 'Quantity must be between 0 and 20.')
      .max(CART_QTY_MAX, 'Quantity must be between 0 and 20.'),
  })
  .strict();
export type UpdateCartItemInput = z.input<typeof updateCartItemInputSchema>;

export const setGiftOptionsInputSchema = z
  .object({
    itemId: uuidSchema,
    giftWrap: z.boolean(),
    giftMessage: giftMessageSchema.optional(),
  })
  .strict();
export type SetGiftOptionsInput = z.input<typeof setGiftOptionsInputSchema>;

export const removeCartItemInputSchema = z
  .object({ itemId: uuidSchema })
  .strict();
export type RemoveCartItemInput = z.input<typeof removeCartItemInputSchema>;

/** ` welcome10 ` ⇒ `WELCOME10`; compared as citext server-side. */
export const applyCouponInputSchema = z
  .object({
    code: z
      .string()
      .transform((raw) => raw.trim().toUpperCase())
      .pipe(
        z
          .string()
          .regex(/^[A-Z0-9]{3,24}$/, "This coupon code isn't valid."),
      ),
  })
  .strict();
export type ApplyCouponInput = z.input<typeof applyCouponInputSchema>;

/* ------------------------------------------------------------------ */
/* Pure cart math                                                      */
/* ------------------------------------------------------------------ */

/**
 * stockState for a line given LIVE variant data. Archived (`!isActive`)
 * or dangling variants are 'out' — rendered, excluded from totals,
 * checkout-blocking (edge case §7.4).
 */
export function stockStateForLine(
  isActive: boolean,
  stockQuantity: number,
  lowStockThreshold: number,
): CartStockState {
  if (!isActive || stockQuantity <= 0) return 'out';
  return stockQuantity <= lowStockThreshold ? 'low' : 'ok';
}

export interface CartTotals {
  subtotalPaise: Paise;
  giftWrapTotalPaise: Paise;
  count: number;
}

/**
 * Integer-paise totals over composed lines.
 * - `subtotalPaise` excludes `stockState: 'out'` lines.
 * - Wrap fee is PER LINE, flat (edge case §7.8) — not per unit — and only
 *   counted for purchasable (non-out) wrapped lines.
 * - `count` is total qty across ALL lines (header badge = what's in the
 *   cart, including lines awaiting removal).
 */
export function computeCartTotals(
  lines: readonly Pick<
    CartLineView,
    'lineTotalPaise' | 'giftWrap' | 'qty' | 'stockState'
  >[],
  giftWrapFeePaise: number,
): CartTotals {
  let subtotal = toPaise(0);
  let wrappedLines = 0;
  let count = 0;
  for (const line of lines) {
    count += line.qty;
    if (line.stockState === 'out') continue;
    subtotal = addPaise(subtotal, toPaise(line.lineTotalPaise));
    if (line.giftWrap) wrappedLines += 1;
  }
  return {
    subtotalPaise: subtotal,
    giftWrapTotalPaise: multiplyPaise(toPaise(giftWrapFeePaise), wrappedLines),
    count,
  };
}

/** Coupon fields needed for the display-only discount estimate. */
export interface CouponForEstimate {
  percentBp: number | null;
  flatPaise: number | null;
  maxDiscountPaise: number | null;
}

/**
 * DISPLAY-ONLY discount estimate (module spec §5 — the checkout quote is
 * the authoritative pricing point). Pure integer math:
 * percent ⇒ floor(subtotal × bp / 10000), capped at `maxDiscountPaise`;
 * flat ⇒ `flatPaise`. Never exceeds the subtotal, never negative.
 */
export function estimateCouponDiscount(
  coupon: CouponForEstimate,
  subtotalPaise: number,
): Paise {
  const subtotal = toPaise(Math.max(0, subtotalPaise));
  let raw = 0;
  if (coupon.percentBp !== null) {
    raw = Math.floor((subtotal * coupon.percentBp) / 10_000);
    if (coupon.maxDiscountPaise !== null) {
      raw = Math.min(raw, coupon.maxDiscountPaise);
    }
  } else if (coupon.flatPaise !== null) {
    raw = coupon.flatPaise;
  }
  return toPaise(Math.max(0, Math.min(raw, subtotal)));
}

/* ------------------------------------------------------------------ */
/* Merge policy (login merge — executed inside OTP verify, §3.5)       */
/* ------------------------------------------------------------------ */

/** The subset of a cart line the merge policy operates on. */
export interface MergeCartLine {
  variantId: string;
  qty: number;
  giftWrap: boolean;
  giftMessage: string | null;
}

/**
 * PURE merge of guest lines into a customer's lines (Contract merge
 * policy / cart.md §5 "Merge contract" + edge cases §7.2–7.3):
 *
 * - Dedupe by `variantId` (also within each input, defensively — the DB
 *   UNIQUE(cart_id, variant_id) should make intra-cart dupes impossible).
 * - Same variant in both ⇒ quantities SUMMED, capped at 20 and — when a
 *   `stockByVariantId` map is supplied — at live stock.
 * - Gift wrap/message conflicts resolve in favor of the GUEST line (most
 *   recent intent), including a guest `null` clearing an owned message.
 * - A variant absent from a supplied stock map, or with stock ≤ 0, is
 *   dropped (a line can never persist with qty < 1).
 * - Output order: owned lines first (stable), then new guest-only lines.
 * - Inputs are never mutated. Coupon policy (guest coupon wins only if
 *   the customer cart has none) lives with the caller — it is cart-level,
 *   not line-level.
 */
export function mergeCartLines(
  guestLines: readonly MergeCartLine[],
  ownedLines: readonly MergeCartLine[],
  stockByVariantId?: Readonly<Record<string, number>>,
): MergeCartLine[] {
  const clamp = (variantId: string, qty: number): number => {
    let max = CART_QTY_MAX;
    if (stockByVariantId !== undefined) {
      max = Math.min(max, stockByVariantId[variantId] ?? 0);
    }
    return Math.min(qty, max);
  };

  // Dedupe each side by variantId (sum qtys; later gift fields win —
  // "most recent intent" applies within a side too).
  const fold = (lines: readonly MergeCartLine[]): Map<string, MergeCartLine> => {
    const byVariant = new Map<string, MergeCartLine>();
    for (const line of lines) {
      const existing = byVariant.get(line.variantId);
      byVariant.set(line.variantId, {
        variantId: line.variantId,
        qty: Math.min(CART_QTY_MAX, (existing?.qty ?? 0) + line.qty),
        giftWrap: line.giftWrap,
        giftMessage: line.giftMessage,
      });
    }
    return byVariant;
  };

  const guest = fold(guestLines);
  const owned = fold(ownedLines);
  const merged: MergeCartLine[] = [];

  for (const ownedLine of owned.values()) {
    const guestLine = guest.get(ownedLine.variantId);
    const summed = ownedLine.qty + (guestLine?.qty ?? 0);
    const qty = clamp(ownedLine.variantId, Math.min(summed, CART_QTY_MAX));
    if (qty < 1) continue; // out of stock at merge time — line dropped
    merged.push({
      variantId: ownedLine.variantId,
      qty,
      // Guest gift fields win on collision (edge case §7.2).
      giftWrap: guestLine !== undefined ? guestLine.giftWrap : ownedLine.giftWrap,
      giftMessage:
        guestLine !== undefined ? guestLine.giftMessage : ownedLine.giftMessage,
    });
  }

  for (const guestLine of guest.values()) {
    if (owned.has(guestLine.variantId)) continue; // already folded above
    const qty = clamp(guestLine.variantId, guestLine.qty);
    if (qty < 1) continue;
    merged.push({
      variantId: guestLine.variantId,
      qty,
      giftWrap: guestLine.giftWrap,
      giftMessage: guestLine.giftMessage,
    });
  }

  return merged;
}
