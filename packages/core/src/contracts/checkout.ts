/**
 * Checkout contracts — checkout.md §1 (field-level spec) + §5 (API shapes),
 * Contract §2.5. zod `.strict()` schemas are the single source of truth for
 * every checkout payload; unknown keys are rejected with `VALIDATION_ERROR`.
 * TS types are `z.infer` (inputs) or explicit response interfaces (§5).
 *
 * NEVER trusted from the client: any price, fee, discount, tax figure, or line
 * total. The client sends line refs (via the cart cookie), `couponCode`, and
 * `expectedTotalPaise` only — the server recomputes everything from live
 * prices, stock, coupon state, and `store_settings`.
 *
 * Reuses the canonical enums (`DELIVERY_OPTIONS` / `PAYMENT_MODES`) and the GST
 * state-code validator rather than re-declaring them, so DB, quote, and
 * validation can never drift.
 */

import { z } from 'zod';

import { DELIVERY_OPTIONS, PAYMENT_MODES } from '../enums';
import { isValidStateCode } from '../gst-states';
import type { CartLineView } from './cart';

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

/**
 * C0/C1 control chars stripped from free-text address fields and notes.
 * `\n`/`\t` collapse to nothing here (single-line address inputs); newlines in
 * gift messages are handled by the cart contract, not this schema.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

/**
 * 10-digit Indian mobile INPUT rule (checkout.md §1.1). Accepts the raw digits
 * after the UI/Route Handler strips separators and a leading `+91`/`91`/`0`;
 * server-side normalization to `+91XXXXXXXXXX` happens via `normalizePhoneE164`
 * (kept out of the schema so a normalized-then-invalid value maps to the phone
 * field message, mirroring the auth contract).
 */
const phoneInputSchema = z
  .string()
  .trim()
  .regex(
    /^[6-9][0-9]{9}$/,
    'Enter a valid 10-digit Indian mobile number starting with 6–9.',
  );

/** Email (§1.1): trimmed + lowercased, RFC-ish, ≤254 (stored `citext`). */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Enter a valid email address (e.g., name@example.com).')
  .regex(
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    'Enter a valid email address (e.g., name@example.com).',
  );

/** UUID v4 (§1.5 `idempotencyKey`) — version + variant nibbles pinned. */
const uuidV4Schema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );

/** RFC-4122 UUID, any version (COD OTP `challengeId`, §1.3). */
const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

/** 6-digit Indian PIN regex (§1.2). Dataset + serviceability checks are runtime. */
const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit Indian PIN code.');

/** `couponCode` (§1.3): trim + uppercase, then `^[A-Z0-9-]{3,24}$`. */
const couponCodeSchema = z
  .string()
  .transform((raw) => raw.trim().toUpperCase())
  .pipe(
    z.string().regex(/^[A-Z0-9-]{3,24}$/, "Coupon code isn't valid."),
  );

export const deliveryOptionSchema = z.enum(DELIVERY_OPTIONS);
export const paymentModeSchema = z.enum(PAYMENT_MODES);

/** ₹1,00,000 sanity cap on `expectedTotalPaise` (§1.5). */
export const EXPECTED_TOTAL_MAX_PAISE = 10_000_000;

/** `customerNote` hard cap (§1.3). */
export const CUSTOMER_NOTE_MAX = 500;

/* ------------------------------------------------------------------ */
/* Contact (§1.1)                                                      */
/* ------------------------------------------------------------------ */

export const contactSchema = z
  .object({
    phone: phoneInputSchema,
    email: emailSchema.optional(),
  })
  .strict();
export type ContactInput = z.input<typeof contactSchema>;

/* ------------------------------------------------------------------ */
/* Shipping / billing address (§1.2)                                   */
/* ------------------------------------------------------------------ */

/** Free-text address line: strip control chars, then trim. */
const addressLine = (max: number, message: string) =>
  z
    .string()
    .transform((raw) => raw.replace(CONTROL_CHARS_RE, '').trim())
    .pipe(z.string().max(max, message));

