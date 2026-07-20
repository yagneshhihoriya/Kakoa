import type { CSSProperties, ReactNode } from "react";
import { formatPaise } from "@kakoa/core";
import type { AddressSnapshot } from "@kakoa/db";
import type { InvoiceModel } from "@/lib/invoice/invoice-data";

/**
 * Presentational A4 tax-invoice document (NO directive — usable from both the
 * server view page and the client print wrapper). Inline styles only, so it
 * renders identically on screen, in print, and across browsers. All money comes
 * pre-computed from `InvoiceModel` (the order snapshots) — nothing is recomputed.
 */

const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const LINE = "#e2ddd4";
const HEAD_BG = "#faf7f2";
const COCOA = "#8a5a34";

const money = (paise: number): string => formatPaise(paise);

/** Chip palette [background, text] per tone — bordered so it still reads in
 * B/W print even if the browser drops background colours. */
const CHIP_TONE: Record<string, [string, string]> = {
  success: ["#e7f4ea", "#1f7a3d"],
  warn: ["#fbf1df", "#98680f"],
  danger: ["#fbeaea", "#b23b3b"],
  refund: ["#eaf0fb", "#2f5fa8"],
  neutral: ["#f1efe9", "#6b6b6b"],
};

/** Infer a chip tone from a human status label (keyword match). */
function toneFor(label: string): keyof typeof CHIP_TONE {
  const l = label.toLowerCase();
  if (/(captured|collected|confirmed|delivered|paid|remitted)/.test(l)) return "success";
  if (/(fail|cancel)/.test(l)) return "danger";
  if (/refund/.test(l)) return "refund";
  if (/(pending|authorized|processing|packed|shipped)/.test(l)) return "warn";
  return "neutral";
}

function StatusChip({ label }: { label: string }): ReactNode {
  const [bg, fg]: [string, string] =
    CHIP_TONE[toneFor(label)] ?? ["#f1efe9", "#6b6b6b"];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        background: bg,
        color: fg,
        border: `1px solid ${fg}33`,
        textTransform: "capitalize",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {label}
    </span>
  );
}

function addressLines(a: AddressSnapshot): string[] {
  return [
    a.fullName,
    a.line1,
    a.line2 ?? "",
    a.landmark ?? "",
    `${a.city}, ${a.state} ${a.pincode}`,
  ].filter((l) => l.trim() !== "");
}

const th: CSSProperties = {
  padding: "8px 10px",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: MUTED,
  textAlign: "left",
  borderBottom: `1px solid ${LINE}`,
  fontWeight: 600,
};
const td: CSSProperties = {
  padding: "10px",
  fontSize: 12,
  color: INK,
  borderBottom: `1px solid ${LINE}`,
  verticalAlign: "top",
};
const tdR: CSSProperties = { ...td, textAlign: "right", whiteSpace: "nowrap" };

function Block({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: MUTED, fontWeight: 700, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: INK }}>{children}</div>
    </div>
  );
}

function SummaryRow({ label, value, strong, negative }: { label: string; value: string; strong?: boolean; negative?: boolean }): ReactNode {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: strong ? "8px 0 0" : "3px 0", fontSize: strong ? 14 : 12, fontWeight: strong ? 700 : 400, color: negative ? "#3f8a54" : INK, borderTop: strong ? `1px solid ${LINE}` : undefined, marginTop: strong ? 6 : 0 }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

