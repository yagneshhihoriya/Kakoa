import { parseServerEnv } from "@kakoa/config";
import type { PaymentProvider } from "./provider";
import { MockPaymentProvider } from "./mock";
import { RazorpayPaymentProvider } from "./razorpay";

/**
 * Resolve the active payment provider (checkout.md §3).
 *
 * RazorpayPaymentProvider is used only when a real RAZORPAY_KEY_ID is configured;
 * otherwise the MockPaymentProvider drives the full local prepaid flow with no keys.
 */

let memo: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (memo !== null) return memo;

  const env = parseServerEnv();
  memo =
    env.RAZORPAY_KEY_ID !== undefined
      ? new RazorpayPaymentProvider()
      : new MockPaymentProvider();
  return memo;
}

/** Test-only: reset the memoized provider so env changes take effect. */
export function resetPaymentProvider(): void {
  memo = null;
}
