import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveAdminContext } from "@/lib/admin/context";
import { getCoupon } from "@/lib/admin/coupons";
import { CouponForm } from "@/components/admin/CouponForm";
import { NoAccess } from "@/components/admin/NoAccess";

export const dynamic = "force-dynamic";

export default async function AdminCouponEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("coupons:read")) return <NoAccess module="Promotions" />;

  const { id } = await params;
  const coupon = await getCoupon(id);
  if (coupon === null) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={"/admin/coupons" as Route} className="text-[13px] text-[#8a7a68] hover:text-[#2a1d12]">
        ← Promotions
      </Link>
      <h1 className="mb-6 mt-2 font-mono text-[24px] text-[#2a1d12]">{coupon.code}</h1>
      <CouponForm coupon={coupon} />
    </div>
  );
}
