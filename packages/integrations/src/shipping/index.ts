import { parseServerEnv } from "@kakoa/config";
import type { ShippingProvider } from "./provider";
import { MockShippingProvider } from "./mock";
import { ShiprocketShippingProvider } from "./shiprocket";

/**
 * Resolve the active shipping provider (checkout.md §3).
 *
 * ShiprocketShippingProvider is used only when SHIPROCKET_EMAIL is configured;
 * otherwise the MockShippingProvider drives local serviceability with no keys.
 */

let memo: ShippingProvider | null = null;

export function getShippingProvider(): ShippingProvider {
  if (memo !== null) return memo;

  const env = parseServerEnv();
  memo =
    env.SHIPROCKET_EMAIL !== undefined
      ? new ShiprocketShippingProvider()
      : new MockShippingProvider();
  return memo;
}

/** Test-only: reset the memoized provider so env changes take effect. */
export function resetShippingProvider(): void {
  memo = null;
}
