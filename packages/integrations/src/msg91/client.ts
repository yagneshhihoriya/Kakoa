import { parseServerEnv } from "@kakoa/config";
import type { SmsProvider } from "../sms/provider";

/**
 * MSG91 Flow API SMS provider (auth-otp.md §3).
 *
 * MSG91 is the delivery pipe ONLY — KAKOA never uses MSG91's hosted verify.
 * No file outside this directory may import MSG91 specifics.
 *
 * Failure behavior (§3):
 *   - timeout (5s budget) or 5xx → one immediate retry, then throw → 502 upstream.
 *   - 4xx (bad authkey / template mismatch) → no retry, throw immediately (config bug).
 *
 * NEVER logs the authkey, the raw code, or the raw phone number.
 */

const FLOW_ENDPOINT = "https://control.msg91.com/api/v5/flow";
const TIMEOUT_MS = 5_000;

class TransientMsg91Error extends Error {}
class PermanentMsg91Error extends Error {}

export class Msg91SmsProvider implements SmsProvider {
  async sendOtp(a: {
    phoneE164: string;
    code: string;
    purpose: string;
  }): Promise<{ providerMessageId: string | null }> {
    const env = parseServerEnv();
    const authKey = env.MSG91_AUTH_KEY;
    const templateId = env.MSG91_OTP_TEMPLATE_ID;

    if (authKey === undefined || templateId === undefined) {
      // Should never happen: getSmsProvider only selects this provider when the
      // authkey is present. Treated as a config bug (no retry).
      throw new PermanentMsg91Error("MSG91 provider selected without config");
    }

    // MSG91 wants the country code WITHOUT the leading '+'.
    const mobiles = a.phoneE164.replace("+", "");
    const body = JSON.stringify({
      template_id: templateId,
      recipients: [
        {
          mobiles,
          // NOTE: the exact variable key ('otp') must match the ##otp##
          // variable name in the created MSG91/DLT template.
          // verify at integration against the live template.
          otp: a.code,
        },
      ],
    });

    try {
      return await this.postOnce(authKey, body);
    } catch (err) {
      if (err instanceof PermanentMsg91Error) throw err;
      // Transient (timeout / 5xx): one immediate retry, then propagate.
      return await this.postOnce(authKey, body);
    }
  }

  /**
   * Transactional (non-OTP) SMS. India DLT requires a pre-approved template per
   * message type; until those template ids are registered + configured this
   * throws (a config gap), and callers send it best-effort so it degrades to
   * "SMS not sent" with email as the guaranteed channel.
   *
   * TODO(notifications DLT): map `template` → a registered MSG91/DLT template id
   * (e.g. MSG91_TXN_TEMPLATE_IDS) and POST the flow with the rendered variables.
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- async to satisfy the interface
  async sendText(_a: {
    phoneE164: string;
    message: string;
    template: string;
  }): Promise<{ providerMessageId: string | null }> {
    throw new PermanentMsg91Error(
      "MSG91 transactional SMS not configured — register a DLT template id first",
    );
  }

  private async postOnce(
    authKey: string,
    body: string,
  ): Promise<{ providerMessageId: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(FLOW_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body,
        signal: controller.signal,
      });
    } catch {
      // Network error or abort (timeout) → transient, eligible for one retry.
      throw new TransientMsg91Error("MSG91 request failed or timed out");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 500) {
      throw new TransientMsg91Error(`MSG91 5xx: ${res.status}`);
    }
    if (res.status >= 400) {
      // 4xx = config bug (bad authkey / template mismatch): do not retry.
      throw new PermanentMsg91Error(`MSG91 4xx: ${res.status}`);
    }

    const providerMessageId = await this.extractMessageId(res);
    return { providerMessageId };
  }

  private async extractMessageId(res: Response): Promise<string | null> {
    try {
      const json: unknown = await res.json();
      if (
        typeof json === "object" &&
        json !== null &&
        "request_id" in json &&
        typeof (json as { request_id: unknown }).request_id === "string"
      ) {
        return (json as { request_id: string }).request_id;
      }
    } catch {
      // Non-JSON 2xx body — accept delivery, no id available.
    }
    return null;
  }
}
