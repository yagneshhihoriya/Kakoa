/**
 * POST /api/admin/reviews/[id]/moderate — approve or reject a review.
 * Body: { decision: 'approved' | 'rejected', note?: string }. Guarded by
 * `reviews:moderate`. Recomputes the product rating + purges the PDP cache in-tx.
 * A malformed / unknown id resolves to NOT_FOUND (never a 500).
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { moderateReview } from '@/lib/admin/reviews';
import { validateModerationInput } from '@/lib/admin/review-format';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('reviews:moderate');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const parsed = validateModerationInput(body);
  if (!parsed.ok) return jsonErr('VALIDATION_ERROR', parsed.message);

  const result = await moderateReview(id, parsed.value, auth.value.admin.id);
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ ok: true, status: result.status }, { cacheControl: NO_STORE });
}