export const addressInputSchema = z
  .object({
    /** Unicode letters + apostrophes/dots/hyphens — "D'Souza" must pass. */
    fullName: z
      .string()
      .trim()
      .regex(
        /^[\p{L}][\p{L}\p{M}\s.'-]{1,99}$/u,
        "Enter the recipient's full name (2–100 characters).",
      ),
    phone: phoneInputSchema,
    line1: addressLine(
      150,
      'Address line 1 is required (house/flat, street — min 3 characters).',
    ).pipe(
      z
        .string()
        .min(
          3,
          'Address line 1 is required (house/flat, street — min 3 characters).',
        ),
    ),
    line2: addressLine(150, 'Address line 2 must be 150 characters or fewer.')
      .optional(),
    landmark: addressLine(100, 'Landmark must be 100 characters or fewer.')
      .optional(),
    city: z
      .string()
      .trim()
      .regex(/^[\p{L}][\p{L}\s.-]{1,59}$/u, 'Enter a valid city name.'),
    /** Display name from the canonical GST list; selected, never free-typed. */
    state: z.string().trim().min(1, 'Select your state from the list.').max(50),
    /** Two-digit GST code; must be canonical AND drive the tax split. */
    stateCode: z
      .string()
      .trim()
      .refine(isValidStateCode, {
        message: 'State selection is invalid — please re-select your state.',
      }),
    pincode: pincodeSchema,
  })
  .strict();
export type AddressInput = z.infer<typeof addressInputSchema>;

/* ------------------------------------------------------------------ */
/* Quote request (§5.2)                                                */
/* ------------------------------------------------------------------ */

export const quoteRequestSchema = z
  .object({
    pincode: pincodeSchema,
    deliveryOption: deliveryOptionSchema,
    paymentMode: paymentModeSchema,
    couponCode: couponCodeSchema.optional(),
  })
  .strict();
export type QuoteRequestInput = z.input<typeof quoteRequestSchema>;

/* ------------------------------------------------------------------ */
/* COD OTP (§1.3)                                                      */
/* ------------------------------------------------------------------ */

export const codOtpSchema = z
  .object({
    challengeId: uuidSchema,
    code: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/),
  })
  .strict();
export type CodOtpInput = z.infer<typeof codOtpSchema>;

/* ------------------------------------------------------------------ */
/* Place order (§1.5 / §5.3)                                           */
/* ------------------------------------------------------------------ */

export const placeOrderInputSchema = z
  .object({
    /** UUID v4, minted client-side when Review renders; UNIQUE per attempt. */
    idempotencyKey: uuidV4Schema,
    contact: contactSchema,
    shippingAddress: addressInputSchema,
    /** Omitted ⇒ same as shipping (`orders.billing_address` NULL). */
    billingAddress: addressInputSchema.optional(),
    deliveryOption: deliveryOptionSchema,
    paymentMode: paymentModeSchema,
    couponCode: couponCodeSchema.optional(),
    customerNote: addressLine(
      CUSTOMER_NOTE_MAX,
      'Order note must be 500 characters or fewer.',
    ).optional(),
    /** What the UI displayed; server recomputes and compares → PRICE_CHANGED. */
    expectedTotalPaise: z
      .number()
      .int()
      .positive()
      .max(EXPECTED_TOTAL_MAX_PAISE),
    /** Required for COD unless the session has a verified matching phone. */
    codOtp: codOtpSchema.optional(),
  })
  .strict();
export type PlaceOrderInput = z.infer<typeof placeOrderInputSchema>;

/* ------------------------------------------------------------------ */
/* Verify payment (§5.4) — Razorpay JS success handler                 */
/* ------------------------------------------------------------------ */

export const verifyPaymentInputSchema = z
  .object({
    razorpayOrderId: z.string().trim().min(1),
    razorpayPaymentId: z.string().trim().min(1),
    razorpaySignature: z.string().trim().min(1),
  })
  .strict();
export type VerifyPaymentInput = z.infer<typeof verifyPaymentInputSchema>;

/* ------------------------------------------------------------------ */
/* Serviceability (§5.1)                                               */
/* ------------------------------------------------------------------ */

export interface ServiceabilityOption {
  option: 'standard' | 'express';
  feePaise: number;
  etaDaysMin: number;
  etaDaysMax: number;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  codAvailable: boolean;
  options: ServiceabilityOption[];
}

/* ------------------------------------------------------------------ */
/* Quote response (§5.2)                                               */
/* ------------------------------------------------------------------ */

/** Informational GST split extracted from GST-inclusive prices. */
export interface QuoteTaxIncluded {
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

export interface QuoteCoupon {
  code: string;
  discountPaise: number;
}

export interface CheckoutQuote {
  lines: CartLineView[];
  subtotalPaise: number;
  discountPaise: number;
  shippingFeePaise: number;
  codFeePaise: number;
  giftWrapTotalPaise: number;
  totalPaise: number;
  /** Informational — prices are GST-inclusive. */
  taxIncluded: QuoteTaxIncluded;
  coupon: QuoteCoupon | null;
  etaDaysMin: number;
  etaDaysMax: number;
}

/* ------------------------------------------------------------------ */
/* Place-order result (§5.3) — discriminated union                     */
/* ------------------------------------------------------------------ */

export interface RazorpayCheckoutPayload {
  orderId: string;
  keyId: string;
  amountPaise: number;
  currency: 'INR';
  prefill: { contact: string; email?: string };
}

export interface PlaceOrderPrepaidResult {
  paymentMode: 'prepaid';
  orderId: string;
  orderNumber: string;
  accessToken: string;
  razorpay: RazorpayCheckoutPayload;
}

export interface PlaceOrderCodResult {
  paymentMode: 'cod';
  orderId: string;
  orderNumber: string;
  accessToken: string;
  status: 'cod_pending_confirmation';
}

export type PlaceOrderResult = PlaceOrderPrepaidResult | PlaceOrderCodResult;
