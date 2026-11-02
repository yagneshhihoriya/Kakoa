"use client";

import { Button } from "@kakoa/ui";
import { brand } from "@/lib/brand";

/**
 * Shop error boundary — the grid never renders blank (module spec §2 step 2:
 * "Failure → route-level error boundary with Retry, never a blank grid").
 * Copy is the brand pack's.
 */
const { shop: copy } = brand.copy.errors;
export default function ShopError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-6xl flex-col items-center justify-center gap-4 px-6 py-16 text-center md:px-10">
      <h1 className="font-display text-2xl text-ink">{copy.title}</h1>
      <p className="max-w-md font-body text-sm text-espresso">{copy.body}</p>
      <Button variant="primary" onClick={reset}>
        Retry
      </Button>
    </main>
  );
}
