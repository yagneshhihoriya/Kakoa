/**
 * POST /api/reviews — submit a product review (verified buyers only). Session is
 * the credential. Reviews publish immediately (no admin moderation) and the
 * product's rating is recomputed on submit.
 */
import { jsonErr, jsonOk, NO_STORE } from "@/lib/api/http";
import { getCurrentCustomer } from "@/lib/auth/session";
import { submitReview, validateReviewInput } from "@/lib/reviews/storefront-reviews";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const customer = await getCurrentCustomer();
  if (customer === null) return jsonErr("UNAUTHORIZED", "Please sign in to write a review.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr("VALIDATION_ERROR", "Invalid review payload.");
  }
  const productId = (body as { productId?: unknown }).productId;
  if (typeof productId !== "string") return jsonErr("VALIDATION_ERROR", "A product is required.");

  const parsed = validateReviewInput(body);
  if (!parsed.ok) return jsonErr("VALIDATION_ERROR", parsed.message);

  const result = await submitReview(customer.id, productId, parsed.value);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ submitted: true }, { cacheControl: NO_STORE });
}
