import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../lib/cx';

export type SkeletonVariant = 'line' | 'text' | 'card' | 'circle';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /**
   * Explicit dimensions — skeletons must be dimension-locked to the content
   * they replace so CLS contribution is 0 (design-system.md edge case #5).
   */
  width?: number | string;
  height?: number | string;
  className?: string;
}

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  line: 'h-4 rounded-sm',
  text: 'h-3 rounded-sm',
  card: 'rounded-lg',
  circle: 'rounded-pill',
};

/** Loading placeholder — hidden from assistive tech, pulse animation. */
export function Skeleton({
  variant = 'line',
  width,
  height,
  className,
}: SkeletonProps): ReactNode {
  const style: CSSProperties = {};
  if (width !== undefined) style.width = width;
  if (height !== undefined) style.height = height;
  return (
    <div
      aria-hidden="true"
      className={cx('animate-pulse bg-line', VARIANT_CLASSES[variant], className)}
      style={style}
    />
  );
}
