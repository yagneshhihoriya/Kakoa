import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveAdminContext } from "@/lib/admin/context";
import {
  getProductForEdit,
  listCategoriesForSelect,
} from "@/lib/admin/products";
import { ProductEditForm } from "@/components/admin/ProductEditForm";
import { NoAccess } from "@/components/admin/NoAccess";

export const dynamic = "force-dynamic";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("products:read")) return <NoAccess module="Products" />;

  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductForEdit(id),
    listCategoriesForSelect(),
  ]);
  if (product === null) notFound();

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href={"/admin/products" as Route}
        className="text-[13px] text-[#8a7a68] hover:text-[#2a1d12]"
      >
        ← Products
      </Link>
      <h1
        className="mb-6 mt-2 text-[24px] text-[#2a1d12]"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {product.name}
      </h1>

      <ProductEditForm
        product={product}
        categories={categories}
        attributeSchema={resolved.ctx.preset.attributeSchema}
        canWrite={resolved.ctx.can("products:write")}
        canPublish={resolved.ctx.can("products:publish")}
      />
    </div>
  );
}
