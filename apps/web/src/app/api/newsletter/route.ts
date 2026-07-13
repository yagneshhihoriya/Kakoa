/**
 * POST /api/newsletter — subscribe an email to the mailing list. Public,
 * idempotent, non-enumerating (always the same success envelope for a valid
 * email so the response never reveals whether an address is already subscribed).
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { normalizeEmail, subscribeEmail } from "@/lib/newsletter/newsletter";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("VALIDATION_ERROR", "Enter a valid email address.");
  }
  const email = normalizeEmail((body as { email?: unknown }).email);
  if (email === null) {
    return jsonErr("VALIDATION_ERROR", "Enter a valid email address.");
  }
  const source = typeof (body as { source?: unknown }).source === "string"
    ? (body as { source: string }).source
    : "storefront";
  try {
    await subscribeEmail(email, source);
    return jsonOk({ subscribed: true }, { cacheControl: NO_STORE });
  } catch {
    return jsonErr("INTERNAL", "Couldn't sign you up right now — try again.");
  }
}
