/**
 * PATCH /api/account/profile — update the signed-in customer's name/email.
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { getCurrentCustomer } from "@/lib/auth/session";
import { updateCustomerProfile } from "@/lib/account/profile";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request): Promise<Response> {
  const customer = await getCurrentCustomer();
  if (customer === null) return jsonErr("UNAUTHORIZED", "Please sign in.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("VALIDATION_ERROR", "Invalid request body.");
  }
  const b = body as { name?: unknown; email?: unknown };
  const result = await updateCustomerProfile(customer.id, {
    ...("name" in b ? { name: b.name } : {}),
    ...("email" in b ? { email: b.email } : {}),
  });
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ updated: true }, { cacheControl: NO_STORE });
}
