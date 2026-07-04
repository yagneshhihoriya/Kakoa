/**
 * POST /api/admin/payments/[id]/refund — refund a payment. Guard
 * `payments:refund` (a `payments:read`-only admin is refused here, server-side).
 * Body: { amountPaise, destination, reason, reference? }. The money-safety rules
 * (over-refund guard, idempotency, gateway reuse) live in `refundPayment`.
 */
import { jsonErr, jsonOk, NO_STORE } from '@/lib/api/http';
import { requireAdmin } from '@/lib/admin/guard';
import { refundPayment } from '@/lib/admin/payments';

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
  const b = body as {
    amountPaise?: unknown;
    destination?: unknown;
    reason?: unknown;
    reference?: unknown;
  };
  if (typeof b.amountPaise !== 'number' || typeof b.destination !== 'string') {
    return jsonErr('VALIDATION_ERROR', 'A refund amount and destination are required.');
  }

  const result = await refundPayment(
    {
      paymentId: id,
      amountPaise: b.amountPaise,
      destination: b.destination,
      reason: typeof b.reason === 'string' ? b.reason : '',
      reference: typeof b.reference === 'string' ? b.reference : undefined,
    },
    auth.value.admin.id,
  );
  if (!result.ok) return jsonErr(result.code, result.message);
  return jsonOk(
    {
      refundId: result.refundId,
      paymentStatus: result.paymentStatus,
      amountRefundedPaise: result.amountRefundedPaise,
      remainingPaise: result.remainingPaise,
      gatewayStatus: result.gatewayStatus,
    },
    { cacheControl: NO_STORE },
  );
}
