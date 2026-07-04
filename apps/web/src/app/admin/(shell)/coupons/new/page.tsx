import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { resolveAdminContext } from "@/lib/admin/context";
import { CouponForm } from "@/components/admin/CouponForm";
import { NoAccess } from "@/components/admin/NoAccess";

export const dynamic = "force-dynamic";

export default async function AdminCouponNewPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("coupons:manage")) return <NoAccess module="Promotions" />;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={"/admin/coupons" as Route} className="text-[13px] text-[#8a7a68] hover:text-[#2a1d12]">
        ← Promotions
      </Link>
      <h1 className="mb-6 mt-2 text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
        New promotion
      </h1>
      <CouponForm />
    </div>
  );
}
