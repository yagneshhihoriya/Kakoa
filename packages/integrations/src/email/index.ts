import { parseServerEnv } from "@kakoa/config";
import type { EmailProvider } from "./provider";
import { FakeEmailProvider } from "./fake";
import { ResendEmailProvider } from "./resend";

/**
 * Resolve the active email provider (storefront launch-gate).
 *
 * ResendEmailProvider is used only when a real RESEND_API_KEY is configured;
 * otherwise the FakeEmailProvider handles local dev and Playwright. In
 * production without a key there is simply no working email path — a
 * deploy-config error, not a fallback to the fake.
 */

let memo: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (memo !== null) return memo;

  const env = parseServerEnv();
  memo =
    env.RESEND_API_KEY !== undefined
      ? new ResendEmailProvider()
      : new FakeEmailProvider();
  return memo;
}

/** Test-only: reset the memoized provider so env changes take effect. */
export function resetEmailProvider(): void {
  memo = null;
}
