import { parseServerEnv } from "@kakoa/config";
import type { EmailProvider } from "./provider";

/**
 * In-memory email provider for local dev and tests (storefront launch-gate).
 *
 * Delivers nothing over the wire. It records every call so tests can assert on
 * what would have been sent, and — in non-production only — logs a structured
 * `email.debug` line so a developer can see the store confirmed an order.
 * NEVER active in production (see getEmailProvider): production without a
 * RESEND_API_KEY simply has no working email path, which is a deploy-config
 * error, not a silent fallback to the fake.
 */

export interface SentEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
  providerMessageId: string;
  at: string;
}

const sent: SentEmail[] = [];

/** All emails "sent" via the fake provider this process, oldest first (tests). */
export function getSentEmails(): readonly SentEmail[] {
  return sent;
}

/** Clear the recorded-call buffer (test isolation between cases). */
export function clearSentEmails(): void {
  sent.length = 0;
}

/**
 * Derive a stable-ish fake message id from the recipient + subject so tests can
 * key on it. Prefer the caller's idempotency key when present so a deduped retry
 * yields the same id.
 */
function fakeMessageId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `fake-${h.toString(36)}`;
}

export class FakeEmailProvider implements EmailProvider {
  async send(a: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    idempotencyKey?: string;
  }): Promise<{ providerMessageId: string | null }> {
    const providerMessageId = fakeMessageId(
      a.idempotencyKey ?? `${a.to}|${a.subject}`,
    );

    sent.push({
      to: a.to,
      subject: a.subject,
      html: a.html,
      ...(a.text !== undefined ? { text: a.text } : {}),
      ...(a.idempotencyKey !== undefined
        ? { idempotencyKey: a.idempotencyKey }
        : {}),
      providerMessageId,
      at: new Date().toISOString(),
    });

    // Non-production only: emit a structured line so local dev / Playwright can
    // see that the store would have mailed the customer. Never logs the body.
    if (parseServerEnv().APP_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          event: "email.debug",
          to: a.to,
          subject: a.subject,
        }),
      );
    }

    return { providerMessageId };
  }
}
