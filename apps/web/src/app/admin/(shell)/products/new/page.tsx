import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { resolveAdminContext } from "@/lib/admin/context";
import { listCategoriesForSelect } from "@/lib/admin/products";
import { ProductCreateForm } from "@/components/admin/ProductCreateForm";
import { NoAccess } from "@/components/admin/NoAccess";

export const dynamic = "force-dynamic";

export default async function AdminProductNewPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("products:write")) return <NoAccess module="Products" />;

  const categories = await listCategoriesForSelect();

  return (
    <div className="mx-auto max-w-7xl">
      <Link href={"/admin/products" as Route} className="text-[13px] text-[#8a7a68] hover:text-[#2a1d12]">
        ← Products
      </Link>
      <h1 className="mb-6 mt-2 text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
        New product
      </h1>
      <ProductCreateForm categories={categories} />
    </div>
  );
}
