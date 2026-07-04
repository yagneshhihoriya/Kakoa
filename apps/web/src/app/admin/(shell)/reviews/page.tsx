import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { resolveAdminContext } from "@/lib/admin/context";
import { listReviews, type ReviewFilter } from "@/lib/admin/reviews";
import { NoAccess } from "@/components/admin/NoAccess";
import { ReviewQueue } from "@/components/admin/ReviewQueue";

export const dynamic = "force-dynamic";

function reviewsHref(params: Record<string, string | undefined>): Route {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return (qs ? `/admin/reviews?${qs}` : "/admin/reviews") as Route;
}

const FILTERS: { label: string; value: ReviewFilter }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("reviews:moderate")) return <NoAccess module="Reviews" />;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const statusRaw = one(sp.status);
  const status: ReviewFilter = FILTERS.some((f) => f.value === statusRaw)
    ? (statusRaw as ReviewFilter)
    : "pending";
  const page = Math.max(1, Number(one(sp.page) ?? "1") || 1);

  const list = await listReviews({ status, page });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
          Reviews
        </h1>
        <p className="text-[13px] text-[#8a7a68]">
          {list.total} {status === "pending" ? "awaiting moderation" : `in “${status}”`}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={reviewsHref({ status: f.value === "pending" ? undefined : f.value })}
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

      <ReviewQueue rows={list.rows} />

      {list.pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-between text-[13px] text-[#6b5844]">
          <span>Page {list.page} of {list.pageCount}</span>
          <div className="flex gap-2">
            <PageLink href={reviewsHref({ status: status === "pending" ? undefined : status, page: String(list.page - 1) })} disabled={list.page <= 1}>Previous</PageLink>
            <PageLink href={reviewsHref({ status: status === "pending" ? undefined : status, page: String(list.page + 1) })} disabled={list.page >= list.pageCount}>Next</PageLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: Route; disabled: boolean; children: ReactNode }): ReactNode {
  if (disabled) return <span className="cursor-not-allowed rounded-lg border border-[#eadbc6] px-3 py-1.5 text-[#c9bba6]">{children}</span>;
  return <Link href={href} className="rounded-lg border border-[#eadbc6] bg-white px-3 py-1.5 hover:bg-[#f3e7d5]">{children}</Link>;
}
