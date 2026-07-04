/**
 * Order tracking contracts — order-tracking.md §1/§5, Contract §2.6.
 *
 * The customer-facing read/lookup/cancel surface. zod `.strict()` schemas are
 * the single source of truth for every tracking request body; TS types are
 * `z.infer` for inputs and explicit interfaces for the read/response shapes.
 *
 * Three auth paths converge on ONE tracking read (session-owner / 30-min
 * tracking JWT via guest OTP / order `access_token` ≤24h); NONE of these
 * schemas encode that authority — they validate the payloads only. There is no
 * order-existence oracle: an identical `200` answers `request-otp` whether or
 * not the order exists, so these schemas never reveal state.
 *
 * The `phone` field mirrors the auth/checkout normalization: raw input
 * (`+91`/`91`/`0`/bare 10-digit, with separators) is collapsed to canonical
 * `+91XXXXXXXXXX` via `normalizePhoneE164`, so the schema OUTPUT is the same
 * E.164 value stored on `orders.contact_phone` and counted for rate limits.
 */

import { z } from 'zod';

import { normalizePhoneE164 } from '../phone';
import type { PAYMENT_MODES } from '../enums';

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

/**
 * Human order number: `KK-` + exactly 5 digits (e.g. `KK-48210`). Pinned to
 * five digits to match the tracking lookup contract; wider order numbers are a
 * separate (future) concern and are rejected here rather than silently matched.
 */
const orderNumberSchema = z
  .string()
  .trim()
  .regex(/^KK-\d{5}$/, "Enter a valid order number (e.g., KK-48210).");

/**
 * Indian mobile INPUT for lookup: accepts the raw `+91`/`91`/`0`/bare
 * 10-digit forms (with `[\s\-().]` separators) and NORMALIZES to canonical
 * `+91XXXXXXXXXX`. A value that cannot be normalized fails on the phone field,
 * mirroring the auth contract's field-level message.
 */
const phoneLookupSchema = z
  .string()
  .transform((raw) => normalizePhoneE164(raw))
  .refine((value): value is string => value !== null, {
    message: 'Enter a valid 10-digit Indian mobile number.',
  });

/**
 * OTP `code` for guest lookup verify: trimmed, then EXACTLY 6 digits. Leading
 * zeros are significant (`042917` is valid/distinct), matching the auth
 * verify contract.
 */
const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code we sent you.');

/* ------------------------------------------------------------------ */
/* Cancellation reason (order-tracking.md §1 — 3–500 graphemes)         */
/* ------------------------------------------------------------------ */

/** Cancellation reason bounds, measured in GRAPHEMES (not UTF-16 code units). */
export const CANCEL_REASON_MIN = 3;
export const CANCEL_REASON_MAX = 500;

/**
 * Count user-perceived characters (graphemes), so an emoji or a combined
 * character (e.g. a family emoji, or `é` as `e` + combining accent) counts as
 * one — never several UTF-16 code units. `Intl.Segmenter` is available on every
 * runtime this package targets (Node 18+ / modern browsers).
 */
export function countGraphemes(value: string): number {
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  let count = 0;
  for (const _ of segmenter.segment(value)) count += 1;
  return count;
}

/**
 * Cancellation reason: trimmed, then bounded to 3–500 GRAPHEMES. Free text is
 * accepted verbatim otherwise (persisted to `orders.cancel_reason`).
 */
const cancelReasonSchema = z
  .string()
  .trim()
  .refine((value) => countGraphemes(value) >= CANCEL_REASON_MIN, {
    message: `Tell us why in at least ${CANCEL_REASON_MIN} characters.`,
  })
  .refine((value) => countGraphemes(value) <= CANCEL_REASON_MAX, {
    message: `Please keep the reason under ${CANCEL_REASON_MAX} characters.`,
  });

/* ------------------------------------------------------------------ */
/* Request bodies (order-tracking.md §5)                               */
/* ------------------------------------------------------------------ */

/**
 * `POST /api/orders/lookup/request-otp` body. Fires an OTP to the order's
 * contact phone IFF `{orderNumber, phone}` match — but the route returns an
 * identical `200` regardless, so this schema is the ONLY gate the client sees.
 */
export const lookupRequestSchema = z
  .object({
    orderNumber: orderNumberSchema,
    phone: phoneLookupSchema,
  })
  .strict();
export type LookupRequestInput = z.infer<typeof lookupRequestSchema>;

/**
 * `POST /api/orders/lookup/verify` body. On success the route mints a 30-min
 * tracking JWT scoped to the resolved order.
 */
export const lookupVerifySchema = z
  .object({
    orderNumber: orderNumberSchema,
    phone: phoneLookupSchema,
    code: codeSchema,
  })
  .strict();
export type LookupVerifyInput = z.infer<typeof lookupVerifySchema>;

/**
 * `POST /api/orders/[orderNumber]/cancel` body. The only order transition this
 * module performs (→cancelled, pre-dispatch); the order is taken from the route
 * param, so only the reason travels in the body.
 */
export const cancelOrderSchema = z
  .object({
    reason: cancelReasonSchema,
  })
  .strict();
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

/* ------------------------------------------------------------------ */
/* Read shapes (order-tracking.md §5)                                  */
/* ------------------------------------------------------------------ */

/**
 * The minimal order confirmation object returned by the tracking read and the
 * order-summary endpoint. `OrderSummary` is not (yet) exported by any other
 * contract, so it is defined here as the shared shape — kept byte-for-byte
 * compatible with the payload emitted by
 * `GET /api/orders/[orderNumber]/summary` (never line items, addresses, or a
 * money breakdown beyond the total). `contactPhoneMasked` is `maskPhone`'d;
 * `placedAt` is an ISO-8601 UTC string rendered via `formatIST()` at the edge.
 */
export interface OrderSummary {
  orderNumber: string;
  status: string;
  paymentMode: (typeof PAYMENT_MODES)[number];
  totalPaise: number;
  placedAt: string;
  itemCount: number;
  contactPhoneMasked: string;
}

/** Timeline node keys — the canonical fulfillment milestones + branches. */
export const TIMELINE_STEP_KEYS = [
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'rto_initiated',
  'rto_delivered',
] as const;
export type TimelineStepKey = (typeof TIMELINE_STEP_KEYS)[number];

/** Rendering state of a timeline node relative to the order's current status. */
export const TIMELINE_STEP_STATES = ['done', 'active', 'future'] as const;
export type TimelineStepState = (typeof TIMELINE_STEP_STATES)[number];

/**
 * One node in the tracking timeline, derived from `order_status_history`.
 * `at` is the ISO-8601 UTC timestamp the step was reached (`null` if not yet);
 * `expected` is an ISO-8601 UTC estimate for a future step (`null` if unknown).
 */
export interface TimelineStep {
  key: TimelineStepKey;
  label: string;
  state: TimelineStepState;
  at: string | null;
  expected: string | null;
}

/**
 * The full tracking read. `shipment` is `null` until the fulfillment module
 * populates AWB/courier data — the client renders that block gracefully.
 */
export interface OrderTracking {
  order: OrderSummary;
  timeline: TimelineStep[];
  shipment: {
    awb: string;
    courierName: string;
    expectedDeliveryAt: string | null;
  } | null;
}
