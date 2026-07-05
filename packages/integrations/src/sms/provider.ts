/**
 * SMS delivery abstraction for OTP codes (auth-otp.md §3).
 *
 * KAKOA generates, stores (peppered SHA-256), and verifies OTPs itself; the
 * provider is purely the delivery pipe — it never validates codes. No file
 * outside `packages/integrations/src/msg91/**` may import MSG91 specifics; all
 * consumers depend on this interface only.
 */
export interface SmsProvider {
  /**
   * Deliver a one-time code to a phone number.
   *
   * @param a.phoneE164 - Normalized E.164 number, e.g. `+919876543210`.
   * @param a.code      - The 6-digit code to deliver (never logged raw).
   * @param a.purpose   - OTP purpose, e.g. `customer_login`.
   * @returns The upstream message id when available, else `null`.
   * @throws On a hard delivery failure (timeout/5xx after retry, or 4xx) so the
   *   Route Handler can surface `502 UPSTREAM_ERROR` per §3.
   */
  sendOtp(a: {
    phoneE164: string;
    code: string;
    purpose: string;
  }): Promise<{ providerMessageId: string | null }>;

  /**
   * Deliver a transactional (non-OTP) SMS — order shipped / delivered alerts.
   *
   * India DLT requires pre-approved templates; the real provider maps
   * `template` → its registered DLT template id. Until DLT is wired the real
   * provider may throw (callers send this best-effort, so a throw degrades to
   * "SMS not sent" and email remains the guaranteed channel).
   *
   * @param a.phoneE164 - Normalized E.164 number.
   * @param a.message   - Fully-rendered message body (already localized/short).
   * @param a.template  - Logical template key (e.g. `order_shipped`) for DLT mapping.
   * @returns The upstream message id when available, else `null`.
   * @throws On a hard delivery failure (or when no DLT template is configured).
   */
  sendText(a: {
    phoneE164: string;
    message: string;
    template: string;
  }): Promise<{ providerMessageId: string | null }>;
}
