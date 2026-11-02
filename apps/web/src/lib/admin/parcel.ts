/**
 * Pure parcel-dimension resolution for shipment pushes — NO @kakoa/db import,
 * so it is unit-testable and the shipping provider never has to invent a box.
 */

/** One order line's packed physicals (numeric columns arrive as strings). */
interface ParcelLine {
  lengthCm: string | null;
  breadthCm: string | null;
  heightCm: string | null;
}

/**
 * The outer parcel for a shipment push: when EVERY line carries its own
 * dimensions, the box is the largest of each (a conservative single-parcel
 * estimate); otherwise the vertical preset's `defaultParcelCm`. Pure.
 */
export function resolveParcelCm(
  lines: readonly ParcelLine[],
  fallback: { length: number; breadth: number; height: number },
): { lengthCm: number; breadthCm: number; heightCm: number } {
  const dims = lines.map((l) => [l.lengthCm, l.breadthCm, l.heightCm].map((v) => (v === null ? NaN : Number(v))));
  const complete = dims.length > 0 && dims.every((d) => d.every((n) => Number.isFinite(n) && n > 0));
  if (!complete) return { lengthCm: fallback.length, breadthCm: fallback.breadth, heightCm: fallback.height };
  const max = (i: number): number => Math.max(...dims.map((d) => d[i] ?? 0));
  return { lengthCm: max(0), breadthCm: max(1), heightCm: max(2) };
}
