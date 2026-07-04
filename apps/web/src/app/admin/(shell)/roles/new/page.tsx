import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { permissionsByResource } from "@platform/kernel";
import { resolveAdminContext } from "@/lib/admin/context";
import { NoAccess } from "@/components/admin/NoAccess";
import { RoleForm } from "@/components/admin/RoleForm";

export const dynamic = "force-dynamic";

export default async function AdminRoleNewPage(): Promise<ReactNode> {
  const resolved = await resolveAdminContext();
  if (resolved === null) return null;
  if (!resolved.ctx.can("roles:manage")) return <NoAccess module="Permissions" />;

  const grantable: "all" | string[] = resolved.admin.grants.includes("*")
    ? "all"
    : resolved.admin.grants.filter((g) => g !== "*");

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={"/admin/roles" as Route} className="text-[13px] text-[#8a7a68] hover:text-[#2a1d12]">
        ← Permissions
      </Link>
      <h1 className="mb-6 mt-2 text-[24px] text-[#2a1d12]" style={{ fontFamily: "var(--font-display), serif" }}>
        New role
      </h1>
      <RoleForm
        mode="create"
        initial={{ key: "", name: "", description: "", permissions: [], isSystem: false, isOwner: false }}
        groups={permissionsByResource()}
        grantable={grantable}
      />
    </div>
  );
}
