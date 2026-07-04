import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { resolveAdminContext } from "@/lib/admin/context";
import { getSellerTaxIdentity, listTaxGroups } from "@/lib/admin/taxes";
import { NoAccess } from "@/components/admin/NoAccess";
import { TaxGroupsTable } from "@/components/admin/TaxGroupsTable";

export const dynamic = "force-dynamic";

export default async function AdminTaxesPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("taxes:manage")) return <NoAccess module="Taxes" />;

  const [groups, seller] = await Promise.all([listTaxGroups(), getSellerTaxIdentity()]);
  const inconsistentCount = new Set(groups.filter((g) => g.inconsistent).map((g) => g.hsnCode)).size;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
          Taxes
        </h1>
        <p className="text-[13px] text-[#8a7a68]">
          GST rates per HSN / variant · stored as rate-on-variant, applied at checkout
        </p>
      </div>

      {/* Seller GST identity (read-only; edited in Settings) */}
      <div className="mb-4 rounded-2xl border border-[#eadbc6] bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[#8a7a68]">Seller GST identity</div>
          <Link href={"/admin/settings" as Route} className="text-[12px] font-medium text-[#8a5a34] hover:underline">
            Edit in Settings →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="GSTIN" value={seller.gstin} mono />
          <Field label="Legal name" value={seller.legalName} />
          <Field label="State" value={seller.stateName ? `${seller.stateName} (${seller.stateCode})` : seller.stateCode} />
        </div>
      </div>

      {inconsistentCount > 0 ? (
        <div className="mb-4 rounded-xl border border-[#f0d3bd] bg-[#fbf1e8] px-4 py-2.5 text-[12.5px] text-[#a5623a]">
          ⚠ {inconsistentCount} HSN code{inconsistentCount === 1 ? "" : "s"} map to more than one GST rate. A single HSN should
          carry one rate — use “Set all in HSN” to normalise it.
        </div>
      ) : null}

      <TaxGroupsTable groups={groups} />

      <div className="mt-4 rounded-2xl border border-[#eadbc6] bg-white p-5 text-[12.5px] leading-relaxed text-[#6b5844]">
        <div className="mb-1 font-semibold text-[#2a1d12]">How GST is applied</div>
        <p>
          Prices are GST-inclusive. At checkout the tax is extracted from the price using the variant’s rate, then split{" "}
          <span className="font-medium">CGST + SGST</span> when the buyer’s state matches the seller’s state ({seller.stateName ?? seller.stateCode}),
          or charged as <span className="font-medium">IGST</span> for other states.
        </p>
        <p className="mt-1.5">
          Rate changes here are <span className="font-medium">not retroactive</span> — each order snapshots its tax at
          placement, so past orders keep the rate they were charged.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }): ReactNode {
  return (
    <div>
      <div className="text-[11.5px] uppercase tracking-wide text-[#b8a88f]">{label}</div>
      <div className={"mt-0.5 text-[13.5px] text-[#2a1d12] " + (mono ? "font-mono" : "")}>{value || "—"}</div>
    </div>
  );
}
