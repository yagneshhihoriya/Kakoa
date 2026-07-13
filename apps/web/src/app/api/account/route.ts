/**
 * DELETE /api/account — permanently delete the signed-in customer's account
 * (DPDP right to erasure). Removes the identity + sessions/addresses/wishlist/
 * reviews/carts; orders are retained but de-linked for tax/invoice compliance.
 * The session cookie is cleared so the caller is logged out immediately.
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { clearSessionCookie, getCurrentCustomer, readSessionToken, revokeSession } from "@/lib/auth/session";
import { deleteCustomerAccount } from "@/lib/account/profile";

export const dynamic = "force-dynamic";

export async function DELETE(): Promise<Response> {
  const customer = await getCurrentCustomer();
  if (customer === null) return jsonErr("UNAUTHORIZED", "Please sign in.");

  const token = await readSessionToken();
  try {
    await deleteCustomerAccount(customer.id);
  } catch {
    return jsonErr("INTERNAL", "Couldn't delete your account — please try again.");
  }
  // Best-effort: sessions cascade with the customer, but revoke + clear anyway.
  await revokeSession(token).catch(() => {});
  await clearSessionCookie();
  return jsonOk({ deleted: true }, { cacheControl: NO_STORE });
}
