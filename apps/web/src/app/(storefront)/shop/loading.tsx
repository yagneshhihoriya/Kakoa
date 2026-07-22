import { Skeleton } from "@kakoa/ui";

/** 12 grid slots = PAGE_SIZE; 6 chip slots ≈ All + seeded categories. */
const GRID_SLOTS = Array.from({ length: 12 }, (_, i) => i);
const CHIP_SLOTS = Array.from({ length: 6 }, (_, i) => i);

/**
 * Shop skeleton — dimension-locked to the REAL page (shop/page.tsx) so there is
 * no layout shift when data resolves: same 1240px container + pt-7/pb-[72px]
 * padding, the eyebrow → serif title → sub header with a right-aligned sort
 * pill, the chip row, the result-count line, and a 12-slot 4/5 card grid that
 * mirrors ProductCard (rounded-[20px] paper card, aspect-[4/5] image).
 */
export default function ShopLoading() {
  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 pt-7 pb-[72px] md:px-8">
      {/* Breadcrumb */}
      <Skeleton variant="text" width={150} className="mb-6" />

      {/* Header — eyebrow + serif title + sub · sort pill right */}
      <div className="mb-2 flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-3">
          <Skeleton variant="text" width={90} />
          <Skeleton variant="line" width={260} height={40} />
          <Skeleton variant="text" width={300} />
        </div>
        <Skeleton variant="line" width={150} height={44} className="rounded-pill" />
      </div>

      {/* Filter chip row */}
      <div className="mt-6 flex gap-2 overflow-hidden pb-1">
        {CHIP_SLOTS.map((slot) => (
          <Skeleton
            key={slot}
            variant="line"
            width={92}
            height={44}
            className="shrink-0 rounded-pill"
          />
        ))}
      </div>

      {/* Result count */}
      <Skeleton variant="text" width={200} className="mt-6 mb-4" />

      {/* Product grid — mirrors ProductCard exactly (4-up on xl). */}
      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {GRID_SLOTS.map((slot) => (
          <div
            key={slot}
            className="overflow-hidden rounded-[20px] border border-line-soft bg-surface"
          >
            <Skeleton variant="card" className="aspect-[4/5] w-full rounded-none" />
            <div className="flex flex-col gap-2.5 px-[18px] pt-[18px] pb-5">
              <Skeleton variant="line" width="75%" height={20} />
              <Skeleton variant="text" width="95%" />
              <Skeleton variant="text" width="45%" />
              <div className="mt-1 flex items-center justify-between border-t border-line-soft pt-[14px]">
                <Skeleton variant="line" width={70} height={20} />
                <Skeleton variant="circle" width={72} height={38} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
