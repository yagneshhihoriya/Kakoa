import { createHmac, timingSafeEqual } from "node:crypto";
import { parseServerEnv } from "@kakoa/config";
import type { PaymentProvider } from "./provider";

/**
 * Razorpay payment provider (payments-razorpay.md, checkout.md §3).
 *
 * Razorpay is the gateway pipe ONLY. No file outside this directory may import
 * Razorpay specifics.
 *
 * Failure behavior (checkout.md §3):
 *   - timeout (5s budget) or 5xx → one immediate retry, then throw → 502 upstream.
 *   - 4xx (bad key / bad request) → no retry, throw immediately (config bug).
 *
 * NEVER logs the key secret.
 */

const ORDERS_ENDPOINT = "https://api.razorpay.com/v1/orders";
const PAYMENTS_ENDPOINT = "https://api.razorpay.com/v1/payments";
const TIMEOUT_MS = 5_000;

class TransientRazorpayError extends Error {}
class PermanentRazorpayError extends Error {}

export class RazorpayPaymentProvider implements PaymentProvider {
  async createOrder(a: {
    orderNumber: string;
    amountPaise: number;
    receipt: string;
  }): Promise<{
    providerOrderId: string;
    amountPaise: number;
    currency: string;
    keyId: string;
  }> {
    const env = parseServerEnv();
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;

    if (keyId === undefined || keySecret === undefined) {
      // Should never happen: getPaymentProvider only selects this provider when
      // RAZORPAY_KEY_ID is present. Treated as a config bug (no retry).
      throw new PermanentRazorpayError(
        "Razorpay provider selected without key config",
      );
    }

    // Razorpay Orders API wants the amount in the smallest currency unit (paise).
    // verify exact field names at integration.
    const body = JSON.stringify({
      amount: a.amountPaise,
      currency: "INR",
      receipt: a.receipt,
    });

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    let providerOrderId: string;
    try {
      providerOrderId = await this.postOnce(auth, body);
    } catch (err) {
      if (err instanceof PermanentRazorpayError) throw err;
      // Transient (timeout / 5xx): one immediate retry, then propagate.
      providerOrderId = await this.postOnce(auth, body);
    }

    return {
      providerOrderId,
      amountPaise: a.amountPaise,
      currency: "INR",
      keyId,
    };
  }

  private async postOnce(auth: string, body: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(ORDERS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body,
        signal: controller.signal,
      });
    } catch {
      // Network error or abort (timeout) → transient, eligible for one retry.
      throw new TransientRazorpayError("Razorpay request failed or timed out");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 500) {
      throw new TransientRazorpayError(`Razorpay 5xx: ${res.status}`);
    }
    if (res.status >= 400) {
      // 4xx = config/request bug (bad key / bad body): do not retry.
      throw new PermanentRazorpayError(`Razorpay 4xx: ${res.status}`);
    }

    return this.extractOrderId(res);
  }

  private async extractOrderId(res: Response): Promise<string> {
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new PermanentRazorpayError("Razorpay 2xx with non-JSON body");
    }
    if (
      typeof json === "object" &&
      json !== null &&
      "id" in json &&
      typeof (json as { id: unknown }).id === "string"
    ) {
      return (json as { id: string }).id;
    }
    throw new PermanentRazorpayError("Razorpay order response missing id");
  }

  verifySignature(a: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean {
    const env = parseServerEnv();
    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (keySecret === undefined) {
      throw new PermanentRazorpayError(
        "Razorpay verifySignature without key secret",
      );
    }

    // Razorpay signs `${order_id}|${payment_id}` with HMAC-SHA256 keyed by the
    // key secret, hex-encoded. verify exact field names at integration.
    const expected = createHmac("sha256", keySecret)
      .update(`${a.providerOrderId}|${a.providerPaymentId}`)
      .digest("hex");

    return safeEqualHex(expected, a.signature);
  }

  /**
   * Refund a captured payment: `POST /v1/payments/:id/refund` with the amount in
   * paise and `speed: 'optimum'` (instant where the rail supports it, else normal
   * — Razorpay downgrades automatically). The `Idempotency-Key` header (KAKOA's
   * `refunds.id`) makes a retried call return the SAME refund, never a second one.
   *
   * Failure behaviour mirrors `createOrder`: timeout/5xx → one retry then throw;
   * 4xx → throw immediately (no retry). NEVER logs the key secret.
   */
  async refund(a: {
    providerPaymentId: string;
    amountPaise: number;
    idempotencyKey: string;
    notes?: Record<string, string>;
  }): Promise<{
    providerRefundId: string;
    status: "processed" | "pending" | "failed";
  }> {
    const env = parseServerEnv();
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (keyId === undefined || keySecret === undefined) {
      throw new PermanentRazorpayError(
        "Razorpay provider selected without key config",
      );
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const body = JSON.stringify({
      amount: a.amountPaise,
      speed: "optimum",
      ...(a.notes !== undefined ? { notes: a.notes } : {}),
    });
    const url = `${PAYMENTS_ENDPOINT}/${encodeURIComponent(
      a.providerPaymentId,
    )}/refund`;

    try {
      return await this.refundOnce(url, auth, body, a.idempotencyKey);
    } catch (err) {
      if (err instanceof PermanentRazorpayError) throw err;
      return await this.refundOnce(url, auth, body, a.idempotencyKey);
    }
  }

  private async refundOnce(
    url: string,
    auth: string,
    body: string,
    idempotencyKey: string,
  ): Promise<{
    providerRefundId: string;
    status: "processed" | "pending" | "failed";
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
          // Razorpay idempotency: a retried refund with the same key returns the
          // original refund rather than creating a second one.
          "Idempotency-Key": idempotencyKey,
        },
        body,
        signal: controller.signal,
      });
    } catch {
      throw new TransientRazorpayError("Razorpay refund failed or timed out");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 500) {
      throw new TransientRazorpayError(`Razorpay 5xx: ${res.status}`);
    }
    if (res.status >= 400) {
      throw new PermanentRazorpayError(`Razorpay 4xx: ${res.status}`);
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new PermanentRazorpayError("Razorpay refund 2xx with non-JSON body");
    }
    if (
      typeof json !== "object" ||
      json === null ||
      typeof (json as { id?: unknown }).id !== "string"
    ) {
      throw new PermanentRazorpayError("Razorpay refund response missing id");
    }
    const id = (json as { id: string }).id;
    // Razorpay refund status ∈ pending | processed | failed. Anything else we
    // treat as pending (awaiting the refund.processed webhook) rather than
    // optimistically marking it done.
    const rawStatus = (json as { status?: unknown }).status;
    const status =
      rawStatus === "processed" || rawStatus === "failed"
        ? rawStatus
        : "pending";
    return { providerRefundId: id, status };
  }
}

/**
 * Constant-time comparison of two hex strings. Returns false (never throws) when
 * lengths differ, so a mismatched-length forgery cannot be distinguished by timing.
 */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}
