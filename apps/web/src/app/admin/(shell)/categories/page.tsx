import type { ReactNode } from "react";
import { resolveAdminContext } from "@/lib/admin/context";
import { listCategories } from "@/lib/admin/categories";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { NoAccess } from "@/components/admin/NoAccess";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("categories:manage")) return <NoAccess module="Categories" />;

  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1
          className="text-[24px] text-[#2a1d12]"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Categories
        </h1>
        <p className="text-[13px] text-[#8a7a68]">
          The catalog taxonomy. Add, rename, re-order, or archive — the storefront
          updates automatically. No code or migration needed.
        </p>
      </div>

      <CategoryManager initial={categories} />
    </div>
  );
}
