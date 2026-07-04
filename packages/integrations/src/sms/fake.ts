import { parseServerEnv } from "@kakoa/config";
import type { SmsProvider } from "./provider";

/**
 * In-memory SMS provider for local dev and tests (auth-otp.md §1.3, §3).
 *
 * Delivers nothing over the wire. It records every call so tests can assert on
 * what would have been sent, and — in non-production only — logs a structured
 * `otp.debug` line so a developer can read the code from the server console and
 * complete a local login. NEVER active in production (see getSmsProvider).
 */

export interface SentOtp {
  phoneE164: string;
  code: string;
  purpose: string;
  providerMessageId: string;
  at: string;
}

const sent: SentOtp[] = [];

/** All OTPs "sent" via the fake provider this process, oldest first (tests). */
export function getSentOtps(): readonly SentOtp[] {
  return sent;
}

/** Clear the recorded-call buffer (test isolation between cases). */
export function clearSentOtps(): void {
  sent.length = 0;
}

/**
 * Mask an E.164 Indian number for logs, e.g. `+919876543210` → `+91 98•••••210`.
 * Kept local so this package need not depend on @kakoa/core; never logs the
 * full number. Non-E.164 input degrades to a fully-masked placeholder.
 */
function maskForLog(phoneE164: string): string {
  const m = /^\+91([6-9][0-9])[0-9]{5}([0-9]{3})$/.exec(phoneE164);
  if (m === null) return "+91 ••••••••••";
  return `+91 ${m[1]}•••••${m[2]}`;
}

/**
 * Derive a deterministic-ish fake message id from the code so tests can key on
 * it without exposing the raw code in any transported/persisted field. The code
 * itself is never returned or logged outside the non-prod debug line.
 */
function fakeMessageId(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i += 1) {
    h = (h * 31 + code.charCodeAt(i)) >>> 0;
  }
  return `fake-${h.toString(36)}`;
}

export class FakeSmsProvider implements SmsProvider {
  async sendOtp(a: {
    phoneE164: string;
    code: string;
    purpose: string;
  }): Promise<{ providerMessageId: string | null }> {
    const providerMessageId = fakeMessageId(a.code);

    sent.push({
      phoneE164: a.phoneE164,
      code: a.code,
      purpose: a.purpose,
      providerMessageId,
      at: new Date().toISOString(),
    });

    // Non-production only: emit the code so local dev / Playwright can log in.
    // This is the single sanctioned place a raw code is written to console.
    if (parseServerEnv().APP_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          event: "otp.debug",
          phoneE164Masked: maskForLog(a.phoneE164),
          code: a.code,
          purpose: a.purpose,
        }),
      );
    }

    return { providerMessageId };
  }
}
