import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/**
 * Catch-all placeholder for admin modules whose real screens aren't built yet.
 * A static segment (e.g. `admin/(shell)/orders/page.tsx`) overrides this once
 * the module ships, so no code here needs changing then.
 */
export default async function AdminSectionPlaceholder({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<ReactNode> {
  const { section } = await params;
  const title = section.charAt(0).toUpperCase() + section.slice(1);
  return (
    <div className="mx-auto max-w-2xl">
      <h1
        className="mb-2 text-[24px] text-[#2a1d12]"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {title}
      </h1>
      <div className="rounded-xl border border-dashed border-[#d8c7b0] bg-white p-8 text-center">
        <p className="text-[14px] font-semibold text-[#5c4b3a]">Coming soon</p>
        <p className="mt-1 text-[13px] text-[#8a7a68]">
          This module is registered in the platform and enabled for your
          business — its screens are being built in the phased roadmap.
        </p>
      </div>
    </div>
  );
}
