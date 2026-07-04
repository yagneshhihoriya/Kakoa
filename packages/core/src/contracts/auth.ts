/**
 * Auth (OTP login) contracts — auth-otp.md §1.1/§1.2/§5, Contract §2.4.
 *
 * zod `.strict()` schemas are the single source of truth for the two OTP
 * request bodies; TS types are `z.infer` only. View/result types describe the
 * `ApiResult` payloads returned by `/api/auth/verify` and `/api/auth/me`.
 *
 * Note: `destination` is validated only for length/presence here — channel-
 * specific normalization (phone → E.164 via `normalizePhoneE164`, email
 * lowercasing) happens in the Route Handler, since a normalized-then-invalid
 * phone must map to the sms field message, not a generic string error.
 */

import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Request bodies                                                      */
/* ------------------------------------------------------------------ */

// Channel type lives in ./enums (OtpChannel / OTP_CHANNELS) — reuse it here
// rather than re-declaring, to avoid a duplicate export from the core barrel.
export const otpChannelSchema = z.enum(['sms', 'email']);

/**
 * `POST /api/auth/otp/request` body (§1.1). Login UI sends `channel: 'sms'`;
 * `'email'` is accepted for the email-verify flow. `purpose` is locked to
 * `'customer_login'` on this route — other purposes are owned by their own
 * endpoints. `destination` is length-capped only; format is enforced after
 * channel-specific normalization server-side.
 */
export const otpRequestInputSchema = z
  .object({
    channel: otpChannelSchema,
    destination: z.string().min(1).max(254),
    purpose: z.literal('customer_login'),
  })
  .strict();
export type OtpRequestInput = z.infer<typeof otpRequestInputSchema>;

/**
 * `POST /api/auth/otp/verify` body (§1.2). `code` is trimmed then must be
 * exactly 6 digits — leading zeros significant (`042917` is valid/distinct).
 * Unknown/malformed `challengeId` is treated as the 410 path (no oracle).
 */
export const otpVerifyInputSchema = z
  .object({
    challengeId: z.string().uuid(),
    code: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/),
  })
  .strict();
export type OtpVerifyInput = z.infer<typeof otpVerifyInputSchema>;

/* ------------------------------------------------------------------ */
/* Response payloads                                                   */
/* ------------------------------------------------------------------ */

/**
 * Full customer projection returned by `GET /api/auth/me` (§5.4). Timestamps
 * are ISO-8601 UTC strings; the UI renders them via `formatIST()`.
 */
export interface CustomerView {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

/**
 * `POST /api/auth/otp/verify` success payload (§5.2). The nested `customer`
 * is the trimmed shape the login response returns (phone is always set post-
 * verify for the sms flow); `cartMerged` / `isNewCustomer` drive UI toasts.
 */
export interface AuthVerifyResult {
  customer: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  };
  /** Guest cart lines folded into the customer cart during this verify. */
  cartMerged: boolean;
  /** `customers` row created (first-ever login) by this verify. */
  isNewCustomer: boolean;
}
