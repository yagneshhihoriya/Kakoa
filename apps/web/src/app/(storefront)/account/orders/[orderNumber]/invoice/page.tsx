/**
 * `/account/orders/[orderNumber]/invoice` — the on-screen tax invoice for the
 * logged-in owner (View + Print; Download PDF links to the pdf route). Same
 * ownership gate as the order-detail page (session is the credential; a
 * non-owner / missing order 404s indistinguishably). `?print=1` auto-opens the
 * print dialog so "Print Invoice" from another page lands + prints in one step.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth/session";
import { loadOwnedOrderDetail } from "@/lib/orders/order-detail-data";
import { getInvoiceData } from "@/lib/invoice/invoice-data";
import { InvoiceView } from "@/components/invoice/InvoiceView";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ORDER_NUMBER_RE = /^KK-\d{5}$/;

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderNumber: raw } = await params;
  const orderNumber = decodeURIComponent(raw).toUpperCase();

  const customer = await getCurrentCustomer();
  if (customer === null) redirect("/?login=1");
  if (!ORDER_NUMBER_RE.test(orderNumber)) notFound();

  const owned = await loadOwnedOrderDetail(orderNumber, customer.id);
  if (owned === null) notFound();

  const result = await getInvoiceData(owned.id);
  if (result === null) notFound();

  if (!result.eligible) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-[20px] font-semibold text-[#2a1d12]">Invoice not available yet</h1>
        <p className="mt-2 text-[14px] text-[#6b5844]">{result.reason}</p>
        <a href={`/account/orders/${orderNumber}`} className="mt-4 inline-block text-[13px] font-medium text-[#8a5a34] hover:underline">
          ← Back to order
        </a>
      </div>
    );
  }

  const sp = await searchParams;
  const autoPrint = (Array.isArray(sp.print) ? sp.print[0] : sp.print) === "1";

  return <InvoiceView model={result.invoice} autoPrint={autoPrint} />;
}
