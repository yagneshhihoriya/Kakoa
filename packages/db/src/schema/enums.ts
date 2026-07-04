/**
 * Postgres enum types — built from the canonical `as const` tuples in
 * `@kakoa/core` (Contract §1.0) so the DB and zod validation can never
 * drift. NEVER redeclare enum value strings here.
 */
import { pgEnum } from 'drizzle-orm/pg-core';
import {
  ACTOR_TYPES,
  ADMIN_ROLES,
  CART_STATUSES,
  DELIVERY_OPTIONS,
  INVENTORY_REASONS,
  ORDER_STATUSES,
  OTP_CHANNELS,
  OTP_PURPOSES,
  PAYMENT_METHODS,
  PAYMENT_MODES,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  REFUND_DESTINATIONS,
  REFUND_STATUSES,
  RETURN_REASONS,
  RETURN_RESOLUTIONS,
  RETURN_STATUSES,
  REVIEW_STATUSES,
  SHIPMENT_STATUSES,
  WEBHOOK_PROVIDERS,
  WEBHOOK_STATUSES,
} from '@kakoa/core';

export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES);
export const paymentModeEnum = pgEnum('payment_mode', PAYMENT_MODES);
export const paymentProviderEnum = pgEnum('payment_provider', PAYMENT_PROVIDERS);
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);
export const refundStatusEnum = pgEnum('refund_status', REFUND_STATUSES);
export const refundDestinationEnum = pgEnum('refund_destination', REFUND_DESTINATIONS);
export const shipmentStatusEnum = pgEnum('shipment_status', SHIPMENT_STATUSES);
export const webhookProviderEnum = pgEnum('webhook_provider', WEBHOOK_PROVIDERS);
export const webhookStatusEnum = pgEnum('webhook_status', WEBHOOK_STATUSES);
export const otpChannelEnum = pgEnum('otp_channel', OTP_CHANNELS);
export const otpPurposeEnum = pgEnum('otp_purpose', OTP_PURPOSES);
export const cartStatusEnum = pgEnum('cart_status', CART_STATUSES);
export const deliveryOptionEnum = pgEnum('delivery_option', DELIVERY_OPTIONS);
export const reviewStatusEnum = pgEnum('review_status', REVIEW_STATUSES);
export const returnStatusEnum = pgEnum('return_status', RETURN_STATUSES);
export const returnReasonEnum = pgEnum('return_reason', RETURN_REASONS);
export const returnResolutionEnum = pgEnum('return_resolution', RETURN_RESOLUTIONS);
export const adminRoleEnum = pgEnum('admin_role', ADMIN_ROLES);
export const actorTypeEnum = pgEnum('actor_type', ACTOR_TYPES);
export const inventoryReasonEnum = pgEnum('inventory_reason', INVENTORY_REASONS);
