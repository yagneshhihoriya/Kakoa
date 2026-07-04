/**
 * Payment gateway abstraction for prepaid checkout (payments-razorpay.md, checkout.md §3).
 *
 * KAKOA owns order creation, amount authority, and signature verification intent;
 * the provider is the gateway pipe. No file outside `packages/integrations/src/payments/**`
 * may import Razorpay specifics; all consumers depend on this interface only.
 *
 * Money is always in paise (integer minor units). The provider never mutates or
 * re-derives the amount — it echoes the amount KAKOA computed in the quote/placement.
 */
export interface PaymentProvider {
  /**
   * Create a gateway order to authorize a prepaid payment against.
   *
   * @param a.orderNumber - KAKOA order number (e.g. `KK-00042`), for traceability.
   * @param a.amountPaise - Order total in paise; the exact amount to be charged.
   * @param a.receipt     - Idempotency/receipt string echoed to the gateway.
   * @returns The gateway order id + the amount/currency + the public key id the
   *   client needs to open the checkout widget.
   * @throws On a hard gateway failure (timeout/5xx after one retry, or 4xx) so the
   *   Route Handler can surface `502 UPSTREAM_ERROR` per checkout.md §3.
   */
  createOrder(a: {
    orderNumber: string;
    amountPaise: number;
    receipt: string;
  }): Promise<{
    providerOrderId: string;
    amountPaise: number;
    currency: string;
    keyId: string;
  }>;

  /**
   * Verify the gateway's payment callback signature.
   *
   * Recomputes HMAC-SHA256 over `providerOrderId|providerPaymentId` keyed by the
   * gateway secret and compares in constant time. Returns `false` on mismatch —
   * it never throws for a bad signature (that is an expected, attacker-reachable path).
   *
   * NOTE: verify the exact field names / concatenation order against the live
   * Razorpay integration at integration time.
   */
  verifySignature(a: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean;

  /**
   * Refund a captured payment back to the customer's original method
   * (returns-refunds.md §refund; cancellation auto-refund, cancel.ts §6).
   *
   * Full or partial: `amountPaise` is the exact amount to reverse. `speed`
   * defaults to instant-where-possible (`optimum`), falling back to normal
   * (5–7 business days) automatically at the gateway. `idempotencyKey` (KAKOA's
   * `refunds.id`) dedups a retried refund so a double-run never double-pays.
   *
   * @returns The gateway refund id + its status. `processed` = money is on its
   *   way to the source; `pending` = accepted, a `refund.processed` webhook/poll
   *   will confirm it (map to our `initiated` until then); `failed` = the gateway
   *   rejected it.
   * @throws On a hard gateway failure (timeout/5xx after one retry, or 4xx) so the
   *   caller can leave the `refunds` row `initiated` for a later sweep — the
   *   cancel/return itself never blocks or fails on the gateway.
   */
  refund(a: {
    providerPaymentId: string;
    amountPaise: number;
    idempotencyKey: string;
    notes?: Record<string, string>;
  }): Promise<{
    providerRefundId: string;
    status: 'processed' | 'pending' | 'failed';
  }>;
}
