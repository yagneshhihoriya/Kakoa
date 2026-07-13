/**
 * GET /api/reviews/eligibility?productId= — can the signed-in customer write a
 * review for this product? Drives the "Write a review" affordance on the PDP
 * (which is a shared/cached page, so eligibility is resolved client-side).
 */
import { jsonOk, NO_STORE } from "@/lib/api/http";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getReviewEligibility } from "@/lib/reviews/storefront-reviews";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const customer = await getCurrentCustomer();
  if (customer === null) {
    return jsonOk({ signedIn: false, canReview: false, alreadyReviewed: false }, { cacheControl: NO_STORE });
  }
  const productId = new URL(req.url).searchParams.get("productId") ?? "";
  const elig = await getReviewEligibility(customer.id, productId);
  return jsonOk(
    { signedIn: true, canReview: elig.canReview, alreadyReviewed: elig.alreadyReviewed },
    { cacheControl: NO_STORE },
  );
}