export function InvoiceDocument({ model }: { model: InvoiceModel }): ReactNode {
  const m = model;
  const showCgstSgst = m.summary.cgstPaise > 0 || m.summary.sgstPaise > 0;

  return (
    <div
      id="invoice-document"
      style={{
        width: "210mm",
        maxWidth: "100%",
        margin: "0 auto",
        background: "#ffffff",
        color: INK,
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "16mm 14mm",
        boxSizing: "border-box",
      }}
    >
      {/* Slim brand accent bar, pulled to the physical page edges */}
      <div
        style={{
          height: 8,
          margin: "-16mm -14mm 22px",
          background: `linear-gradient(90deg, #d9ac5e 0%, ${COCOA} 100%)`,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 5, color: COCOA }}>KAKOA</div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginTop: 1 }}>
            Fine chocolate
          </div>
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600 }}>{m.seller.legalName}</div>
          <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, maxWidth: 280 }}>{m.seller.address}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>
            GSTIN: {m.seller.gstin}
            {m.seller.fssai ? <> · FSSAI: {m.seller.fssai}</> : null}
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>
            {m.seller.supportEmail} · {m.seller.supportPhone}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>TAX INVOICE</div>
          <table style={{ marginTop: 8, fontSize: 11, borderCollapse: "collapse" }}>
            <tbody>
              <tr><td style={{ color: MUTED, padding: "2px 8px 2px 0", textAlign: "right" }}>Invoice No.</td><td style={{ fontWeight: 700, textAlign: "right" }}>{m.invoiceNumber}</td></tr>
              <tr><td style={{ color: MUTED, padding: "2px 8px 2px 0", textAlign: "right" }}>Invoice Date</td><td style={{ textAlign: "right" }}>{formatDate(m.invoiceDateIso)}</td></tr>
              <tr><td style={{ color: MUTED, padding: "2px 8px 2px 0", textAlign: "right" }}>Order No.</td><td style={{ fontWeight: 700, textAlign: "right" }}>{m.orderNumber}</td></tr>
              <tr><td style={{ color: MUTED, padding: "2px 8px 2px 0", textAlign: "right" }}>Order Date</td><td style={{ textAlign: "right" }}>{formatDate(m.orderDateIso)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Parties */}
      <div style={{ display: "flex", gap: 24, marginTop: 22, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 45%", minWidth: 220 }}>
          <Block title="Bill to">
            {addressLines(m.billingAddress).map((l, i) => (
              <div key={i} style={i === 0 ? { fontWeight: 600 } : undefined}>{l}</div>
            ))}
            <div style={{ color: MUTED, marginTop: 4 }}>{m.customer.phone}</div>
            {m.customer.email ? <div style={{ color: MUTED }}>{m.customer.email}</div> : null}
          </Block>
        </div>
        <div style={{ flex: "1 1 45%", minWidth: 220 }}>
          <Block title="Ship to">
            {addressLines(m.shippingAddress).map((l, i) => (
              <div key={i} style={i === 0 ? { fontWeight: 600 } : undefined}>{l}</div>
            ))}
          </Block>
        </div>
      </div>

      {/* Payment / status */}
      <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: MUTED }}>
        <span>Payment: <strong style={{ color: INK }}>{m.paymentMethodLabel}</strong></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          Payment status: <StatusChip label={m.paymentStatusLabel} />
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          Order status: <StatusChip label={m.orderStatusLabel} />
        </span>
        {m.shipment ? <span>AWB: <strong style={{ color: INK }}>{m.shipment.awb}</strong>{m.shipment.courierName ? ` (${m.shipment.courierName})` : ""}</span> : null}
      </div>

      {/* Line items */}
      <table style={{ width: "100%", marginTop: 18, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: HEAD_BG }}>
            <th style={{ ...th, width: 24 }}>#</th>
            <th style={th}>Item</th>
            <th style={{ ...th, textAlign: "right" }}>Qty</th>
            <th style={{ ...th, textAlign: "right" }}>Unit price</th>
            <th style={{ ...th, textAlign: "right" }}>Taxable</th>
            <th style={{ ...th, textAlign: "right" }}>GST</th>
            <th style={{ ...th, textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {m.lines.map((l, i) => (
            <tr key={i}>
              <td style={{ ...td, color: MUTED }}>{i + 1}</td>
              <td style={td}>
                <div style={{ fontWeight: 600 }}>{l.productName}</div>
                <div style={{ fontSize: 11, color: MUTED }}>
                  {l.variantName} · SKU {l.sku}
                  {l.giftWrapFeePaise > 0 ? " · gift wrapped" : ""}
                </div>
              </td>
              <td style={tdR}>{l.quantity}</td>
              <td style={tdR}>{money(l.unitPricePaise)}</td>
              <td style={tdR}>{money(l.taxableValuePaise)}</td>
              <td style={tdR}>{(l.gstRateBp / 100).toFixed(l.gstRateBp % 100 === 0 ? 0 : 2)}%</td>
              <td style={tdR}>{money(l.lineTotalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <div style={{ width: 300, maxWidth: "100%" }}>
          <SummaryRow label="Subtotal" value={money(m.summary.subtotalPaise)} />
          {m.summary.discountPaise > 0 ? (
            <SummaryRow label={`Discount${m.summary.couponCode ? ` (${m.summary.couponCode})` : ""}`} value={`- ${money(m.summary.discountPaise)}`} negative />
          ) : null}
          {m.summary.giftWrapTotalPaise > 0 ? <SummaryRow label="Gift wrap" value={money(m.summary.giftWrapTotalPaise)} /> : null}
          <SummaryRow label="Shipping" value={money(m.summary.shippingFeePaise)} />
          {m.summary.codFeePaise > 0 ? <SummaryRow label="COD fee" value={money(m.summary.codFeePaise)} /> : null}
          {showCgstSgst ? (
            <>
              <SummaryRow label="CGST (incl.)" value={money(m.summary.cgstPaise)} />
              <SummaryRow label="SGST (incl.)" value={money(m.summary.sgstPaise)} />
            </>
          ) : m.summary.igstPaise > 0 ? (
            <SummaryRow label="IGST (incl.)" value={money(m.summary.igstPaise)} />
          ) : null}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 10,
              padding: "11px 13px",
              background: HEAD_BG,
              border: `1px solid ${LINE}`,
              borderRadius: 8,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.3 }}>Grand total</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: COCOA, fontVariantNumeric: "tabular-nums" }}>
              {money(m.summary.grandTotalPaise)}
            </span>
          </div>
          {m.refund ? (
            <SummaryRow label={m.refund.fullyRefunded ? "Refunded (full)" : "Refunded"} value={`- ${money(m.refund.totalRefundedPaise)}`} negative />
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 6, fontSize: 10, color: MUTED, textAlign: "right" }}>
        Prices are inclusive of GST. Tax amounts shown are the GST component extracted from the inclusive price.
      </div>

      {/* Refund / credit note */}
      {m.refund && m.refund.rows.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <Block title="Refunds / credit note">
            {m.refund.rows.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", maxWidth: 320 }}>
                <span style={{ color: MUTED }}>{formatDate(r.createdAtIso)} · {r.status}</span>
                <span>{money(r.amountPaise)}</span>
              </div>
            ))}
          </Block>
        </div>
      ) : null}

      {/* Customer note */}
      {m.customerNote ? (
        <div style={{ marginTop: 16 }}>
          <Block title="Customer note">{m.customerNote}</Block>
        </div>
      ) : null}

      {/* Footer */}
      <div style={{ marginTop: 26, paddingTop: 14, borderTop: `1px solid ${LINE}`, fontSize: 10, color: MUTED, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 700, color: INK, fontSize: 12, marginBottom: 4 }}>Thank you for shopping with KAKOA 🍫</div>
        <div>
          This is a computer-generated tax invoice and does not require a signature. Returns &amp; refunds are governed by our
          published policy; perishable/temperature-sensitive items may be non-returnable. For help, contact {m.seller.supportEmail}.
        </div>
        <div style={{ marginTop: 4 }}>Registered under GSTIN {m.seller.gstin}. Whole amounts are in Indian Rupees (₹).</div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}
