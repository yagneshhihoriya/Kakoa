/**
 * Error code registry — Contract §2.1 (PROJECT_PLAN.md §3.0).
 *
 * Every expected failure across Route Handlers and Server Actions uses one
 * of these codes. The HTTP status column applies to Route Handlers; Server
 * Actions never throw for expected failures — they return `ApiErr`.
 */

export const ERROR_HTTP_STATUS = {
  VALIDATION_ERROR: 400,

  UNAUTHORIZED: 401,
  OTP_INCORRECT: 401,
  SIGNATURE_INVALID: 401,

  FORBIDDEN: 403,

  NOT_FOUND: 404,

  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  PRICE_CHANGED: 409,
  ALREADY_PROCESSED: 409,
  DUPLICATE_REQUEST: 409,

  GONE: 410,
  OTP_EXPIRED: 410,
  CART_EXPIRED: 410,
  TOKEN_EXPIRED: 410,

  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  COUPON_MIN_NOT_MET: 422,
  COUPON_EXHAUSTED: 422,
  COUPON_LIMIT_REACHED: 422,
  PINCODE_UNSERVICEABLE: 422,
  COD_UNAVAILABLE: 422,
  INVALID_TRANSITION: 422,
  RETURN_WINDOW_CLOSED: 422,
  REFUND_EXCEEDS_PAID: 422,

  RATE_LIMITED: 429,

  INTERNAL: 500,

  /** Stubbed surface shipped ahead of its owning module (e.g. add-to-bag before Cart). */
  NOT_IMPLEMENTED: 501,

  UPSTREAM_ERROR: 502,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_HTTP_STATUS;

export const ERROR_CODES = Object.keys(ERROR_HTTP_STATUS) as ErrorCode[];

/** HTTP status for a registered error code (Route Handlers only). */
export function httpStatusFor(code: ErrorCode): number {
  return ERROR_HTTP_STATUS[code];
}
