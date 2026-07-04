import { parseServerEnv } from "@kakoa/config";
import type { SmsProvider } from "./provider";
import { FakeSmsProvider } from "./fake";
import { Msg91SmsProvider } from "../msg91/client";

/**
 * Resolve the active SMS provider (auth-otp.md §3).
 *
 * Msg91SmsProvider is used only when a real authkey is configured AND test mode
 * is off; otherwise the FakeSmsProvider handles local dev and Playwright. The
 * FakeSmsProvider is never selected-away in production only by omission — in
 * production without an authkey there is simply no working SMS path, which is a
 * deploy-config error, not a fallback to the fake.
 */

let memo: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (memo !== null) return memo;

  const env = parseServerEnv();
  const useMsg91 =
    env.MSG91_AUTH_KEY !== undefined && env.OTP_TEST_MODE !== "1";

  memo = useMsg91 ? new Msg91SmsProvider() : new FakeSmsProvider();
  return memo;
}

/** Test-only: reset the memoized provider so env changes take effect. */
export function resetSmsProvider(): void {
  memo = null;
}
