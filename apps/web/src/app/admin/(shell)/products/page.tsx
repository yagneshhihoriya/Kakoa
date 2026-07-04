import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { formatPaise } from "@kakoa/core";
import { resolveAdminContext } from "@/lib/admin/context";
import { listProducts } from "@/lib/admin/products";
import { NoAccess } from "@/components/admin/NoAccess";

export const dynamic = "force-dynamic";

function productsHref(params: Record<string, string | undefined>): Route {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return (qs ? `/admin/products?${qs}` : "/admin/products") as Route;
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("products:read")) return <NoAccess module="Products" />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const statusRaw = one(sp.status);
  const status =
    statusRaw === "active" || statusRaw === "inactive" ? statusRaw : undefined;
  const search = (one(sp.search) ?? "").slice(0, 80);
  const page = Math.max(1, Number(one(sp.page) ?? "1") || 1);

  const list = await listProducts({ search, status, page });
  const canWrite = resolved.ctx.can("products:write");

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1
            className="text-[24px] text-[#2a1d12]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Products
          </h1>
          <p className="text-[13px] text-[#8a7a68]">{list.total} total</p>
        </div>
        <form action="/admin/products" className="flex gap-2">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search name or slug"
            className="w-56 rounded-lg border border-[#eadbc6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c69a4c]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[#2a1d12] px-4 py-2 text-[13px] font-semibold text-[#f3e7d5]"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[
          { label: "All", value: undefined },
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ].map((f) => (
          <Link
            key={f.label}
            href={productsHref({ status: f.value, search: search || undefined })}
            className={
              "rounded-full px-3 py-1 text-[12.5px] transition-colors " +
              (status === f.value
                ? "bg-[#2a1d12] font-semibold text-[#f3e7d5]"
                : "bg-white text-[#5c4b3a] ring-1 ring-[#eadbc6] hover:bg-[#f3e7d5]")
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#eadbc6] bg-white">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#eadbc6] text-[11px] uppercase tracking-wider text-[#8a7a68]">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Variants</th>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#8a7a68]">
                  No products match these filters.
                </td>
              </tr>
            ) : (
              list.rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[#f3ece1] last:border-0 hover:bg-[#faf6ef]"
                >
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <Link
                        href={`/admin/products/${p.id}` as Route}
                        className="font-semibold text-[#2a1d12] hover:text-[#8a5a34]"
                      >
                        {p.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-[#2a1d12]">{p.name}</span>
                    )}
                    <div className="text-[11.5px] text-[#8a7a68]">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-[#5c4b3a]">{p.categoryName ?? "—"}</td>
                  <td className="px-4 py-3 text-[#5c4b3a]">{p.variantCount}</td>
                  <td className="px-4 py-3 font-medium text-[#2a1d12]">
                    {p.fromPricePaise > 0 ? formatPaise(p.fromPricePaise) : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#5c4b3a]">{p.totalStock}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-block rounded-full px-2.5 py-1 text-[11.5px] font-medium " +
                        (p.active
                          ? "bg-[#dff0e3] text-[#3f8a54]"
                          : "bg-[#ece6df] text-[#8a7a68]")
                      }
                    >
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {list.pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-between text-[13px] text-[#6b5844]">
          <span>
            Page {list.page} of {list.pageCount}
          </span>
          <div className="flex gap-2">
            <PageLink
              href={productsHref({ status, search: search || undefined, page: String(list.page - 1) })}
              disabled={list.page <= 1}
            >
              Previous
            </PageLink>
            <PageLink
              href={productsHref({ status, search: search || undefined, page: String(list.page + 1) })}
              disabled={list.page >= list.pageCount}
            >
              Next
            </PageLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: Route;
  disabled: boolean;
  children: ReactNode;
}): ReactNode {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-[#eadbc6] px-3 py-1.5 text-[#c9bba6]">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-[#eadbc6] bg-white px-3 py-1.5 hover:bg-[#f3e7d5]"
    >
      {children}
    </Link>
  );
}
