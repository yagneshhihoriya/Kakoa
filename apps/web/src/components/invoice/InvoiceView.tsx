"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { InvoiceDocument } from "./InvoiceDocument";
import type { InvoiceModel } from "@/lib/invoice/invoice-data";

function DownloadIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function BackIcon(): ReactNode {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

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
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [autoPrint]);

  const pdfHref = `/api/orders/${model.orderNumber}/invoice.pdf` as Route;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f2ede3] to-[#e7ddcd] pb-14">
      {/* Print isolation + A4 page — only the invoice prints. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-root, #invoice-print-root * { visibility: visible !important; }
          #invoice-print-root { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border-radius: 0 !important; }
          .invoice-no-print { display: none !important; }
        }
        @page { size: A4; margin: 0; }
      `}</style>

      {/* Sticky action bar (screen only) */}
      <div className="invoice-no-print sticky top-0 z-20 border-b border-[#e2d8c6] bg-[#faf7f2]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/account/orders/${model.orderNumber}` as Route}
              className="group inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 font-body text-[13px] font-semibold text-[#6b5844] transition-colors hover:bg-[#efe4d2] hover:text-[#2a1d12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <span className="transition-transform group-hover:-translate-x-0.5 motion-reduce:transform-none">
                <BackIcon />
              </span>
              Back to order
            </Link>
            <span className="hidden items-center gap-2 sm:inline-flex">
              <span className="font-display text-[16px] tracking-[0.16em] text-[#8a5a34]">
                KAKOA
              </span>
              <span className="rounded-pill border border-[#e2d8c6] bg-white px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.06em] text-[#6b5844]">
                {model.orderNumber}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={pdfHref}
              onClick={() => {
                setDownloading(true);
                window.setTimeout(() => setDownloading(false), 2500);
              }}
              className="inline-flex items-center gap-2 rounded-pill bg-[#2a1d12] px-5 py-2 font-body text-[13px] font-bold text-[#f3e7d5] no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#3f2c1b] hover:shadow-md active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf7f2] motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span className={downloading ? "animate-bounce motion-reduce:animate-none" : ""}>
                <DownloadIcon />
              </span>
              {downloading ? "Preparing…" : "Download PDF"}
            </a>
          </div>
        </div>
      </div>

      {/* Paper — fades + rises in on load (screen only; print resets shadow). */}
      <div className="px-3 pt-6">
        <div
          id="invoice-print-root"
          className="mx-auto max-w-[210mm] overflow-hidden rounded-[10px] bg-white shadow-[0_18px_50px_-12px_rgba(42,29,18,0.28)] animate-[kk-rise_0.5s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
        >
          <InvoiceDocument model={model} />
        </div>
      </div>
    </div>
  );
}
