/**
 * Newsletter subscription (storefront). Idempotent insert — re-subscribing the
 * same email is a silent no-op. SERVER-ONLY: uses @kakoa/db.
 */
import { db, newsletterSubscribers } from "@kakoa/db";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SubscribeResult =
  | { ok: true }
  | { ok: false; message: string };

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

export async function subscribeEmail(
  email: string,
  source = "storefront",
): Promise<SubscribeResult> {
  await db
    .insert(newsletterSubscribers)
    .values({ email, source: source.slice(0, 40) })
    .onConflictDoNothing({ target: newsletterSubscribers.email });
  return { ok: true };
}
