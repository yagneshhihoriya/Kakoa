/**
 * @kakoa/ui — server-safe barrel. Everything here is RSC-compatible
 * (no hooks, no browser APIs at module scope). Client-only primitives
 * (QtyStepper, Toast, Drawer) live in `@kakoa/ui/client`.
 *
 * Boundary rule (PROJECT_PLAN §3.1): `ui` imports only `@kakoa/core` —
 * never `@kakoa/db`, never app code. Zero data-fetching.
 */

export { Button } from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';

export { Card } from './components/Card';
export type { CardProps } from './components/Card';

export { Chip } from './components/Chip';
export type { ChipProps } from './components/Chip';

export { Field, fieldErrorId } from './components/Field';
export type { FieldProps } from './components/Field';

export { Input } from './components/Input';
export type { InputProps } from './components/Input';

export { Select } from './components/Select';
export type { SelectProps, SelectOption } from './components/Select';

export { Badge } from './components/Badge';
export type { BadgeProps, BadgeTone } from './components/Badge';

export { StarRating } from './components/StarRating';
export type { StarRatingProps } from './components/StarRating';

export { Skeleton } from './components/Skeleton';
export type { SkeletonProps, SkeletonVariant } from './components/Skeleton';

export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps, EmptyStateCta } from './components/EmptyState';

export { Price } from './components/Price';
export type { PriceProps } from './components/Price';

export { cx } from './lib/cx';
