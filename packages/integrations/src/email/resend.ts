import { parseServerEnv } from "@kakoa/config";
import type { EmailProvider } from "./provider";

/**
 * Resend transactional email provider (storefront launch-gate).
 *
 * Resend is the delivery pipe ONLY. No file outside this directory may import
 * Resend specifics.
 *
 * Failure behavior (mirrors the MSG91 SMS provider):
 *   - timeout (5s budget) or 5xx → one immediate retry, then throw.
 *   - 4xx (bad api key / bad from address) → no retry, throw immediately (config bug).
 *
 * NEVER logs the api key. Callers wrap sends in try/catch (best-effort), so a
 * throw here degrades to "no email sent", never a broken order.
 */

const EMAILS_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 5_000;

class TransientResendError extends Error {}
class PermanentResendError extends Error {}

export class ResendEmailProvider implements EmailProvider {
  async send(a: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    idempotencyKey?: string;
  }): Promise<{ providerMessageId: string | null }> {
    const env = parseServerEnv();
    const apiKey = env.RESEND_API_KEY;
    const from = env.EMAIL_FROM;

    if (apiKey === undefined || from === undefined) {
      // Should never happen: getEmailProvider only selects this provider when
      // RESEND_API_KEY is present. A missing EMAIL_FROM is a deploy-config bug.
      throw new PermanentResendError(
        "Resend provider selected without RESEND_API_KEY / EMAIL_FROM",
      );
    }

    // verify Resend field names at integration (from/to/subject/html/text).
    const body = JSON.stringify({
      from,
      to: a.to,
      subject: a.subject,
      html: a.html,
      ...(a.text !== undefined ? { text: a.text } : {}),
    });

    try {
      return await this.postOnce(apiKey, body, a.idempotencyKey);
    } catch (err) {
      if (err instanceof PermanentResendError) throw err;
      // Transient (timeout / 5xx): one immediate retry, then propagate.
      return await this.postOnce(apiKey, body, a.idempotencyKey);
    }
  }

  private async postOnce(
    apiKey: string,
    body: string,
    idempotencyKey: string | undefined,
  ): Promise<{ providerMessageId: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    if (idempotencyKey !== undefined) {
      // verify Resend field names at integration (Idempotency-Key header).
      headers["Idempotency-Key"] = idempotencyKey;
    }

    let res: Response;
    try {
      res = await fetch(EMAILS_ENDPOINT, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
    } catch {
      // Network error or abort (timeout) → transient, eligible for one retry.
      throw new TransientResendError("Resend request failed or timed out");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 500) {
      throw new TransientResendError(`Resend 5xx: ${res.status}`);
    }
    if (res.status >= 400) {
      // 4xx = config bug (bad api key / from address): do not retry.
      throw new PermanentResendError(`Resend 4xx: ${res.status}`);
    }

    const providerMessageId = await this.extractMessageId(res);
    return { providerMessageId };
  }

  private async extractMessageId(res: Response): Promise<string | null> {
    try {
      const json: unknown = await res.json();
      // verify Resend field names at integration (response `id`).
      if (
        typeof json === "object" &&
        json !== null &&
        "id" in json &&
        typeof (json as { id: unknown }).id === "string"
      ) {
        return (json as { id: string }).id;
      }
    } catch {
      // Non-JSON 2xx body — accept delivery, no id available.
    }
    return null;
  }
}
