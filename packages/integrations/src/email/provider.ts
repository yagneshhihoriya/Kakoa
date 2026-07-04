/**
 * Transactional email delivery abstraction (storefront launch-gate).
 *
 * KAKOA composes the subject + HTML/text bodies itself (apps/web owns the
 * templates); the provider is purely the delivery pipe. Every consumer depends
 * on this interface only — no file outside `packages/integrations/src/email/**`
 * may import Resend specifics.
 *
 * Delivery is BEST-EFFORT at the call sites (order confirmation / cancellation
 * are sent after the money commit and never block it), but this interface still
 * signals a hard failure by throwing so the fake vs. real providers behave
 * identically and the caller's try/catch is the single swallow point.
 */
export interface EmailProvider {
  /**
   * Deliver one transactional email.
   *
   * @param a.to             - Recipient address (already validated upstream).
   * @param a.subject        - Rendered subject line.
   * @param a.html           - Rendered HTML body.
   * @param a.text           - Optional plain-text alternative.
   * @param a.idempotencyKey - Optional dedup key so a retried send (e.g. verify
   *   + webhook both confirming a prepaid order) never mails the customer twice.
   * @returns The upstream message id when available, else `null`.
   * @throws On a hard delivery failure (timeout/5xx after one retry, or 4xx).
   */
  send(a: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    idempotencyKey?: string;
  }): Promise<{ providerMessageId: string | null }>;
}
