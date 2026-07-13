/**
 * GET /api/orders/[orderNumber]/invoice.pdf — download the A4 tax-invoice PDF.
 *
 * Auth reuses the tracking resolver (session owner | tracking-JWT | ≤24h
 * `?accessToken`) so both logged-in customers and guests (from the order email /
 * success page) can fetch their own invoice — never a bare order-number lookup.
 * A tax invoice is issued only once the order is confirmed (see getInvoiceData).
 *
 * Node runtime (react-pdf renders to a Buffer server-side).
 */
import { renderToBuffer } from '@react-pdf/renderer';
import { resolveTrackingAuth } from '@/lib/orders/tracking';
import { getInvoiceData } from '@/lib/invoice/invoice-data';
import { InvoicePdf } from '@/components/invoice/InvoicePdf';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
): Promise<Response> {
  const { orderNumber: raw } = await params;
  const orderNumber = decodeURIComponent(raw).toUpperCase();

  const auth = await resolveTrackingAuth(req, orderNumber, { allowAccessToken: true });
  if (auth.kind === 'unauthorized') return json401();
  if (auth.kind === 'expired') return new Response('Link expired', { status: 410 });
  if (auth.kind === 'notfound') return new Response('Not found', { status: 404 });

  const result = await getInvoiceData(auth.orderId);
  if (result === null) return new Response('Not found', { status: 404 });
  if (!result.eligible) {
    // Not yet a tax invoice (order not confirmed) — 409 with a clear reason.
    return Response.json({ ok: false, error: { code: 'CONFLICT', message: result.reason } }, { status: 409 });
  }

  // InvoicePdf is hook-free and returns the <Document> element renderToBuffer wants.
  const buffer = await renderToBuffer(InvoicePdf({ model: result.invoice }));
  const fileName = `Kakao-Invoice-${result.invoice.invoiceNumber.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'private, no-store',
    },
  });
}

function json401(): Response {
  return Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in to download this invoice.' } }, { status: 401 });
}
