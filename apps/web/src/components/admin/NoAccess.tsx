import type { ReactNode } from "react";

/**
 * Shown when an authenticated admin opens a module URL they lack permission for
 * (the nav already hides it; this blocks direct navigation — defense in depth).
 */
export function NoAccess({ module }: { module: string }): ReactNode {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-[#d8c7b0] bg-white p-8 text-center">
      <div className="text-[15px] font-semibold text-[#2a1d12]">
        No access to {module}
      </div>
      <p className="mt-1 text-[13px] text-[#8a7a68]">
        Your role doesn't include permission for this section. Ask an owner if
        you need it.
      </p>
    </div>
  );
}
