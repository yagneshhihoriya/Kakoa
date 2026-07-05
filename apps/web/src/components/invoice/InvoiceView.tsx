"use client";

import { useEffect } from "react";
import type { Route } from "next";
import Link from "next/link";
import { InvoiceDocument } from "./InvoiceDocument";
import type { InvoiceModel } from "@/lib/invoice/invoice-data";

/**
 * On-screen invoice with a (screen-only) action bar: Back · Print · Download PDF.
 * Print uses CSS isolation so ONLY the invoice prints (no site chrome), on A4.
 * `autoPrint` (from `?print=1`) opens the print dialog on load so "Print
 * Invoice" from another page lands here and prints in one step.
 */
export function InvoiceView({
  model,
  autoPrint = false,
}: {
  model: InvoiceModel;
  autoPrint?: boolean;
}): React.ReactNode {
  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [autoPrint]);

  const pdfHref = `/api/orders/${model.orderNumber}/invoice.pdf` as Route;

  return (
    <div style={{ background: "#f4f1ea", minHeight: "100vh", padding: "16px 0 48px" }}>
      {/* Print isolation + A4 page — only the invoice prints. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-root, #invoice-print-root * { visibility: visible !important; }
          #invoice-print-root { position: absolute; left: 0; top: 0; width: 100%; }
          .invoice-no-print { display: none !important; }
        }
        @page { size: A4; margin: 0; }
      `}</style>

      <div className="invoice-no-print" style={{ maxWidth: "210mm", margin: "0 auto 12px", padding: "0 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href={`/account/orders/${model.orderNumber}` as Route} style={{ fontSize: 13, color: "#6b5844", textDecoration: "none" }}>
          ← Back to order
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={pdfHref}
            style={{ borderRadius: 8, border: "1px solid #e2ddd4", background: "#fff", padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#2a1d12", textDecoration: "none" }}
          >
            Download PDF
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ borderRadius: 8, background: "#2a1d12", padding: "8px 16px", fontSize: 13, fontWeight: 700, color: "#f3e7d5", border: "none", cursor: "pointer" }}
          >
            Print
          </button>
        </div>
      </div>

      <div id="invoice-print-root" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.08)", maxWidth: "210mm", margin: "0 auto" }}>
        <InvoiceDocument model={model} />
      </div>
    </div>
  );
}
