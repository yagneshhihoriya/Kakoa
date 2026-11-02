"use client";

import { Button } from "@kakoa/ui";
import { brand } from "@/lib/brand";

/** Storefront-wide error boundary (covers Home) — always offers Retry. Copy is the pack's. */
const { storefront: copy } = brand.copy.errors;
export default function StorefrontError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-display text-2xl text-ink">{copy.title}</h1>
      <p className="max-w-md font-body text-sm text-espresso">{copy.body}</p>
      <Button variant="primary" onClick={reset}>
        Retry
      </Button>
    </main>
  );
}
