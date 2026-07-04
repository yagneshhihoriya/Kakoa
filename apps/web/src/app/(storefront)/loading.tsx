import { Skeleton } from "@kakoa/ui";

const CARD_SLOTS = Array.from({ length: 4 }, (_, i) => i);

/** Storefront group loading state — hero band + card row (Home-shaped). */
export default function StorefrontLoading() {
  return (
    <main className="flex flex-col">
      <section className="bg-card px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <Skeleton variant="text" width={180} />
          <Skeleton variant="line" width="60%" height={48} />
          <Skeleton variant="text" width="40%" />
          <div className="flex gap-3">
            <Skeleton variant="circle" width={200} height={48} />
            <Skeleton variant="circle" width={160} height={48} />
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
        <Skeleton variant="line" width={220} height={28} className="mb-6" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARD_SLOTS.map((slot) => (
            <div
              key={slot}
              className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4"
            >
              <Skeleton variant="card" className="aspect-square w-full" />
              <Skeleton variant="line" width="70%" />
              <Skeleton variant="text" width="40%" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
