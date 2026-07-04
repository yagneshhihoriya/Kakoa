/**
 * POST /api/admin/payments/[id]/remit — mark a collected-COD payment remitted.
 * Body: { reference }. No `payments:remit` permission exists in the manifest, so
 * this money action gates on `payments:refund` (per HANDOFF §3.2). Idempotent.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { markCodRemitted } from '@/lib/admin/payments';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAdmin('payments:refund');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', 'Invalid request body.');
  }
  const b = body as { reference?: unknown };
  if (typeof b.reference !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'A remittance reference is required.');
  }

  const result = await markCodRemitted(
    { paymentId: id, reference: b.reference },
    auth.value.admin.id,
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk({ alreadyRemitted: result.alreadyRemitted }, { cacheControl: NO_STORE });
}
