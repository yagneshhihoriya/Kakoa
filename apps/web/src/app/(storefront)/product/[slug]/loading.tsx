import { Skeleton } from "@kakoa/ui";

const THUMB_SLOTS = Array.from({ length: 4 }, (_, i) => i);
const RELATED_SLOTS = Array.from({ length: 4 }, (_, i) => i);

/**
 * PDP skeleton — dimension-locked to the real layout (78px thumb rail +
 * square main image, right-column line heights, 54px pill CTAs) so CLS
 * contribution is 0 (design-system.md edge case #5; CLS ≤ 0.1 CI gate).
 */
export default function ProductLoading() {
  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 pt-7 pb-[72px] md:px-8">
      {/* Breadcrumb */}
      <Skeleton variant="text" width={240} className="mb-[26px]" />

      <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
        {/* Gallery: 78px thumbnail rail + square main image */}
        <div className="grid grid-cols-[78px_1fr] items-start gap-4">
          <div className="flex flex-col gap-3">
            {THUMB_SLOTS.map((slot) => (
              <Skeleton
                key={slot}
                variant="card"
                className="aspect-square w-full"
              />
            ))}
          </div>
          <Skeleton variant="card" className="aspect-square w-full" />
        </div>

        {/* Right column: eyebrow, serif name, stars, blurb, notes, panel */}
        <div>
          <Skeleton variant="text" width={130} className="mb-3" />
          <Skeleton variant="line" width="75%" height={46} className="mb-3.5" />
          <Skeleton variant="text" width={180} className="mb-5" />
          <Skeleton variant="text" width="92%" className="mb-2" />
          <Skeleton variant="text" width="70%" className="mb-6" />

          {/* Tasting-note chips */}
          <div className="mb-[26px] flex gap-2">
            <Skeleton variant="circle" width={92} height={33} />
            <Skeleton variant="circle" width={80} height={33} />
            <Skeleton variant="circle" width={104} height={33} />
          </div>

          {/* Price row */}
          <Skeleton variant="line" width={150} height={30} className="mb-2" />
          <Skeleton variant="text" width={260} className="mb-6" />

          {/* Variant chips */}
          <div className="mb-6 flex gap-2">
            <Skeleton variant="circle" width={132} height={44} />
            <Skeleton variant="circle" width={132} height={44} />
          </div>

          {/* Qty stepper + add-to-bag + wishlist row */}
          <div className="mb-4 flex items-center gap-3">
            <Skeleton variant="circle" width={128} height={54} />
            <Skeleton variant="circle" className="h-[54px] flex-1" />
            <Skeleton variant="circle" width={54} height={54} />
          </div>

          {/* Buy it now */}
          <Skeleton variant="circle" className="mb-6 h-[54px] w-full" />

          {/* Meta card + Legal Metrology block */}
          <Skeleton variant="card" className="h-28 w-full" />
          <Skeleton variant="card" className="mt-4 h-24 w-full" />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-16 border-t border-line pt-2">
        <div className="flex gap-8 border-b border-line py-4">
          <Skeleton variant="line" width={100} />
          <Skeleton variant="line" width={180} />
          <Skeleton variant="line" width={90} />
        </div>
        <div className="mt-8 grid max-w-[1000px] gap-8 md:grid-cols-[1.3fr_1fr] md:gap-12">
          <div className="flex flex-col gap-3">
            <Skeleton variant="text" width="95%" />
            <Skeleton variant="text" width="88%" />
            <Skeleton variant="text" width="60%" />
          </div>
          <Skeleton variant="card" className="h-44 w-full" />
        </div>
      </div>

      {/* Frequently bought together band */}
      <Skeleton variant="card" className="mt-16 h-56 w-full" />

      {/* Related 4-grid */}
      <div className="mt-16">
        <Skeleton variant="line" width={240} height={32} className="mb-6" />
        <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
          {RELATED_SLOTS.map((slot) => (
            <div
              key={slot}
              className="overflow-hidden rounded-[18px] border border-[#EEE1CE] bg-white"
            >
              <Skeleton variant="card" className="aspect-[4/5] w-full" />
              <div className="flex flex-col gap-2 px-4 pt-4 pb-[18px]">
                <Skeleton variant="line" width="70%" />
                <Skeleton variant="text" width="90%" />
                <Skeleton variant="text" width="40%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
