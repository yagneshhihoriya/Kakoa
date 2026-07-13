import type { ReactNode } from "react";
import { resolveAdminContext } from "@/lib/admin/context";
import { listMedia } from "@/lib/admin/media";
import { NoAccess } from "@/components/admin/NoAccess";
import { MediaLibrary } from "@/components/admin/MediaLibrary";

export const dynamic = "force-dynamic";

/**
 * `/admin/media` — the Media Library (docs/admin-platform §5). Upload + browse
 * images stored behind the MediaProvider (S3 in prod, local disk in dev). Static
 * route segment → overrides the "coming soon" placeholder now that it's built.
 */
export default async function AdminMediaPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("media:read")) return <NoAccess module="Media" />;

  const canWrite = resolved.ctx.can("media:write");
  const initial = await listMedia({ page: 1 });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
          Media
        </h1>
        <p className="text-[13px] text-[#8a7a68]">
          Upload and manage images used across products and content.
          {canWrite ? "" : " You have read-only access."}
        </p>
      </div>
      <MediaLibrary initial={initial} canWrite={canWrite} />
    </div>
  );
}
