import { createHmac, timingSafeEqual } from "node:crypto";
import { parseServerEnv } from "@kakoa/config";
import type { PaymentProvider } from "./provider";

/**
 * In-memory payment provider for local dev and tests (checkout.md §3, mock note).
 *
 * Talks to no gateway. `createOrder` mints a fake gateway order id; `simulatePayment`
 * mints a fake payment id + a valid signature (the same HMAC the real Razorpay path
 * verifies), so the whole prepaid flow — create → pay → verify — runs locally with
 * NO Razorpay keys. Selected by getPaymentProvider whenever RAZORPAY_KEY_ID is unset.
 *
 * The signing key falls back to a fixed "mock_secret" when RAZORPAY_KEY_SECRET is
 * absent, so verification is self-consistent in a keyless environment.
 */

const MOCK_KEY_ID = "rzp_test_mock";
const MOCK_SECRET_FALLBACK = "mock_secret";

/**
 * Monotonic-ish counter so ids minted within the same millisecond stay unique.
 * This is a non-prod mock, so a process-local counter + time is sufficient and
 * avoids any reliance on Math.random for id shape.
 */
let idCounter = 0;

function shortHex(): string {
  idCounter = (idCounter + 1) >>> 0;
  const seed = `${Date.now().toString(16)}${idCounter.toString(16)}`;
  // 8 hex chars derived deterministically from time+counter.
  return createHmac("sha256", "mock_id")
    .update(seed)
    .digest("hex")
    .slice(0, 8);
}

function mockSecret(): string {
  return parseServerEnv().RAZORPAY_KEY_SECRET ?? MOCK_SECRET_FALLBACK;
}

/** HMAC-SHA256 hex over `${orderId}|${paymentId}`, matching the Razorpay scheme. */
function mockSignature(providerOrderId: string, providerPaymentId: string): string {
  return createHmac("sha256", mockSecret())
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

export class MockPaymentProvider implements PaymentProvider {
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
    return {
      providerOrderId: `order_mock_${shortHex()}`,
      amountPaise: a.amountPaise,
      currency: "INR",
      keyId: MOCK_KEY_ID,
    };
  }

  verifySignature(a: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean {
    const expected = mockSignature(a.providerOrderId, a.providerPaymentId);
    return safeEqualHex(expected, a.signature);
  }

  /**
   * Mock-only: simulate a successful gateway payment for an existing order.
   * Returns a fake payment id and the matching valid signature, so a test/dev
   * client can post them to the verify endpoint and pass verifySignature.
   */
  simulatePayment(providerOrderId: string): {
    providerPaymentId: string;
    signature: string;
  } {
    const providerPaymentId = `pay_mock_${shortHex()}`;
    return {
      providerPaymentId,
      signature: mockSignature(providerOrderId, providerPaymentId),
    };
  }

  /**
   * Mock refund: no gateway call. Mints a fake `rfnd_mock_*` id and reports the
   * refund as immediately `processed`, so the full cancel → refund flow runs
   * end-to-end locally with no Razorpay keys. `amountPaise` must be positive
   * (a full/partial reversal); a non-positive amount is a caller bug.
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- async to satisfy the interface
  async refund(a: {
    providerPaymentId: string;
    amountPaise: number;
    idempotencyKey: string;
    notes?: Record<string, string>;
  }): Promise<{
    providerRefundId: string;
    status: 'processed' | 'pending' | 'failed';
  }> {
    if (!Number.isSafeInteger(a.amountPaise) || a.amountPaise <= 0) {
      throw new Error(`MockPaymentProvider.refund: bad amountPaise ${a.amountPaise}`);
    }
    return {
      providerRefundId: `rfnd_mock_${shortHex()}`,
      status: 'processed',
    };
  }
}
