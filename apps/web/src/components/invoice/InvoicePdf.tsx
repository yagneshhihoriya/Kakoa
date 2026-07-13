/**
 * A4 tax-invoice PDF via @react-pdf/renderer — the "Download PDF" artifact.
 * Text-only (no remote images) so generation is fast + reliable on serverless
 * and identical everywhere. Shares the exact `InvoiceModel` the HTML view uses,
 * so the two never drift. Rendered to a buffer in the PDF route (Node runtime).
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatPaise } from "@kakoa/core";
import type { AddressSnapshot } from "@kakoa/db";
import type { InvoiceModel } from "@/lib/invoice/invoice-data";

const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const LINE = "#e2ddd4";
const HEAD_BG = "#faf7f2";

const money = (paise: number): string => formatPaise(paise);
const fmtDate = (iso: string): string =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));

const s = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 40, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", letterSpacing: 3 },
  sellerName: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 4 },
  muted: { color: MUTED },
  right: { textAlign: "right" },
  invoiceTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "right" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  metaLabel: { color: MUTED, marginRight: 6 },
  partiesRow: { flexDirection: "row", marginTop: 20, gap: 24 },
  party: { flex: 1 },
  blockTitle: { fontSize: 8, color: MUTED, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  bold: { fontFamily: "Helvetica-Bold" },
  payLine: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, gap: 14, color: MUTED, fontSize: 8 },
  table: { marginTop: 16, borderTop: `1px solid ${LINE}` },
  tHead: { flexDirection: "row", backgroundColor: HEAD_BG },
  tRow: { flexDirection: "row", borderBottom: `1px solid ${LINE}` },
  cIdx: { width: "5%", padding: 6 },
  cItem: { width: "40%", padding: 6 },
  cNum: { width: "11%", padding: 6, textAlign: "right" },
  hCell: { fontSize: 7.5, color: MUTED, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  summaryWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  summary: { width: "45%" },
  sRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  sTotal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTop: `1px solid ${LINE}`, fontFamily: "Helvetica-Bold", fontSize: 11 },
  refund: { color: "#3f8a54" },
  footer: { marginTop: 24, paddingTop: 12, borderTop: `1px solid ${LINE}`, fontSize: 8, color: MUTED, lineHeight: 1.5 },
});

function addressLines(a: AddressSnapshot): string[] {
  return [a.fullName, a.line1, a.line2 ?? "", a.landmark ?? "", `${a.city}, ${a.state} ${a.pincode}`].filter((l) => l.trim() !== "");
}

export function InvoicePdf({ model: m }: { model: InvoiceModel }) {
  const showCgstSgst = m.summary.cgstPaise > 0 || m.summary.sgstPaise > 0;
  return (
    <Document title={`Invoice ${m.invoiceNumber}`} author="Kakao">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={{ maxWidth: 300 }}>
            <Text style={s.brand}>Kakao</Text>
            <Text style={s.sellerName}>{m.seller.legalName}</Text>
            <Text style={[s.muted, { lineHeight: 1.4 }]}>{m.seller.address}</Text>
            <Text style={[s.muted, { marginTop: 3 }]}>
              GSTIN: {m.seller.gstin}{m.seller.fssai ? ` · FSSAI: ${m.seller.fssai}` : ""}
            </Text>
            <Text style={s.muted}>{m.seller.supportEmail} · {m.seller.supportPhone}</Text>
          </View>
          <View style={{ maxWidth: 220 }}>
            <Text style={s.invoiceTitle}>TAX INVOICE</Text>
            <View style={{ marginTop: 6 }}>
              {[
                ["Invoice No.", m.invoiceNumber],
                ["Invoice Date", fmtDate(m.invoiceDateIso)],
                ["Order No.", m.orderNumber],
                ["Order Date", fmtDate(m.orderDateIso)],
              ].map(([label, value]) => (
                <View style={s.metaRow} key={label}>
                  <Text style={s.metaLabel}>{label}</Text>
                  <Text style={s.bold}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Parties */}
        <View style={s.partiesRow}>
          <View style={s.party}>
            <Text style={s.blockTitle}>Bill to</Text>
            {addressLines(m.billingAddress).map((l, i) => (
              <Text key={i} style={i === 0 ? s.bold : undefined}>{l}</Text>
            ))}
            <Text style={[s.muted, { marginTop: 3 }]}>{m.customer.phone}</Text>
            {m.customer.email ? <Text style={s.muted}>{m.customer.email}</Text> : null}
          </View>
          <View style={s.party}>
            <Text style={s.blockTitle}>Ship to</Text>
            {addressLines(m.shippingAddress).map((l, i) => (
              <Text key={i} style={i === 0 ? s.bold : undefined}>{l}</Text>
            ))}
          </View>
        </View>

        {/* Payment / status */}
        <View style={s.payLine}>
          <Text>Payment: {m.paymentMethodLabel}</Text>
          <Text>Payment status: {m.paymentStatusLabel}</Text>
          <Text>Order status: {m.orderStatusLabel}</Text>
          {m.shipment ? <Text>AWB: {m.shipment.awb}{m.shipment.courierName ? ` (${m.shipment.courierName})` : ""}</Text> : null}
        </View>

        {/* Items */}
        <View style={s.table}>
          <View style={s.tHead}>
            <Text style={[s.cIdx, s.hCell]}>#</Text>
            <Text style={[s.cItem, s.hCell]}>Item</Text>
            <Text style={[s.cNum, s.hCell]}>Qty</Text>
            <Text style={[s.cNum, s.hCell]}>Unit</Text>
            <Text style={[s.cNum, s.hCell]}>GST</Text>
            <Text style={[s.cNum, s.hCell]}>Amount</Text>
          </View>
          {m.lines.map((l, i) => (
            <View style={s.tRow} key={i} wrap={false}>
              <Text style={[s.cIdx, s.muted]}>{i + 1}</Text>
              <View style={s.cItem}>
                <Text style={s.bold}>{l.productName}</Text>
                <Text style={[s.muted, { fontSize: 7.5 }]}>
                  {l.variantName} · SKU {l.sku}{l.giftWrapFeePaise > 0 ? " · gift wrapped" : ""}
                </Text>
              </View>
              <Text style={s.cNum}>{l.quantity}</Text>
              <Text style={s.cNum}>{money(l.unitPricePaise)}</Text>
              <Text style={s.cNum}>{(l.gstRateBp / 100).toFixed(l.gstRateBp % 100 === 0 ? 0 : 2)}%</Text>
              <Text style={s.cNum}>{money(l.lineTotalPaise)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={s.summaryWrap}>
          <View style={s.summary}>
            <View style={s.sRow}><Text>Subtotal</Text><Text>{money(m.summary.subtotalPaise)}</Text></View>
            {m.summary.discountPaise > 0 ? (
              <View style={s.sRow}><Text style={s.refund}>Discount{m.summary.couponCode ? ` (${m.summary.couponCode})` : ""}</Text><Text style={s.refund}>- {money(m.summary.discountPaise)}</Text></View>
            ) : null}
            {m.summary.giftWrapTotalPaise > 0 ? <View style={s.sRow}><Text>Gift wrap</Text><Text>{money(m.summary.giftWrapTotalPaise)}</Text></View> : null}
            <View style={s.sRow}><Text>Shipping</Text><Text>{money(m.summary.shippingFeePaise)}</Text></View>
            {m.summary.codFeePaise > 0 ? <View style={s.sRow}><Text>COD fee</Text><Text>{money(m.summary.codFeePaise)}</Text></View> : null}
            {showCgstSgst ? (
              <>
                <View style={s.sRow}><Text>CGST (incl.)</Text><Text>{money(m.summary.cgstPaise)}</Text></View>
                <View style={s.sRow}><Text>SGST (incl.)</Text><Text>{money(m.summary.sgstPaise)}</Text></View>
              </>
            ) : m.summary.igstPaise > 0 ? (
              <View style={s.sRow}><Text>IGST (incl.)</Text><Text>{money(m.summary.igstPaise)}</Text></View>
            ) : null}
            <View style={s.sTotal}><Text>Grand total</Text><Text>{money(m.summary.grandTotalPaise)}</Text></View>
            {m.refund ? (
              <View style={s.sRow}><Text style={s.refund}>{m.refund.fullyRefunded ? "Refunded (full)" : "Refunded"}</Text><Text style={s.refund}>- {money(m.refund.totalRefundedPaise)}</Text></View>
            ) : null}
          </View>
        </View>

        <Text style={[s.muted, s.right, { marginTop: 4, fontSize: 7.5 }]}>
          Prices are inclusive of GST. Tax shown is the GST component extracted from the inclusive price.
        </Text>

        {m.customerNote ? (
          <View style={{ marginTop: 14 }}>
            <Text style={s.blockTitle}>Customer note</Text>
            <Text>{m.customerNote}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={{ color: INK, fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 3 }}>Thank you for shopping with Kakao</Text>
          <Text>
            This is a computer-generated tax invoice and does not require a signature. Returns &amp; refunds follow our published
            policy; perishable/temperature-sensitive items may be non-returnable. For help, contact {m.seller.supportEmail}.
          </Text>
          <Text style={{ marginTop: 3 }}>Registered under GSTIN {m.seller.gstin}. Amounts are in Indian Rupees.</Text>
        </View>
      </Page>
    </Document>
  );
}
