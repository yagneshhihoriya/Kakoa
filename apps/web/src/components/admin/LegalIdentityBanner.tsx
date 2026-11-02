import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { LEGAL_IDENTITY_LABELS, type LegalIdentityKey } from "@/lib/admin/legal-identity";

/**
 * Admin-facing "Legal identity not configured" notice. Shown wherever the
 * seller identity is read (Settings, Taxes) while any legal-identity setting
 * has no row: there is no code default for these, so until they are entered
 * invoices are withheld and the storefront omits the GSTIN / legal name.
 * Renders nothing when `missing` is empty.
 */
export function LegalIdentityBanner({
  missing,
  linkToSettings = false,
}: {
  missing: readonly string[];
  /** Offer an "Edit in Settings" link (when not already on the Settings page). */
  linkToSettings?: boolean;
}): ReactNode {
  if (missing.length === 0) return null;
  const labels = missing.map((key) => LEGAL_IDENTITY_LABELS[key as LegalIdentityKey] ?? key);
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-[#e9b9b9] bg-[#fbeaea] px-4 py-3 text-[12.5px] leading-relaxed text-[#8f2f2f]"
    >
      <div className="font-semibold">Legal identity not configured</div>
      <p className="mt-0.5">
        Missing: {labels.join(", ")}. Tax invoices are withheld and the storefront omits the
        legal name / GSTIN until these are set — there is no default to fall back to.
        {linkToSettings ? (
          <>
            {" "}
            <Link href={"/admin/settings" as Route} className="font-medium underline">
              Edit in Settings →
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
