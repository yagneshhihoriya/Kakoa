import { Skeleton } from "@kakoa/ui";

const GRID_SLOTS = Array.from({ length: 6 }, (_, i) => i);
const CHIP_SLOTS = Array.from({ length: 5 }, (_, i) => i);

/** Shop skeleton — dimension-locked to the real toolbar + card grid (CLS 0). */
export default function ShopLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-10">
      <header className="mb-8 flex flex-col gap-3">
        <Skeleton variant="line" width={180} height={36} />
        <Skeleton variant="text" width={280} />
      </header>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2">
          {CHIP_SLOTS.map((slot) => (
            <Skeleton key={slot} variant="circle" width={88} height={44} />
          ))}
        </div>
        <Skeleton variant="line" width={220} height={44} />
      </div>

      <Skeleton variant="text" width={200} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GRID_SLOTS.map((slot) => (
          <div
            key={slot}
            className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4"
          >
            <Skeleton variant="card" className="aspect-square w-full" />
            <Skeleton variant="line" width="70%" />
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="40%" />
          </div>
        ))}
      </div>
    </main>
  );
}
